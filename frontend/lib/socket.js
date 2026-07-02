import { io } from 'socket.io-client';

let socket;

export function getSocket() {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_BACKEND_URL, { transports: ['websocket'] });
  }
  return socket;
}
