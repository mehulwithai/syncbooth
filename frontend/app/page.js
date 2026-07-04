'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function Home() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState(false);

  async function createRoom() {
    setLoading(true);
    const res = await fetch(`${BACKEND}/api/rooms`, { method: 'POST' });
    const data = await res.json();
    router.push(`/room/${data.code}`);
  }

  function joinRoom() {
    if (joinCode.trim().length === 6) {
      router.push(`/room/${joinCode.trim().toUpperCase()}`);
    }
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 gap-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-2">SyncBooth 💗</h1>
        <p className="text-white/60">On Someone's Demand...</p>
      </div>

      <button
        onClick={createRoom}
        disabled={loading}
        className="bg-pink-500 hover:bg-pink-400 transition rounded-full px-8 py-3 font-semibold"
      >
        {loading ? 'Creating...' : 'Start a session'}
      </button>

      <div className="flex items-center gap-2 w-full max-w-xs">
        <div className="h-px bg-white/20 flex-1" />
        <span className="text-white/40 text-sm">or join</span>
        <div className="h-px bg-white/20 flex-1" />
      </div>

      <div className="flex gap-2 w-full max-w-xs">
        <input
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          maxLength={6}
          placeholder="ENTER CODE"
          className="flex-1 bg-white/10 rounded-lg px-4 py-2 text-center tracking-widest uppercase outline-none"
        />
        <button
          onClick={joinRoom}
          className="bg-white/20 hover:bg-white/30 transition rounded-lg px-4"
        >
          Join
        </button>
      </div>
    </main>
  );
}
