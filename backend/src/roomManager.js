// In-memory map of active room socket state.
// rooms table in Supabase is the source of truth for persistence;
// this map just tracks who's connected right now for sync signaling.

const activeRooms = new Map();
// roomCode -> { sockets: Map(socketId -> slot), readyCount: number }

export function joinRoom(roomCode, socketId, name, gender) {
  if (!activeRooms.has(roomCode)) {
    activeRooms.set(roomCode, { sockets: new Map(), ready: new Set(), round: 0 });
  }
  const room = activeRooms.get(roomCode);

  // if this exact socket already joined (e.g. React StrictMode double-effect,
  // or a dev hot-reload), just return its existing slot instead of reassigning
  if (room.sockets.has(socketId)) {
    const existing = room.sockets.get(socketId);
    return { slot: existing.slot, occupants: room.sockets.size };
  }

  if (room.sockets.size >= 2) {
    return { error: 'Room is full' };
  }

  const existingOccupants = Array.from(room.sockets.values());
  const isMaleTaken = existingOccupants.some((u) => u.gender === 'Male');
  const isFemaleTaken = existingOccupants.some((u) => u.gender === 'Female');

  let slot;
  if (gender === 'Male') {
    if (isMaleTaken) {
      return { error: 'Male role is already taken in this room' };
    }
    slot = 1;
  } else if (gender === 'Female') {
    if (isFemaleTaken) {
      return { error: 'Female role is already taken in this room' };
    }
    slot = 2;
  } else {
    // fallback if no gender provided
    slot = isMaleTaken ? 2 : 1;
  }

  room.sockets.set(socketId, { slot, name, gender });
  return { slot, occupants: room.sockets.size };
}

export function leaveRoom(roomCode, socketId) {
  const room = activeRooms.get(roomCode);
  if (!room) return;
  room.sockets.delete(socketId);
  room.ready.delete(socketId);
  if (room.sockets.size === 0) activeRooms.delete(roomCode);
}

export function markReady(roomCode, socketId) {
  const room = activeRooms.get(roomCode);
  if (!room) return { bothReady: false };
  room.ready.add(socketId);
  const bothReady = room.ready.size >= 2 && room.sockets.size >= 2;
  return { bothReady, room };
}

export function resetReady(roomCode) {
  const room = activeRooms.get(roomCode);
  if (room) room.ready.clear();
}

export function getRoom(roomCode) {
  return activeRooms.get(roomCode);
}

export function setRound(roomCode, round) {
  const room = activeRooms.get(roomCode);
  if (room) room.round = round;
}

export function getRound(roomCode) {
  return activeRooms.get(roomCode)?.round || 0;
}
