
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = path.join(__dirname, 'public');
const MODEL_FILE = path.join(__dirname, 'models', 'card_detector_v53_512.onnx');
const MODEL_ROUTE = '/api/model/card-detector-v53-512-alpha9p1.onnx';

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.json': 'application/json; charset=utf-8',
  '.onnx': 'application/octet-stream'
};

const rooms = new Map();
const ROOM_TTL_MS = 4 * 60 * 60 * 1000;
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ALLOWED_GAMES = new Set(['cyberpunk', 'no-game']);

const FALLBACK_ICE_SERVERS = [
  { urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }
];
const CLOUDFLARE_TURN_KEY_ID = String(process.env.CLOUDFLARE_TURN_KEY_ID || '').trim();
const CLOUDFLARE_TURN_API_TOKEN = String(process.env.CLOUDFLARE_TURN_KEY_API_TOKEN || process.env.CLOUDFLARE_TURN_API_TOKEN || '').trim();
const TURN_CONFIGURED = Boolean(CLOUDFLARE_TURN_KEY_ID && CLOUDFLARE_TURN_API_TOKEN);
const TURN_TTL_SECONDS = Math.max(3600, Math.min(86400, Number(process.env.TCGATE_TURN_TTL_SECONDS || 21600) || 21600));
const ICE_TRANSPORT_POLICY = String(process.env.TCGATE_ICE_TRANSPORT_POLICY || 'all').toLowerCase() === 'relay' ? 'relay' : 'all';
const turnCredentialCache = new Map();

async function generateCloudflareTurnIceServers(peerKey) {
  if (!TURN_CONFIGURED) return null;
  const cached = turnCredentialCache.get(peerKey);
  if (cached && cached.expiresAtMs - Date.now() > 5 * 60 * 1000) return cached;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(CLOUDFLARE_TURN_KEY_ID)}/credentials/generate-ice-servers`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_TURN_API_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ttl: TURN_TTL_SECONDS }),
        signal: controller.signal
      }
    );
    if (!response.ok) throw new Error(`Cloudflare TURN HTTP ${response.status}`);
    const payload = await response.json();
    if (!Array.isArray(payload?.iceServers) || payload.iceServers.length < 2) {
      throw new Error('Réponse TURN Cloudflare invalide');
    }
    const record = {
      iceServers: payload.iceServers,
      expiresAtMs: Date.now() + TURN_TTL_SECONDS * 1000,
      issuedAtMs: Date.now()
    };
    turnCredentialCache.set(peerKey, record);
    return record;
  } finally {
    clearTimeout(timeout);
  }
}

async function rtcConfigForPeer(peerKey) {
  if (!TURN_CONFIGURED) {
    return {
      iceServers: FALLBACK_ICE_SERVERS,
      iceTransportPolicy: 'all',
      turn: {
        configured: false,
        available: false,
        provider: null,
        policy: 'all',
        expiresAt: null,
        reason: 'cloudflare-env-missing'
      }
    };
  }

  try {
    const turn = await generateCloudflareTurnIceServers(peerKey);
    return {
      iceServers: turn.iceServers,
      iceTransportPolicy: ICE_TRANSPORT_POLICY,
      turn: {
        configured: true,
        available: true,
        provider: 'cloudflare-realtime-turn',
        policy: ICE_TRANSPORT_POLICY,
        expiresAt: new Date(turn.expiresAtMs).toISOString(),
        reason: null
      }
    };
  } catch (err) {
    console.error('[turn] génération credentials impossible:', err?.message || String(err));
    if (ICE_TRANSPORT_POLICY === 'relay') {
      return {
        iceServers: [],
        iceTransportPolicy: 'relay',
        turn: {
          configured: true,
          available: false,
          provider: 'cloudflare-realtime-turn',
          policy: 'relay',
          expiresAt: null,
          reason: 'credential-generation-failed'
        }
      };
    }
    return {
      iceServers: FALLBACK_ICE_SERVERS,
      iceTransportPolicy: 'all',
      turn: {
        configured: true,
        available: false,
        provider: 'cloudflare-realtime-turn',
        policy: 'all',
        expiresAt: null,
        reason: 'credential-generation-failed'
      }
    };
  }
}

function makeCode() {
  for (let tries = 0; tries < 100; tries++) {
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    if (!rooms.has(code)) return code;
  }
  throw new Error('Impossible de générer un code de salon');
}

function peerId() {
  return crypto.randomBytes(12).toString('hex');
}

function sendJson(res, status, body) {
  const payload = Buffer.from(JSON.stringify(body));
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': payload.length,
    'Cache-Control': 'no-store'
  });
  res.end(payload);
}

async function readJson(req) {
  return await new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 256 * 1024) {
        reject(new Error('Payload too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); }
      catch { reject(new Error('JSON invalide')); }
    });
    req.on('error', reject);
  });
}

function publicPeer(peer) {
  return {
    id: peer.id,
    role: peer.role,
    name: peer.name || 'Joueur',
    ready: Boolean(peer.ready),
    connected: Boolean(peer.sse)
  };
}

function roomSnapshot(room) {
  return {
    code: room.code,
    game: room.game,
    createdAt: room.createdAt,
    peers: [...room.peers.values()].map(publicPeer)
  };
}

function sseSend(res, event, data) {
  if (!res || res.writableEnded || res.destroyed) return false;
  try {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    return true;
  } catch {
    return false;
  }
}

function broadcast(room, event, data, exceptPeerId = null) {
  for (const peer of room.peers.values()) {
    if (peer.id === exceptPeerId) continue;
    sseSend(peer.sse, event, data);
  }
}

function broadcastRoomState(room) {
  broadcast(room, 'room-state', roomSnapshot(room));
}

function getRoom(code) {
  return rooms.get(String(code || '').toUpperCase()) || null;
}

function getPeer(room, id) {
  return room?.peers.get(String(id || '')) || null;
}

function removePeer(room, id, reason = 'leave') {
  const peer = getPeer(room, id);
  if (!peer) return;
  try { peer.sse?.end(); } catch {}
  room.peers.delete(id);
  turnCredentialCache.delete(id);
  broadcast(room, 'peer-left', { peerId: id, reason });
  if (room.peers.size === 0) {
    rooms.delete(room.code);
  } else {
    for (const p of room.peers.values()) p.ready = false;
    broadcastRoomState(room);
  }
}

function staticFile(req, res, pathname) {
  let requestPath = pathname;
  if (requestPath === '/') requestPath = '/index.html';
  const file = path.normalize(path.join(ROOT, requestPath));
  if (!file.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end('Not found');
    }
    res.writeHead(200, {
      'Content-Type': mime[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  try {
    if (req.method === 'GET' && pathname === '/api/health') {
      return sendJson(res, 200, {
        ok: true,
        version: 'tcgate-alpha-0.1-candidate-8',
        rooms: rooms.size,
        uptimeSeconds: Math.round(process.uptime()),
        railway: Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID),
        turn: {
          provider: 'cloudflare-realtime-turn',
          configured: TURN_CONFIGURED,
          iceTransportPolicy: ICE_TRANSPORT_POLICY,
          ttlSeconds: TURN_TTL_SECONDS,
          cachedCredentials: turnCredentialCache.size
        },
        vision: {
          integrated: true,
          modelPresent: fs.existsSync(MODEL_FILE),
          modelBytes: fs.existsSync(MODEL_FILE) ? fs.statSync(MODEL_FILE).size : 0,
          model: 'Vision V5.3 / 512',
          stateEngine: '0.1.6-facewebcam-memory-hover',
          identification: '0.2.4-alpha21-full-handoff-dedup-memory-api'
        }
      });
    }

if (req.method === 'GET' && pathname === MODEL_ROUTE) {
  fs.stat(MODEL_FILE,(err,stat)=>{
    if(err || !stat.isFile()){
      return sendJson(res,500,{ok:false,error:'Modèle Vision alpha15 absent.'});
    }
    res.writeHead(200,{
      'Content-Type':'application/octet-stream',
      'Content-Length':stat.size,
      'Cache-Control':'no-store, max-age=0',
      'X-Content-Type-Options':'nosniff'
    });
    fs.createReadStream(MODEL_FILE).pipe(res);
  });
  return;
}


    if (req.method === 'GET' && pathname === '/api/rtc-config') {
      const room = getRoom(url.searchParams.get('room'));
      const peer = getPeer(room, url.searchParams.get('peer'));
      if (!room || !peer) return sendJson(res, 404, { ok: false, error: 'Session inconnue' });
      peer.lastSeen = Date.now();
      const config = await rtcConfigForPeer(peer.id);
      return sendJson(res, 200, { ok: true, ...config });
    }

    if (req.method === 'POST' && pathname === '/api/rooms') {
      const body = await readJson(req);
      const code = makeCode();
      const id = peerId();
      const room = {
        code,
        game: ALLOWED_GAMES.has(String(body.game || '')) ? String(body.game) : 'cyberpunk',
        createdAt: Date.now(),
        peers: new Map()
      };
      room.peers.set(id, {
        id,
        role: 'host',
        name: String(body.name || 'Joueur').slice(0, 24),
        ready: false,
        sse: null,
        lastSeen: Date.now()
      });
      rooms.set(code, room);
      return sendJson(res, 201, {
        ok: true,
        code,
        peerId: id,
        role: 'host',
        room: roomSnapshot(room)
      });
    }

    const joinMatch = pathname.match(/^\/api\/rooms\/([A-Z0-9]+)\/join$/i);
    if (req.method === 'POST' && joinMatch) {
      const code = joinMatch[1].toUpperCase();
      const room = getRoom(code);
      if (!room) return sendJson(res, 404, { ok: false, error: 'Salon introuvable' });
      if (room.peers.size >= 2) return sendJson(res, 409, { ok: false, error: 'Salon complet' });

      const body = await readJson(req);
      const id = peerId();
      room.peers.set(id, {
        id,
        role: 'guest',
        name: String(body.name || 'Joueur').slice(0, 24),
        ready: false,
        sse: null,
        lastSeen: Date.now()
      });

      broadcast(room, 'peer-joined', { peer: publicPeer(room.peers.get(id)) }, id);
      broadcastRoomState(room);

      return sendJson(res, 200, {
        ok: true,
        code,
        peerId: id,
        role: 'guest',
        room: roomSnapshot(room)
      });
    }

    if (req.method === 'GET' && pathname === '/api/events') {
      const room = getRoom(url.searchParams.get('room'));
      const peer = getPeer(room, url.searchParams.get('peer'));
      if (!room || !peer) return sendJson(res, 404, { ok: false, error: 'Session inconnue' });

      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no'
      });
      res.write(': connected\n\n');

      if (peer.sse && peer.sse !== res) {
        try { peer.sse.end(); } catch {}
      }
      peer.sse = res;
      peer.lastSeen = Date.now();

      sseSend(res, 'room-state', roomSnapshot(room));
      broadcastRoomState(room);

      req.on('close', () => {
        if (peer.sse === res) {
          peer.sse = null;
          peer.lastSeen = Date.now();
          broadcastRoomState(room);
        }
      });
      return;
    }

    const stateMatch = pathname.match(/^\/api\/rooms\/([A-Z0-9]+)\/state$/i);
    if (req.method === 'GET' && stateMatch) {
      const room = getRoom(stateMatch[1]);
      const peer = getPeer(room, url.searchParams.get('peer'));
      if (!room || !peer) return sendJson(res, 404, { ok: false, error: 'Session inconnue' });
      peer.lastSeen = Date.now();
      return sendJson(res, 200, { ok: true, room: roomSnapshot(room) });
    }

    if (req.method === 'POST' && pathname === '/api/ready') {
      const body = await readJson(req);
      const room = getRoom(body.room);
      const peer = getPeer(room, body.peerId);
      if (!room || !peer) return sendJson(res, 404, { ok: false, error: 'Session inconnue' });
      peer.ready = Boolean(body.ready);
      peer.lastSeen = Date.now();
      broadcastRoomState(room);
      return sendJson(res, 200, { ok: true, room: roomSnapshot(room) });
    }

    if (req.method === 'POST' && pathname === '/api/signal') {
      const body = await readJson(req);
      const room = getRoom(body.room);
      const from = getPeer(room, body.from);
      if (!room || !from) return sendJson(res, 404, { ok: false, error: 'Session inconnue' });

      from.lastSeen = Date.now();
      const envelope = {
        from: from.id,
        fromRole: from.role,
        type: body.type,
        payload: body.payload ?? null,
        at: Date.now()
      };

      let delivered = 0;
      for (const peer of room.peers.values()) {
        if (peer.id === from.id) continue;
        if (body.to && peer.id !== body.to) continue;
        if (sseSend(peer.sse, 'signal', envelope)) delivered++;
      }
      return sendJson(res, 200, { ok: true, delivered });
    }

    if (req.method === 'POST' && pathname === '/api/leave') {
      const body = await readJson(req);
      const room = getRoom(body.room);
      if (room) removePeer(room, body.peerId, 'leave');
      return sendJson(res, 200, { ok: true });
    }

    staticFile(req, res, pathname);
  } catch (err) {
    console.error(err);
    if (!res.headersSent) sendJson(res, 500, { ok: false, error: err.message || 'Erreur serveur' });
    else res.end();
  }
});

setInterval(() => {
  const now = Date.now();
  for (const room of rooms.values()) {
    if (now - room.createdAt > ROOM_TTL_MS) {
      for (const peer of room.peers.values()) {
        try { peer.sse?.end(); } catch {}
      }
      rooms.delete(room.code);
      continue;
    }

    for (const peer of room.peers.values()) {
      if (peer.sse) sseSend(peer.sse, 'ping', { at: now });
    }
  }
}, 15000).unref();


function gracefulShutdown(signal) {
  console.log(`[shutdown] ${signal} reçu, fermeture propre...`);
  for (const room of rooms.values()) {
    for (const peer of room.peers.values()) {
      try {
        sseSend(peer.sse, 'server-shutdown', { signal });
        peer.sse?.end();
      } catch {}
    }
  }

  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 8000).unref();
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

server.listen(PORT, HOST, () => {
  console.log(`TCGate Alpha 0.1 Candidate 8 -> http://127.0.0.1:${PORT}`);
  const nets = os.networkInterfaces();
  for (const entries of Object.values(nets)) {
    for (const net of entries || []) {
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`Réseau local     -> http://${net.address}:${PORT}`);
      }
    }
  }
  console.log('Note: caméra/micro nécessitent HTTPS hors localhost dans les navigateurs modernes.');
});
