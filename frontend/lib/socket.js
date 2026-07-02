let socket;

export function getSocket() {
  if (typeof window === 'undefined') {
    return null;
  }
  if (!socket) {
    const { io } = require('socket.io-client');
    socket = io(process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000', {
      transports: ['websocket']
    });
  }
  return socket;
}
