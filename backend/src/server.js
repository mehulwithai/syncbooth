import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import { nanoid } from 'nanoid';
import { supabase } from './supabase.js';
import { joinRoom, leaveRoom, markReady, resetReady, getRoom, setRound, getRound } from './roomManager.js';

const TOTAL_ROUNDS = 4;
const ROUND_GAP_MS = 1600; // pause between shots so people can reset pose
const COUNTDOWN_MS = 3000;

dotenv.config();

const app = express();
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json({ limit: '10mb' }));

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: process.env.FRONTEND_URL || '*', methods: ['GET', 'POST'] }
});

// ---- REST: create a room ----
app.post('/api/rooms', async (req, res) => {
  const code = nanoid(6).toUpperCase();
  const { data, error } = await supabase
    .from('rooms')
    .insert({ code, status: 'waiting' })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ code: data.code, roomId: data.id });
});

// ---- REST: get room + strip status ----
app.get('/api/rooms/:code', async (req, res) => {
  const { data, error } = await supabase
    .from('rooms')
    .select('*, strips(*)')
    .eq('code', req.params.code.toUpperCase())
    .single();

  if (error) return res.status(404).json({ error: 'Room not found' });
  res.json(data);
});

// ---- REST: upload a capture (base64 image) ----
app.post('/api/rooms/:code/capture', async (req, res) => {
  const { slot, imageBase64, round } = req.body;
  const code = req.params.code.toUpperCase();
  const roundNum = Number(round) || 1;

  const { data: room, error: roomErr } = await supabase
    .from('rooms').select('id').eq('code', code).single();
  if (roomErr) return res.status(404).json({ error: 'Room not found' });

  const buffer = Buffer.from(imageBase64.split(',').pop(), 'base64');
  const path = `${code}/r${roundNum}-slot${slot}-${Date.now()}.jpg`;

  const { error: uploadErr } = await supabase.storage
    .from('captures')
    .upload(path, buffer, { contentType: 'image/jpeg' });
  if (uploadErr) return res.status(500).json({ error: uploadErr.message });

  const { data: urlData } = supabase.storage.from('captures').getPublicUrl(path);

  const { error: insertErr } = await supabase.from('captures').insert({
    room_id: room.id,
    user_slot: slot,
    round: roundNum,
    image_url: urlData.publicUrl
  });
  if (insertErr) return res.status(500).json({ error: insertErr.message });

  io.to(code).emit('capture-received', { slot, round: roundNum });

  // check if both slots are in for THIS round
  const { data: roundCaptures } = await supabase
    .from('captures').select('*').eq('room_id', room.id).eq('round', roundNum);

  const slotsIn = new Set(roundCaptures.map((c) => c.user_slot));
  if (!(slotsIn.has(1) && slotsIn.has(2))) {
    return res.json({ ok: true }); // waiting on the other person for this round
  }

  const pair = {
    round: roundNum,
    slot1_url: roundCaptures.find((c) => c.user_slot === 1).image_url,
    slot2_url: roundCaptures.find((c) => c.user_slot === 2).image_url
  };
  io.to(code).emit('round-complete', pair);

  if (roundNum < TOTAL_ROUNDS) {
    // auto-advance to the next round after a short breather
    setTimeout(() => {
      setRound(code, roundNum + 1);
      const targetTime = Date.now() + COUNTDOWN_MS;
      io.to(code).emit('countdown-start', { targetTime, round: roundNum + 1, totalRounds: TOTAL_ROUNDS });
    }, ROUND_GAP_MS);
    return res.json({ ok: true });
  }

  // final round done — assemble the full strip
  const { data: allCaptures } = await supabase
    .from('captures').select('*').eq('room_id', room.id);

  const rounds = [];
  for (let r = 1; r <= TOTAL_ROUNDS; r++) {
    const inRound = allCaptures.filter((c) => c.round === r);
    const s1 = inRound.filter((c) => c.user_slot === 1).sort((a, b) => new Date(b.captured_at) - new Date(a.captured_at))[0];
    const s2 = inRound.filter((c) => c.user_slot === 2).sort((a, b) => new Date(b.captured_at) - new Date(a.captured_at))[0];
    if (s1 && s2) rounds.push({ round: r, slot1_url: s1.image_url, slot2_url: s2.image_url });
  }

  const { data: strip, error: stripErr } = await supabase
    .from('strips')
    .insert({ room_id: room.id, rounds })
    .select()
    .single();
  if (stripErr) return res.status(500).json({ error: stripErr.message });

  io.to(code).emit('strip-ready', strip);
  res.json({ ok: true });
});

// ---- Socket.io: room join + synced countdown ----
io.on('connection', (socket) => {
  // used by clients to estimate their clock offset vs server time
  socket.on('ping-time', (_, callback) => {
    callback(Date.now());
  });

  socket.on('join-room', ({ code, name, gender }) => {
    const result = joinRoom(code, socket.id, name, gender);
    if (result.error) {
      socket.emit('join-error', result.error);
      return;
    }
    socket.join(code);
    socket.data.roomCode = code;
    socket.emit('joined', { slot: result.slot });
    
    const room = getRoom(code);
    const users = room ? Array.from(room.sockets.values()) : [];
    io.to(code).emit('occupancy', { count: result.occupants, users });
  });

  socket.on('ready', ({ code }) => {
    const { bothReady } = markReady(code, socket.id);
    if (bothReady) {
      setRound(code, 1);
      const targetTime = Date.now() + COUNTDOWN_MS;
      io.to(code).emit('countdown-start', { targetTime, round: 1, totalRounds: TOTAL_ROUNDS });
      resetReady(code);
    } else {
      socket.to(code).emit('partner-ready');
    }
  });

  socket.on('disconnect', () => {
    const code = socket.data.roomCode;
    if (code) {
      leaveRoom(code, socket.id);
      const room = getRoom(code);
      const users = room ? Array.from(room.sockets.values()) : [];
      io.to(code).emit('occupancy', { count: users.length, users });
    }
  });

  // WebRTC signaling
  socket.on('webrtc-offer', ({ code, offer }) => {
    socket.to(code).emit('webrtc-offer', { offer });
  });

  socket.on('webrtc-answer', ({ code, answer }) => {
    socket.to(code).emit('webrtc-answer', { answer });
  });

  socket.on('webrtc-candidate', ({ code, candidate }) => {
    socket.to(code).emit('webrtc-candidate', { candidate });
  });
});

const PORT = process.env.PORT || 8000;
httpServer.listen(PORT, () => console.log(`SyncBooth backend running on :${PORT}`));
