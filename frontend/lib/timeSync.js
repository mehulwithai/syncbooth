// Estimates the offset between this client's clock and the server's clock,
// so that a shared "targetTime" (in server time) can be converted into
// an accurate local setTimeout delay, compensating for network latency.

export async function estimateServerOffset(socket, samples = 5) {
  const offsets = [];

  for (let i = 0; i < samples; i++) {
    const t0 = Date.now();
    // eslint-disable-next-line no-await-in-loop
    const serverTime = await new Promise((resolve) => {
      socket.emit('ping-time', null, (serverNow) => resolve(serverNow));
    });
    const t1 = Date.now();
    const rtt = t1 - t0;
    const estimatedServerNow = serverTime + rtt / 2;
    offsets.push(estimatedServerNow - t1);
  }

  // median offset is more robust to one slow sample than mean
  offsets.sort((a, b) => a - b);
  return offsets[Math.floor(offsets.length / 2)];
}

// Given a target server-time timestamp and our known offset,
// return ms to wait locally before firing the capture.
export function msUntilTarget(targetServerTime, offsetMs) {
  const localEquivalent = targetServerTime - offsetMs;
  return Math.max(0, localEquivalent - Date.now());
}
