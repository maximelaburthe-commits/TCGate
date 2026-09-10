'use strict';

const { spawn } = require('child_process');

const PORT = 4337;
const BASE = `http://127.0.0.1:${PORT}`;
const server = spawn(process.execPath, ['server.js'], {
  cwd: __dirname,
  env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1' },
  stdio: ['ignore', 'pipe', 'pipe']
});
let output = '';
server.stdout.on('data', data => { output += data; });
server.stderr.on('data', data => { output += data; });

const assert = (condition, message) => { if (!condition) throw new Error(message); };
async function waitForServer() {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(`${BASE}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(`Server unavailable: ${output}`);
}
async function request(pathname, method, body, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return fetch(`${BASE}${pathname}`, { method, headers, body: JSON.stringify(body) });
}
async function waitForRoomState(reader, predicate, controller) {
  const decoder = new TextDecoder();
  let buffer = '';
  const timeout = setTimeout(() => controller.abort(), 2500);
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) throw new Error('SSE stream ended before expected room-state');
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop();
      for (const event of events) {
        if (!event.includes('event: room-state')) continue;
        const data = event.split('\n').find(line => line.startsWith('data: '));
        if (data) {
          const snapshot = JSON.parse(data.slice(6));
          if (predicate(snapshot)) return snapshot;
        }
      }
    }
  } finally {
    clearTimeout(timeout);
  }
}

(async () => {
  const controller = new AbortController();
  try {
    await waitForServer();
    const createdResponse = await request('/api/rooms', 'POST', { name: 'Joueur', game: 'cyberpunk' });
    assert(createdResponse.status === 201, 'Immediate Host room creation failed');
    const host = await createdResponse.json();
    assert(host.code && host.peerId && host.sessionToken && host.role === 'host', 'Host session is incomplete');

    const joinedResponse = await request(`/api/rooms/${host.code}/join`, 'POST', { name: 'Invite' });
    assert(joinedResponse.ok, 'Guest join failed');
    const guest = await joinedResponse.json();

    const ticketResponse = await request('/api/events-ticket', 'POST', { room: host.code, peerId: guest.peerId }, guest.sessionToken);
    const ticket = await ticketResponse.json();
    const stream = await fetch(`${BASE}/api/events?ticket=${encodeURIComponent(ticket.ticket)}`, { signal: controller.signal });
    const reader = stream.body.getReader();
    await waitForRoomState(reader, snapshot => snapshot.code === host.code, controller);

    const hostPatchResponse = await request(`/api/rooms/${host.code}`, 'PATCH', {
      peerId: host.peerId,
      name: 'Host Renomme',
      game: 'no-game'
    }, host.sessionToken);
    assert(hostPatchResponse.ok, 'Host metadata update failed');
    const propagated = await waitForRoomState(reader, snapshot =>
      snapshot.game === 'no-game' && snapshot.peers.some(peer => peer.id === host.peerId && peer.name === 'Host Renomme'), controller);
    assert(propagated.game === 'no-game', 'Guest SSE did not receive the game update');

    const forbiddenGame = await request(`/api/rooms/${host.code}`, 'PATCH', {
      peerId: guest.peerId,
      game: 'cyberpunk'
    }, guest.sessionToken);
    assert(forbiddenGame.status === 403, 'Guest was allowed to modify the game');

    const guestName = await request(`/api/rooms/${host.code}`, 'PATCH', {
      peerId: guest.peerId,
      name: 'Guest Renomme'
    }, guest.sessionToken);
    assert(guestName.ok, 'Guest could not modify their own name');
    reader.cancel().catch(() => {});
    console.log('FUTURE_UX_ROOM_METADATA_SSE_OK');
  } catch (error) {
    console.error(error.stack || error);
    process.exitCode = 1;
  } finally {
    controller.abort();
    server.kill('SIGTERM');
    setTimeout(() => server.kill('SIGKILL'), 1000).unref();
  }
})();
