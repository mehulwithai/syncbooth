'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { getSocket } from '../../../lib/socket';
import { estimateServerOffset, msUntilTarget } from '../../../lib/timeSync';
import CameraView from '../../../components/CameraView';
import PhotoStrip from '../../../components/PhotoStrip';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
const TOTAL_ROUNDS = 4;

export default function RoomPage() {
  const params = useParams();
  const code = (params?.code || (typeof window !== 'undefined' ? window.location.pathname.split('/').pop() : '')).toUpperCase();
  const cameraRef = useRef(null);
  const slotRef = useRef(null);
  const roundRef = useRef(1);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const iceCandidatesQueueRef = useRef([]);

  // Timer references for robust sync
  const countdownIntervalRef = useRef(null);
  const countdownTimeoutRef = useRef(null);
  const flashTimeoutRef = useRef(null);

  const [hasJoined, setHasJoined] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [genderInput, setGenderInput] = useState('Male');
  const [joinError, setJoinError] = useState(null);

  const [slot, setSlot] = useState(null);
  const [occupancy, setOccupancy] = useState(1);
  const [roomUsers, setRoomUsers] = useState([]);
  const [status, setStatus] = useState('Connecting...');
  const [countdown, setCountdown] = useState(null);
  const [flash, setFlash] = useState(false);
  const [strip, setStrip] = useState(null);
  const [iAmReady, setIAmReady] = useState(false);
  const [partnerReady, setPartnerReady] = useState(false);
  const [round, setRound] = useState(0); // 0 = not started
  const [roundsDone, setRoundsDone] = useState([]); // completed pairs for the dot indicator

  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);

  // Voting state for re-taking shots
  const [retakeRequest, setRetakeRequest] = useState(null); // { round, requesterSlot }

  // Load saved name and gender on mount
  useEffect(() => {
    const savedName = localStorage.getItem('syncbooth-name') || '';
    const savedGender = localStorage.getItem('syncbooth-gender') || 'Male';
    setNameInput(savedName);
    setGenderInput(savedGender);
  }, []);

  useEffect(() => {
    if (!hasJoined) return;

    const socket = getSocket();

    // Register room event listeners
    socket.on('joined', ({ slot }) => {
      slotRef.current = slot;
      setSlot(slot);
      setJoinError(null);
      setStatus(slot === 1 ? 'Waiting for your partner to join...' : 'Joined! Say hi 👋');
    });

    socket.on('join-error', (msg) => {
      setJoinError(msg);
      setHasJoined(false);
    });

    socket.on('occupancy', ({ count, users }) => {
      setOccupancy(count);
      setRoomUsers(users || []);
      
      if (count === 2) {
        setStatus('Both connected! Hit "Ready" when you look good 😄');
        
        // If we are Slot 1 (Male), we initiate the WebRTC connection
        if (slotRef.current === 1) {
          console.log('Occupancy is 2 and we are slot 1 (Male). Initiating WebRTC call...');
          initiateCall(socket);
        }
      } else {
        setStatus(slotRef.current === 1 ? 'Waiting for your partner to join...' : 'Waiting for partner...');
        cleanupWebRTC();
      }
    });

    socket.on('partner-ready', () => setPartnerReady(true));

    socket.on('countdown-start', async ({ targetTime, round: r }) => {
      // Clear out photostrip and filter out previous captures for this round if retaking
      setStrip(null);
      setRoundsDone((prev) => prev.filter((item) => item.round !== r));

      roundRef.current = r;
      setRound(r);
      setPartnerReady(false);
      setIAmReady(false);
      const offset = await estimateServerOffset(socket);
      const waitMs = msUntilTarget(targetTime, offset);
      runCountdown(waitMs);
    });

    socket.on('round-complete', (pair) => {
      setRoundsDone((prev) => (prev.some((p) => p.round === pair.round) ? prev : [...prev, pair]));
      if (pair.round < TOTAL_ROUNDS) {
        setStatus(`Nice! ${pair.round}/${TOTAL_ROUNDS} shots done — next one coming up...`);
      }
    });

    socket.on('strip-ready', (stripData) => {
      setStrip(stripData);
      setStatus('Your strip is ready! 🎉');
    });

    // WebRTC Signaling
    socket.on('webrtc-offer', async ({ offer }) => {
      console.log('Received WebRTC offer');
      const pc = getOrCreatePeerConnection(socket);
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtc-answer', { code, answer });
        
        // Drain ICE candidates
        for (const cand of iceCandidatesQueueRef.current) {
          await pc.addIceCandidate(new RTCIceCandidate(cand));
        }
        iceCandidatesQueueRef.current = [];
      } catch (e) {
        console.error('Error handling WebRTC offer:', e);
      }
    });

    socket.on('webrtc-answer', async ({ answer }) => {
      console.log('Received WebRTC answer');
      const pc = peerConnectionRef.current;
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          // Drain ICE candidates
          for (const cand of iceCandidatesQueueRef.current) {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          }
          iceCandidatesQueueRef.current = [];
        } catch (e) {
          console.error('Error setting remote description from answer:', e);
        }
      }
    });

    socket.on('webrtc-candidate', async ({ candidate }) => {
      const pc = peerConnectionRef.current;
      if (pc && pc.remoteDescription) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error('Error adding ICE candidate:', e);
        }
      } else {
        iceCandidatesQueueRef.current.push(candidate);
      }
    });

    // Re-take voting listeners
    socket.on('retake-requested', ({ round: r, requesterSlot }) => {
      setRetakeRequest({ round: r, requesterSlot });
    });

    socket.on('retake-declined', ({ round: r }) => {
      setStatus(`Your partner declined the re-take request for Shot ${r}.`);
      setTimeout(() => {
        setStatus('Your strip is ready! 🎉');
      }, 3000);
    });

    // Emit join-room
    socket.emit('join-room', { code, name: nameInput.trim(), gender: genderInput });

    return () => {
      socket.off('joined');
      socket.off('join-error');
      socket.off('occupancy');
      socket.off('partner-ready');
      socket.off('countdown-start');
      socket.off('round-complete');
      socket.off('strip-ready');
      socket.off('webrtc-offer');
      socket.off('webrtc-answer');
      socket.off('webrtc-candidate');
      socket.off('retake-requested');
      socket.off('retake-declined');
    };
  }, [hasJoined, code]);

  // Clean up local camera stream, WebRTC connection, and timers on unmount
  useEffect(() => {
    return () => {
      cleanupWebRTC();
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (countdownTimeoutRef.current) clearTimeout(countdownTimeoutRef.current);
      if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    };
  }, []);

  async function initiateCall(socket) {
    const pc = getOrCreatePeerConnection(socket);
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('webrtc-offer', { code, offer });
    } catch (e) {
      console.error('Failed to create WebRTC offer:', e);
    }
  }

  function getOrCreatePeerConnection(socket) {
    if (peerConnectionRef.current) {
      return peerConnectionRef.current;
    }

    console.log('Creating RTCPeerConnection...');
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    // Add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // Handle remote track
    pc.ontrack = (event) => {
      console.log('Received remote track', event.streams[0]);
      setRemoteStream(event.streams[0]);
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('webrtc-candidate', { code, candidate: event.candidate });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log('WebRTC connection state:', pc.connectionState);
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setRemoteStream(null);
      }
    };

    peerConnectionRef.current = pc;
    return pc;
  }

  function cleanupWebRTC() {
    if (peerConnectionRef.current) {
      console.log('Cleaning up WebRTC...');
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    setRemoteStream(null);
    iceCandidatesQueueRef.current = [];
  }

  async function joinSession() {
    if (!nameInput.trim()) return;
    setJoinError(null);

    // Get the local camera stream FIRST before triggering join state
    let stream = localStreamRef.current;
    if (!stream) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: 720, height: 720 },
          audio: false
        });
        localStreamRef.current = stream;
        setLocalStream(stream);
      } catch (err) {
        console.error('Camera error:', err);
        setJoinError('Camera access is required to use the photobooth.');
        return;
      }
    }

    // Trigger join - this initiates the socket connection and room join with full listeners active
    setHasJoined(true);
  }

  function runCountdown(waitMs) {
    // Clear any active intervals/timeouts to prevent multiple flashes
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    if (countdownTimeoutRef.current) clearTimeout(countdownTimeoutRef.current);
    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);

    const totalSeconds = Math.ceil(waitMs / 1000);
    setCountdown(totalSeconds);

    countdownIntervalRef.current = setInterval(() => {
      setCountdown((c) => {
        if (typeof c !== 'number' || c <= 1) {
          clearInterval(countdownIntervalRef.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000);

    countdownTimeoutRef.current = setTimeout(async () => {
      clearInterval(countdownIntervalRef.current);
      setCountdown('📸');
      setFlash(true);
      
      flashTimeoutRef.current = setTimeout(() => {
        setFlash(false);
      }, 400);

      const image = cameraRef.current?.capture();
      if (image && slotRef.current) {
        await fetch(`${BACKEND}/api/rooms/${code}/capture`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slot: slotRef.current, round: roundRef.current, imageBase64: image })
        });
      } else {
        console.error('Capture skipped: missing image or slot', { image: !!image, slot: slotRef.current });
      }
      
      countdownTimeoutRef.current = setTimeout(() => {
        setCountdown(null);
      }, 700);
    }, waitMs);
  }

  function hitReady() {
    setIAmReady(true);
    getSocket().emit('ready', { code });
  }

  // Vote voting handlers
  function handleRequestRetake(retakeRound) {
    setStatus(`Sent re-take request for Shot ${retakeRound} to your partner...`);
    getSocket().emit('request-retake', { code, round: retakeRound });
  }

  function handleRetakeResponse(agree) {
    if (retakeRequest) {
      getSocket().emit('retake-response', { code, round: retakeRequest.round, agree });
      setRetakeRequest(null);
    }
  }

  // Pre-join Form Screen
  if (!hasJoined) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-4 py-8 bg-[#0f0a1a]">
        <div className="w-full max-w-md bg-white/5 border border-white/10 backdrop-blur-xl rounded-3xl p-8 shadow-2xl shadow-black/50 animate-fadeInUp flex flex-col gap-6">
          <div className="text-center">
            <p className="text-white/40 text-xs tracking-[0.2em] uppercase mb-1">Room Code: {code}</p>
            <h1 className="text-2xl font-bold tracking-wide">Enter the Photobooth 📸</h1>
          </div>

          {joinError && (
            <div className="bg-red-500/20 border border-red-500/30 text-red-200 text-sm px-4 py-3 rounded-xl animate-fadeIn">
              ⚠️ {joinError}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label className="text-white/60 text-xs tracking-wider uppercase font-semibold">Your Name</label>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              placeholder="e.g. Alex"
              maxLength={20}
              className="w-full bg-white/5 border border-white/10 hover:border-white/20 focus:border-pink-500 focus:shadow-[0_0_15px_rgba(236,72,153,0.15)] rounded-xl px-4 py-3 text-white outline-none transition-all duration-300"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-white/60 text-xs tracking-wider uppercase font-semibold">Your Gender</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setGenderInput('Male')}
                className={`py-3 rounded-xl border font-semibold flex items-center justify-center gap-2 transition-all duration-300 ${
                  genderInput === 'Male'
                    ? 'bg-pink-500/20 border-pink-500 text-pink-300 shadow-[0_0_15px_rgba(236,72,153,0.1)]'
                    : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                }`}
              >
                <span>♂️</span> Male
              </button>
              <button
                type="button"
                onClick={() => setGenderInput('Female')}
                className={`py-3 rounded-xl border font-semibold flex items-center justify-center gap-2 transition-all duration-300 ${
                  genderInput === 'Female'
                    ? 'bg-pink-500/20 border-pink-500 text-pink-300 shadow-[0_0_15px_rgba(236,72,153,0.1)]'
                    : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                }`}
              >
                <span>♀️</span> Female
              </button>
            </div>
          </div>

          <button
            onClick={joinSession}
            disabled={!nameInput.trim()}
            className="w-full mt-2 bg-pink-500 hover:bg-pink-400 active:scale-95 disabled:opacity-50 disabled:pointer-events-none transition-all duration-200 rounded-xl py-3.5 font-bold shadow-lg shadow-pink-500/20 text-white"
          >
            Enter Room
          </button>
        </div>
      </main>
    );
  }

  // Active Photobooth Session Screen
  const maleStream = slot === 1 ? localStream : remoteStream;
  const femaleStream = slot === 2 ? localStream : remoteStream;

  const maleUser = roomUsers.find((u) => u.slot === 1 || u.gender === 'Male');
  const femaleUser = roomUsers.find((u) => u.slot === 2 || u.gender === 'Female');

  const maleName = maleUser ? maleUser.name : 'Waiting for Male...';
  const femaleName = femaleUser ? femaleUser.name : 'Waiting for Female...';

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-8 gap-6 bg-[#0f0a1a]">
      <div className="text-center animate-fadeIn">
        <p className="text-white/40 text-sm tracking-widest">ROOM CODE</p>
        <h1 className="text-3xl font-bold tracking-widest text-pink-400 drop-shadow-[0_0_10px_rgba(244,63,94,0.15)]">{code}</h1>
        <p className="text-white/60 mt-1 transition-all duration-300 text-sm">{status}</p>
      </div>

      {strip ? (
        <PhotoStrip rounds={strip.rounds} onRequestRetake={handleRequestRetake} />
      ) : (
        <>
          {/* Cameras Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl relative">
            
            {/* Male Camera Box */}
            <div className="flex flex-col items-center gap-2 w-full max-w-sm mx-auto animate-fadeIn">
              <span className="text-xs font-semibold tracking-wider text-blue-400/80 uppercase flex items-center gap-1">
                ♂️ Male Camera
              </span>
              <div className="relative w-full transition-transform duration-300">
                <CameraView
                  ref={slot === 1 ? cameraRef : null}
                  stream={maleStream}
                  mirrored={slot === 1}
                  placeholderText="Waiting for Male partner..."
                />
                {countdown !== null && (
                  <div
                    key={`countdown-male-${countdown}`}
                    className="absolute inset-0 flex items-center justify-center bg-black/50 text-6xl font-bold rounded-2xl animate-pop z-10"
                  >
                    {countdown}
                  </div>
                )}
                {flash && (
                  <div className="absolute inset-0 bg-white rounded-2xl animate-flash pointer-events-none z-20" />
                )}
              </div>
              <p className="text-white/70 text-sm font-medium mt-1 truncate max-w-full">
                {maleName}
              </p>
            </div>

            {/* Female Camera Box */}
            <div className="flex flex-col items-center gap-2 w-full max-w-sm mx-auto animate-fadeIn">
              <span className="text-xs font-semibold tracking-wider text-pink-400/80 uppercase flex items-center gap-1">
                ♀️ Female Camera
              </span>
              <div className="relative w-full transition-transform duration-300">
                <CameraView
                  ref={slot === 2 ? cameraRef : null}
                  stream={femaleStream}
                  mirrored={slot === 2}
                  placeholderText="Waiting for Female partner..."
                />
                {countdown !== null && (
                  <div
                    key={`countdown-female-${countdown}`}
                    className="absolute inset-0 flex items-center justify-center bg-black/50 text-6xl font-bold rounded-2xl animate-pop z-10"
                  >
                    {countdown}
                  </div>
                )}
                {flash && (
                  <div className="absolute inset-0 bg-white rounded-2xl animate-flash pointer-events-none z-20" />
                )}
              </div>
              <p className="text-white/70 text-sm font-medium mt-1 truncate max-w-full">
                {femaleName}
              </p>
            </div>

          </div>

          {round > 0 && (
            <div className="flex gap-2 animate-fadeIn">
              {Array.from({ length: TOTAL_ROUNDS }).map((_, i) => {
                const num = i + 1;
                const done = roundsDone.some((r) => r.round === num);
                const active = num === round && !done;
                return (
                  <span
                    key={num}
                    className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                      done
                        ? 'bg-pink-500 scale-100'
                        : active
                        ? 'bg-pink-500/50 scale-125 animate-pulse'
                        : 'bg-white/20 scale-90'
                    }`}
                  />
                );
              })}
            </div>
          )}

          {occupancy === 2 && round === 0 && (
            <button
              onClick={hitReady}
              disabled={iAmReady}
              className="bg-pink-500 hover:bg-pink-400 active:scale-95 disabled:opacity-50 transition-all duration-200 rounded-full px-8 py-3 font-semibold shadow-lg shadow-pink-500/20 text-white"
            >
              {iAmReady ? 'Waiting for partner...' : 'Ready 💗'}
            </button>
          )}

          {partnerReady && !iAmReady && round === 0 && (
            <p className="text-pink-300 animate-pulse">Your partner is ready! 💗</p>
          )}
        </>
      )}

      {/* Re-take Request Modal Dialog Overlay */}
      {retakeRequest && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-[#141018] border border-white/10 rounded-3xl p-6 max-w-sm w-full text-center shadow-2xl flex flex-col gap-6 animate-pop">
            <div>
              <p className="text-pink-400 text-xs font-semibold tracking-wider uppercase mb-1">Re-take Request 🔄</p>
              <h2 className="text-xl font-bold text-white">
                {retakeRequest.requesterSlot === 1 ? maleName : femaleName} wants to re-take Shot {retakeRequest.round}
              </h2>
              <p className="text-white/60 text-sm mt-2">
                Do you agree to re-shoot this round? This will delete the previous capture.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => handleRetakeResponse(true)}
                className="w-full bg-pink-500 hover:bg-pink-400 active:scale-95 transition-all duration-200 rounded-xl py-3 font-bold text-white shadow-lg shadow-pink-500/20"
              >
                Agree (Let's re-shoot!)
              </button>
              <button
                onClick={() => handleRetakeResponse(false)}
                className="w-full bg-white/5 hover:bg-white/10 active:scale-95 border border-white/10 rounded-xl py-2.5 font-bold text-white/80 transition-all duration-200"
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
