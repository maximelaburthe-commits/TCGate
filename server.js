'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const QRCode = require('./vendor/QRCode');
const QRErrorCorrectLevel = require('./vendor/QRCode/QRErrorCorrectLevel');

const PORT = Number(process.env.PORT || 4173);
const HOST = process.env.HOST || '0.0.0.0';
const ROOT = path.join(__dirname, 'public');
const MODEL_FILE = path.join(__dirname, 'models', 'card_detector_v53_512.onnx');
const MODEL_ROUTE = '/api/model/card-detector-v53-512-alpha9p1.onnx';
const VERSION = 'tcgate-alpha-0.1-candidate-11';

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
const eventTickets = new Map();
const recoveryIndex = new Map();
const rateBuckets = new Map();
const phonePairs = new Map();
const phoneEventTickets = new Map();
const ROOM_TTL_MS = 4 * 60 * 60 * 1000;
const DISCONNECTED_PEER_GRACE_MS = 5 * 60 * 1000;
const EVENT_TICKET_TTL_MS = 30 * 1000;
const PHONE_PAIRING_TTL_MS = Math.max(50, Number(process.env.TCGATE_PHONE_PAIRING_TTL_MS || 5 * 60 * 1000));
const PHONE_SESSION_TTL_MS = 4 * 60 * 60 * 1000;
const PHONE_REPORT_LIMIT_BYTES = 96 * 1024;
const PHONE_SIGNAL_TYPES = new Set(['offer', 'answer', 'candidate', 'restart-request', 'reset', 'reset-peer', 'control', 'control-result', 'control-state']);
const RECOVERY_COOKIE_NAME = 'tcgate_recovery';
const BODY_LIMIT_BYTES = 64 * 1024;
const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ALLOWED_GAMES = new Set(['cyberpunk', 'no-game']);
const ALLOWED_SIGNAL_TYPES = new Set(['offer', 'answer', 'candidate', 'media-state', 'restart-request', 'gig-state']);

const FALLBACK_ICE_SERVERS = [
  { urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }
];
const CLOUDFLARE_TURN_KEY_ID = String(process.env.CLOUDFLARE_TURN_KEY_ID || '').trim();
const CLOUDFLARE_TURN_API_TOKEN = String(process.env.CLOUDFLARE_TURN_KEY_API_TOKEN || process.env.CLOUDFLARE_TURN_API_TOKEN || '').trim();
const TURN_CONFIGURED = Boolean(CLOUDFLARE_TURN_KEY_ID && CLOUDFLARE_TURN_API_TOKEN);
const TURN_TTL_SECONDS = Math.max(3600, Math.min(86400, Number(process.env.TCGATE_TURN_TTL_SECONDS || 21600) || 21600));
const ICE_TRANSPORT_POLICY = String(process.env.TCGATE_ICE_TRANSPORT_POLICY || 'all').toLowerCase() === 'relay' ? 'relay' : 'all';
const turnCredentialCache = new Map();

function securityHeaders(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), fullscreen=(self), screen-wake-lock=(self)');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; " +
    "script-src 'self' 'wasm-unsafe-eval' https://cdn.jsdelivr.net; worker-src 'self' blob:; " +
    "connect-src 'self' https://raw.githubusercontent.com https://cdn.jsdelivr.net https://rtc.live.cloudflare.com; " +
    "img-src 'self' data: blob: https://raw.githubusercontent.com https://cdn.jsdelivr.net; " +
    "style-src 'self'; media-src 'self' blob:"
  );
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  if (req.socket.encrypted || proto === 'https') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  }
}

function requestFingerprint(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const remote = String(req.socket.remoteAddress || 'unknown');
  return crypto.createHash('sha256').update(`${forwarded}|${remote}`).digest('hex').slice(0, 24);
}

function rateLimit(req, res, scope, limit, windowMs) {
  const key = `${scope}:${requestFingerprint(req)}`;
  const now = Date.now();
  let bucket = rateBuckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    rateBuckets.set(key, bucket);
  }
  bucket.count += 1;
  res.setHeader('X-RateLimit-Limit', String(limit));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, limit - bucket.count)));
  if (bucket.count <= limit) return true;
  res.setHeader('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
  sendJson(res, 429, { ok: false, error: 'Trop de requêtes. Réessaie dans un instant.' });
  return false;
}

function sessionRateLimit(res, peer, scope, limit, windowMs) {
  const key = `${scope}:peer:${peer.id}`;
  const now = Date.now();
  let bucket = rateBuckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    rateBuckets.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count <= limit) return true;
  res.setHeader('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
  sendJson(res, 429, { ok: false, error: 'Trop de requêtes pour cette session.' });
  return false;
}

function sameOriginRequest(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    const u = new URL(origin);
    return u.host === req.headers.host;
  } catch {
    return false;
  }
}

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
    for (let i = 0; i < 6; i++) code += alphabet[crypto.randomInt(alphabet.length)];
    if (!rooms.has(code)) return code;
  }
  throw new Error('Impossible de générer un code de salon');
}

function peerId() {
  return crypto.randomBytes(12).toString('hex');
}

function sessionToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function tokenHash(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest();
}

function tokenMatches(peer, token) {
  if (!peer?.authHash || !token) return false;
  const candidate = tokenHash(token);
  return candidate.length === peer.authHash.length && crypto.timingSafeEqual(candidate, peer.authHash);
}

function bearerToken(req) {
  const auth = String(req.headers.authorization || '');
  return auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
}

function recoveryToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function recoveryKey(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function parseCookies(req) {
  const out = {};
  const raw = String(req.headers.cookie || '');
  for (const part of raw.split(';')) {
    const index = part.indexOf('=');
    if (index <= 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!key) continue;
    try { out[key] = decodeURIComponent(value); }
    catch { out[key] = value; }
  }
  return out;
}

function isHttpsRequest(req) {
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  return Boolean(req.socket.encrypted || proto === 'https');
}

function setRecoveryCookie(req, res, token) {
  const attrs = [
    `${RECOVERY_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${Math.floor(ROOM_TTL_MS / 1000)}`
  ];
  if (isHttpsRequest(req)) attrs.push('Secure');
  res.setHeader('Set-Cookie', attrs.join('; '));
}

function clearRecoveryCookie(req, res) {
  const attrs = [
    `${RECOVERY_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    'Max-Age=0'
  ];
  if (isHttpsRequest(req)) attrs.push('Secure');
  res.setHeader('Set-Cookie', attrs.join('; '));
}

function attachRecoveryCredential(req, res, room, peer) {
  if (peer.recoveryKey) recoveryIndex.delete(peer.recoveryKey);
  const token = recoveryToken();
  const key = recoveryKey(token);
  peer.recoveryKey = key;
  recoveryIndex.set(key, { roomCode: room.code, peerId: peer.id });
  setRecoveryCookie(req, res, token);
}

function recoveryPeerFromCookie(req) {
  const token = parseCookies(req)[RECOVERY_COOKIE_NAME];
  if (!token) return null;
  const record = recoveryIndex.get(recoveryKey(token));
  if (!record) return null;
  const room = getRoom(record.roomCode);
  const peer = getPeer(room, record.peerId);
  if (!room || !peer || peer.recoveryKey !== recoveryKey(token)) return null;
  return { room, peer };
}

function sanitizeName(value) {
  return String(value || 'Joueur')
    .normalize('NFKC')
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .trim()
    .slice(0, 24) || 'Joueur';
}

function normalizeRoomCode(value) {
  const code = String(value || '').trim().toUpperCase();
  return /^[A-HJ-NP-Z2-9]{6}$/.test(code) ? code : '';
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

async function readJson(req, maxBytes = BODY_LIMIT_BYTES) {
  return await new Promise((resolve, reject) => {
    let raw = '';
    let bytes = 0;
    req.setEncoding('utf8');
    req.on('data', chunk => {
      bytes += Buffer.byteLength(chunk, 'utf8');
      if (bytes > maxBytes) {
        reject(Object.assign(new Error('Payload too large'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      raw += chunk;
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); }
      catch { reject(Object.assign(new Error('JSON invalide'), { statusCode: 400 })); }
    });
    req.on('error', reject);
  });
}

function secureToken() { return crypto.randomBytes(32).toString('base64url'); }
function opaqueId() { return crypto.randomBytes(18).toString('base64url'); }
function qrSvg(text) {
  const qr = new QRCode(-1, QRErrorCorrectLevel.M);
  qr.addData(text);
  qr.make();
  const count = qr.getModuleCount();
  const quiet = 4;
  const cells = [];
  for (let y = 0; y < count; y++) for (let x = 0; x < count; x++) {
    if (qr.isDark(y, x)) cells.push(`<rect x="${x + quiet}" y="${y + quiet}" width="1" height="1"/>`);
  }
  const size = count + quiet * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="white"/><g fill="black">${cells.join('')}</g></svg>`;
}

function requestOrigin(req) {
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() || (req.socket.encrypted ? 'https' : 'http');
  return `${proto}://${req.headers.host}`;
}

function phonePairFromPath(pathname) {
  const match = pathname.match(/^\/api\/phone\/pairs\/([A-Za-z0-9_-]{20,32})(?:\/(join|events-ticket|rtc-config|signal|state|report))?$/);
  return match ? { pair: phonePairs.get(match[1]) || null, pairId: match[1], action: match[2] || '' } : null;
}

function phonePcPeer(req, pair) {
  const room = getRoom(pair?.roomCode);
  const peer = authenticatedPeer(req, room, pair?.peerId);
  return room && peer ? peer : null;
}

function phoneAuthorized(req, pair) {
  return Boolean(pair?.phoneAuthHash && tokenMatches({ authHash: pair.phoneAuthHash }, bearerToken(req)));
}

function closePhonePair(pair, reason = 'dissociated') {
  if (!pair) return;
  try { pair.pcSse?.end(); } catch {}
  try { pair.phoneSse?.end(); } catch {}
  pair.pcSse = null;
  pair.phoneSse = null;
  pair.closedAt = Date.now();
  pair.closeReason = reason;
  phonePairs.delete(pair.id);
}

function safeDiagnosticValue(value, depth = 0) {
  if (depth > 5) return null;
  if (value == null || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') return /^(data:|blob:)/i.test(value) || value.length > 1000 ? null : value;
  if (Array.isArray(value)) return value.slice(-120).map(item => safeDiagnosticValue(item, depth + 1));
  if (typeof value !== 'object') return null;
  const out = {};
  for (const [key, item] of Object.entries(value).slice(0, 80)) {
    if (/^(sdp|candidate|image|frame|video|audio|screenshot|token|authorization|deviceId|groupId)$/i.test(key)) continue;
    out[key] = safeDiagnosticValue(item, depth + 1);
  }
  return out;
}

function validatePhoneSignal(type, payload) {
  if (!PHONE_SIGNAL_TYPES.has(type)) return false;
  if (type === 'candidate') {
    const candidate = payload?.candidate?.candidate ?? payload?.candidate;
    return typeof candidate === 'string' && candidate.length <= 4096;
  }
  if (type === 'control') {
    return payload && typeof payload === 'object' &&
      typeof payload.requestId === 'string' && payload.requestId.length >= 6 && payload.requestId.length <= 80 &&
      payload.action === 'select-camera' &&
      payload.args && typeof payload.args === 'object' &&
      /^camera-[1-9][0-9]{0,2}$/.test(String(payload.args.cameraId || ''));
  }
  if (!['offer', 'answer'].includes(type)) return payload == null || (typeof payload === 'object' && !Array.isArray(payload));
  const description = payload?.description ?? payload;
  return description && description.type === type && typeof description.sdp === 'string' && description.sdp.length <= 56000;
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
    recoveryEpoch: room.recoveryEpoch || 0,
    phase: room.phase || 'lobby',
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
  const normalized = normalizeRoomCode(code);
  return normalized ? rooms.get(normalized) || null : null;
}

function getPeer(room, id) {
  return room?.peers.get(String(id || '')) || null;
}

function authenticatedPeer(req, room, id) {
  const peer = getPeer(room, id);
  return tokenMatches(peer, bearerToken(req)) ? peer : null;
}

function removePeer(room, id, reason = 'leave') {
  const peer = getPeer(room, id);
  if (!peer) return;
  try { peer.sse?.end(); } catch {}
  room.peers.delete(id);
  if (peer.recoveryKey) recoveryIndex.delete(peer.recoveryKey);
  turnCredentialCache.delete(id);
  for (const pair of [...phonePairs.values()]) {
    if (pair.roomCode === room.code && pair.peerId === id) closePhonePair(pair, `peer-${reason}`);
  }
  broadcast(room, 'peer-left', { peerId: id, reason });
  if (room.peers.size === 0) {
    rooms.delete(room.code);
  } else {
    room.phase = 'lobby';
    for (const p of room.peers.values()) p.ready = false;
    broadcastRoomState(room);
  }
}

function validateSignal(type, payload) {
  if (!ALLOWED_SIGNAL_TYPES.has(type)) return false;
  if (type === 'restart-request') return payload == null || typeof payload === 'object';
  if (type === 'media-state') {
    return payload && typeof payload === 'object' &&
      (payload.cameraEnabled == null || typeof payload.cameraEnabled === 'boolean') &&
      (payload.microphoneEnabled == null || typeof payload.microphoneEnabled === 'boolean');
  }
  if (type === 'gig-state') {
    if (!payload || typeof payload !== 'object') return false;
    if (payload.request === true) return true;
    if (!Array.isArray(payload.dice) || payload.dice.length > 12) return false;
    return payload.dice.every(die => die && typeof die === 'object' &&
      typeof die.id === 'string' && die.id.length <= 32 &&
      (die.origin === 'host' || die.origin === 'guest') &&
      (die.owner === 'host' || die.owner === 'guest') &&
      [4,6,8,10,12,20].includes(Number(die.sides)) &&
      Number.isInteger(Number(die.value)) && Number(die.value) >= 1 && Number(die.value) <= Number(die.sides));
  }
  if (type === 'candidate') {
    return payload && typeof payload === 'object' &&
      typeof payload.candidate === 'string' && payload.candidate.length <= 4096;
  }
  return payload && typeof payload === 'object' && payload.type === type &&
    typeof payload.sdp === 'string' && payload.sdp.length <= 56000;
}

function staticFile(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return sendJson(res, 404, { ok: false, error: 'Route inconnue' });
  }
  const requestPath = pathname === '/' ? '/index.html' : pathname;
  const file = path.resolve(ROOT, `.${requestPath}`);
  const relative = path.relative(ROOT, file);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Forbidden');
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Not found');
    }
    res.writeHead(200, {
      'Content-Type': mime[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    if (req.method === 'HEAD') return res.end();
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  securityHeaders(req, res);
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  try {
    if (req.method === 'POST' && !sameOriginRequest(req)) {
      return sendJson(res, 403, { ok: false, error: 'Origine refusée' });
    }

    if (req.method === 'GET' && pathname === '/api/health') {
      return sendJson(res, 200, { ok: true, version: VERSION });
    }

    if (req.method === 'GET' && pathname === '/phone') {
      return staticFile(req, res, '/phone.html');
    }

    if (req.method === 'GET' && pathname === '/api/phone/events') {
      const ticket = String(url.searchParams.get('ticket') || '');
      const record = phoneEventTickets.get(ticket);
      phoneEventTickets.delete(ticket);
      const pair = record ? phonePairs.get(record.pairId) : null;
      if (!record || !pair || record.expiresAt < Date.now()) return sendJson(res, 401, { ok: false, error: 'Ticket téléphone invalide' });
      res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
      res.write(': connected\n\n');
      const key = record.role === 'phone' ? 'phoneSse' : 'pcSse';
      if (pair[key] && pair[key] !== res) { try { pair[key].end(); } catch {} }
      pair[key] = res;
      pair.lastSeenAt = Date.now();
      sseSend(res, 'phone-pair-state', { joined: Boolean(pair.phoneAuthHash), connected: Boolean(pair.phoneSse), cameraActive: Boolean(pair.phoneState?.cameraActive) });
      sseSend(record.role === 'phone' ? pair.pcSse : pair.phoneSse, 'phone-pair-state', { joined: Boolean(pair.phoneAuthHash), connected: true, cameraActive: Boolean(pair.phoneState?.cameraActive) });
      req.on('close', () => {
        if (pair[key] !== res) return;
        pair[key] = null;
        pair.lastSeenAt = Date.now();
        sseSend(record.role === 'phone' ? pair.pcSse : pair.phoneSse, 'phone-pair-state', { joined: Boolean(pair.phoneAuthHash), connected: false, cameraActive: false });
      });
      return;
    }

    if (req.method === 'GET' && pathname === '/api/phone/pairs/current') {
      const room = getRoom(url.searchParams.get('room'));
      const peer = authenticatedPeer(req, room, url.searchParams.get('peer'));
      if (!room || !peer) return sendJson(res, 401, { ok: false, error: 'Session PC inconnue' });
      if (!sessionRateLimit(res, peer, 'phone-pair-current', 60, 60 * 1000)) return;
      const pair = [...phonePairs.values()].find(candidate =>
        candidate.roomCode === room.code &&
        candidate.peerId === peer.id &&
        candidate.phoneAuthHash &&
        candidate.phoneSessionExpiresAt > Date.now()
      );
      if (!pair) return sendJson(res, 200, { ok: true, available: false });
      return sendJson(res, 200, {
        ok: true,
        available: true,
        pairId: pair.id,
        joined: true,
        connected: Boolean(pair.phoneSse),
        cameraActive: Boolean(pair.phoneState?.cameraActive),
        state: pair.phoneState || null
      });
    }

    if (req.method === 'POST' && pathname === '/api/phone/pairs') {
      const body = await readJson(req);
      const room = getRoom(body.room);
      const peer = authenticatedPeer(req, room, body.peerId);
      if (!room || !peer) return sendJson(res, 401, { ok: false, error: 'Session PC inconnue' });
      if (!sessionRateLimit(res, peer, 'phone-pair-create', 6, 60 * 1000)) return;
      for (const existing of [...phonePairs.values()]) {
        if (existing.roomCode === room.code && existing.peerId === peer.id) closePhonePair(existing, 'replaced');
      }
      const id = opaqueId();
      const pairingToken = secureToken();
      const phoneUrl = `${requestOrigin(req)}/phone?pair=${encodeURIComponent(id)}&token=${encodeURIComponent(pairingToken)}`;
      phonePairs.set(id, {
        id, roomCode: room.code, peerId: peer.id, createdAt: Date.now(), expiresAt: Date.now() + PHONE_PAIRING_TTL_MS,
        pairingHash: tokenHash(pairingToken), pairingConsumedAt: null, phoneAuthHash: null, phoneSessionExpiresAt: null,
        pcSse: null, phoneSse: null, phoneState: null, phoneReport: null, lastSeenAt: Date.now()
      });
      return sendJson(res, 201, { ok: true, pairId: id, phoneUrl, qrSvg: qrSvg(phoneUrl), expiresInMs: PHONE_PAIRING_TTL_MS });
    }

    const phoneRoute = phonePairFromPath(pathname);
    if (phoneRoute) {
      const { pair, action } = phoneRoute;
      if (!pair) return sendJson(res, 404, { ok: false, error: 'Association téléphone inconnue' });
      if (req.method === 'POST' && action === 'join') {
        if (!rateLimit(req, res, 'phone-pair-join', 20, 60 * 1000)) return;
        const supplied = bearerToken(req);
        if (phoneAuthorized(req, pair) && pair.phoneSessionExpiresAt > Date.now()) {
          pair.lastSeenAt = Date.now();
          return sendJson(res, 200, { ok: true, resumed: true, pairId: pair.id });
        }
        if (pair.pairingConsumedAt) return sendJson(res, 409, { ok: false, error: 'Ce lien a déjà été utilisé' });
        if (pair.expiresAt < Date.now()) return sendJson(res, 410, { ok: false, error: 'Ce lien a expiré' });
        if (!tokenMatches({ authHash: pair.pairingHash }, supplied)) return sendJson(res, 401, { ok: false, error: 'Lien invalide' });
        const phoneToken = secureToken();
        pair.pairingConsumedAt = Date.now();
        pair.pairingHash = null;
        pair.phoneAuthHash = tokenHash(phoneToken);
        pair.phoneSessionExpiresAt = Date.now() + PHONE_SESSION_TTL_MS;
        pair.lastSeenAt = Date.now();
        sseSend(pair.pcSse, 'phone-pair-state', { joined: true, connected: false, cameraActive: false });
        return sendJson(res, 200, { ok: true, resumed: false, pairId: pair.id, phoneToken, expiresInMs: PHONE_SESSION_TTL_MS });
      }

      const pcPeer = phonePcPeer(req, pair);
      const isPhone = phoneAuthorized(req, pair) && pair.phoneSessionExpiresAt > Date.now();
      if (req.method === 'DELETE' && !action) {
        if (!pcPeer) return sendJson(res, 401, { ok: false, error: 'Session PC inconnue' });
        closePhonePair(pair, 'pc-dissociated');
        return sendJson(res, 200, { ok: true });
      }
      if (req.method === 'GET' && !action) {
        if (!pcPeer) return sendJson(res, 401, { ok: false, error: 'Session PC inconnue' });
        return sendJson(res, 200, { ok: true, pairId: pair.id, joined: Boolean(pair.phoneAuthHash), connected: Boolean(pair.phoneSse), cameraActive: Boolean(pair.phoneState?.cameraActive) });
      }
      if (req.method === 'POST' && action === 'events-ticket') {
        const body = await readJson(req);
        const role = body.role === 'phone' ? 'phone' : 'pc';
        if ((role === 'phone' && !isPhone) || (role === 'pc' && !pcPeer)) return sendJson(res, 401, { ok: false, error: 'Session téléphone inconnue' });
        const ticket = opaqueId();
        phoneEventTickets.set(ticket, { pairId: pair.id, role, expiresAt: Date.now() + EVENT_TICKET_TTL_MS });
        return sendJson(res, 200, { ok: true, ticket, expiresInMs: EVENT_TICKET_TTL_MS });
      }
      if (req.method === 'GET' && action === 'rtc-config') {
        const role = url.searchParams.get('role') === 'phone' ? 'phone' : 'pc';
        if ((role === 'phone' && !isPhone) || (role === 'pc' && !pcPeer)) return sendJson(res, 401, { ok: false, error: 'Session téléphone inconnue' });
        return sendJson(res, 200, { ok: true, ...await rtcConfigForPeer(`phone:${pair.id}:${role}`) });
      }
      if (req.method === 'POST' && action === 'signal') {
        const body = await readJson(req);
        const role = body.role === 'phone' ? 'phone' : 'pc';
        if ((role === 'phone' && !isPhone) || (role === 'pc' && !pcPeer)) return sendJson(res, 401, { ok: false, error: 'Session téléphone inconnue' });
        if (!validatePhoneSignal(body.type, body.payload ?? null)) return sendJson(res, 400, { ok: false, error: 'Signal téléphone invalide' });
        const phoneSignals = new Set(['offer', 'candidate', 'reset-peer', 'control-result', 'control-state']);
        const pcSignals = new Set(['answer', 'candidate', 'restart-request', 'reset', 'control']);
        if (!(role === 'phone' ? phoneSignals : pcSignals).has(body.type)) return sendJson(res, 400, { ok: false, error: 'Signal interdit pour ce rôle' });
        const delivered = sseSend(role === 'phone' ? pair.pcSse : pair.phoneSse, 'signal', { role, type: body.type, payload: body.payload ?? null, at: Date.now() }) ? 1 : 0;
        return sendJson(res, 200, { ok: true, delivered });
      }
      if (action === 'state' && req.method === 'POST') {
        if (!isPhone) return sendJson(res, 401, { ok: false, error: 'Session téléphone inconnue' });
        const body = await readJson(req, 32 * 1024);
        pair.phoneState = safeDiagnosticValue(body.state || {});
        pair.lastSeenAt = Date.now();
        sseSend(pair.pcSse, 'phone-state', { state: pair.phoneState, updatedAt: new Date().toISOString() });
        return sendJson(res, 200, { ok: true });
      }
      if (action === 'state' && req.method === 'GET') {
        if (!pcPeer) return sendJson(res, 401, { ok: false, error: 'Session PC inconnue' });
        return sendJson(res, 200, { ok: true, state: pair.phoneState, updatedAt: pair.lastSeenAt ? new Date(pair.lastSeenAt).toISOString() : null });
      }
      if (action === 'report' && req.method === 'POST') {
        if (!isPhone) return sendJson(res, 401, { ok: false, error: 'Session téléphone inconnue' });
        const body = await readJson(req, PHONE_REPORT_LIMIT_BYTES);
        pair.phoneReport = safeDiagnosticValue(body.report || {});
        pair.lastSeenAt = Date.now();
        return sendJson(res, 200, { ok: true, stored: true });
      }
      if (action === 'report' && req.method === 'GET') {
        if (!pcPeer) return sendJson(res, 401, { ok: false, error: 'Session PC inconnue' });
        return sendJson(res, 200, { ok: true, available: Boolean(pair.phoneReport), report: pair.phoneReport });
      }
      return sendJson(res, 404, { ok: false, error: 'Route téléphone inconnue' });
    }

    if (req.method === 'GET' && pathname === MODEL_ROUTE) {
      fs.stat(MODEL_FILE, (err, stat) => {
        if (err || !stat.isFile()) return sendJson(res, 500, { ok: false, error: 'Modèle Vision absent.' });
        res.writeHead(200, {
          'Content-Type': 'application/octet-stream',
          'Content-Length': stat.size,
          'Cache-Control': 'no-store, max-age=0',
          'X-Content-Type-Options': 'nosniff'
        });
        fs.createReadStream(MODEL_FILE).pipe(res);
      });
      return;
    }

    if (req.method === 'POST' && pathname === '/api/rooms') {
      if (!rateLimit(req, res, 'create-room', 12, 60 * 1000)) return;
      const body = await readJson(req);
      const code = makeCode();
      const id = peerId();
      const token = sessionToken();
      const room = {
        code,
        game: ALLOWED_GAMES.has(String(body.game || '')) ? String(body.game) : 'cyberpunk',
        createdAt: Date.now(),
        recoveryEpoch: 0,
        phase: 'lobby',
        peers: new Map()
      };
      room.peers.set(id, {
        id,
        role: 'host',
        name: sanitizeName(body.name),
        ready: false,
        sse: null,
        lastSeen: Date.now(),
        disconnectedAt: Date.now(),
        authHash: tokenHash(token),
        recoveryKey: null
      });
      rooms.set(code, room);
      attachRecoveryCredential(req, res, room, room.peers.get(id));
      return sendJson(res, 201, {
        ok: true,
        code,
        peerId: id,
        sessionToken: token,
        role: 'host',
        room: roomSnapshot(room)
      });
    }

    const joinMatch = pathname.match(/^\/api\/rooms\/([A-Z0-9]+)\/join$/i);
    if (req.method === 'POST' && joinMatch) {
      if (!rateLimit(req, res, 'join-room', 30, 60 * 1000)) return;
      const code = normalizeRoomCode(joinMatch[1]);
      const room = getRoom(code);
      if (!room) return sendJson(res, 404, { ok: false, error: 'Salon introuvable' });
      if (room.peers.size >= 2) return sendJson(res, 409, { ok: false, error: 'Salon complet' });

      const body = await readJson(req);
      const id = peerId();
      const token = sessionToken();
      room.peers.set(id, {
        id,
        role: 'guest',
        name: sanitizeName(body.name),
        ready: false,
        sse: null,
        lastSeen: Date.now(),
        disconnectedAt: Date.now(),
        authHash: tokenHash(token),
        recoveryKey: null
      });
      attachRecoveryCredential(req, res, room, room.peers.get(id));

      broadcast(room, 'peer-joined', { peer: publicPeer(room.peers.get(id)) }, id);
      broadcastRoomState(room);
      return sendJson(res, 200, {
        ok: true,
        code,
        peerId: id,
        sessionToken: token,
        role: 'guest',
        room: roomSnapshot(room)
      });
    }


    if (req.method === 'GET' && pathname === '/api/recovery-state') {
      if (!rateLimit(req, res, 'recovery-state', 60, 60 * 1000)) return;
      const found = recoveryPeerFromCookie(req);
      if (!found) return sendJson(res, 200, { ok: true, available: false });
      const { room, peer } = found;
      if (!peer.sse && peer.disconnectedAt && Date.now() - peer.disconnectedAt > DISCONNECTED_PEER_GRACE_MS) {
        return sendJson(res, 200, { ok: true, available: false });
      }
      return sendJson(res, 200, {
        ok: true,
        available: true,
        code: room.code,
        role: peer.role,
        name: peer.name,
        game: room.game,
        phase: room.phase || 'lobby'
      });
    }

    if (req.method === 'POST' && pathname === '/api/recover') {
      if (!rateLimit(req, res, 'recover-room', 20, 60 * 1000)) return;
      const found = recoveryPeerFromCookie(req);
      if (!found) return sendJson(res, 401, { ok: false, error: 'Aucune partie récupérable' });
      const { room, peer } = found;
      if (!peer.sse && peer.disconnectedAt && Date.now() - peer.disconnectedAt > DISCONNECTED_PEER_GRACE_MS) {
        return sendJson(res, 410, { ok: false, error: 'Le délai de reprise est dépassé' });
      }

      if (peer.sse) {
        try { peer.sse.end(); } catch {}
        peer.sse = null;
      }
      const token = sessionToken();
      peer.authHash = tokenHash(token);
      peer.lastSeen = Date.now();
      peer.disconnectedAt = Date.now();
      room.recoveryEpoch = (room.recoveryEpoch || 0) + 1;
      broadcast(room, 'room-recovery', {
        recoveryEpoch: room.recoveryEpoch,
        peerId: peer.id,
        phase: room.phase || 'lobby',
        source: 'persistent-recovery'
      });
      broadcastRoomState(room);
      attachRecoveryCredential(req, res, room, peer);

      return sendJson(res, 200, {
        ok: true,
        code: room.code,
        peerId: peer.id,
        sessionToken: token,
        role: peer.role,
        name: peer.name,
        room: roomSnapshot(room)
      });
    }

    if (req.method === 'POST' && pathname === '/api/resume') {
      if (!rateLimit(req, res, 'resume-room', 30, 60 * 1000)) return;
      const body = await readJson(req);
      const room = getRoom(body.room);
      const peer = authenticatedPeer(req, room, body.peerId);
      if (!room || !peer) return sendJson(res, 401, { ok: false, error: 'Session expirée ou invalide' });
      peer.lastSeen = Date.now();
      peer.disconnectedAt = Date.now();
      room.recoveryEpoch = (room.recoveryEpoch || 0) + 1;
      if ((room.phase || 'lobby') !== 'game') {
        for (const p of room.peers.values()) p.ready = false;
      }
      broadcast(room, 'room-recovery', {
        recoveryEpoch: room.recoveryEpoch,
        peerId: peer.id,
        phase: room.phase || 'lobby',
        source: 'session-resume'
      });
      broadcastRoomState(room);
      return sendJson(res, 200, {
        ok: true,
        code: room.code,
        peerId: peer.id,
        role: peer.role,
        name: peer.name,
        room: roomSnapshot(room)
      });
    }

    if (req.method === 'POST' && pathname === '/api/events-ticket') {
      const body = await readJson(req);
      const room = getRoom(body.room);
      const peer = authenticatedPeer(req, room, body.peerId);
      if (!room || !peer) return sendJson(res, 401, { ok: false, error: 'Session inconnue' });
      if (!sessionRateLimit(res, peer, 'events-ticket', 30, 60 * 1000)) return;
      peer.lastSeen = Date.now();
      const ticket = crypto.randomBytes(24).toString('base64url');
      eventTickets.set(ticket, { roomCode: room.code, peerId: peer.id, expiresAt: Date.now() + EVENT_TICKET_TTL_MS });
      return sendJson(res, 200, { ok: true, ticket, expiresInMs: EVENT_TICKET_TTL_MS });
    }

    if (req.method === 'GET' && pathname === '/api/events') {
      const ticket = String(url.searchParams.get('ticket') || '');
      const record = eventTickets.get(ticket);
      eventTickets.delete(ticket);
      if (!record || record.expiresAt < Date.now()) return sendJson(res, 401, { ok: false, error: 'Ticket SSE invalide' });
      const room = getRoom(record.roomCode);
      const peer = getPeer(room, record.peerId);
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
      peer.disconnectedAt = null;
      sseSend(res, 'room-state', roomSnapshot(room));
      broadcastRoomState(room);

      req.on('close', () => {
        if (peer.sse === res) {
          peer.sse = null;
          peer.lastSeen = Date.now();
          peer.disconnectedAt = Date.now();
          broadcastRoomState(room);
        }
      });
      return;
    }

    if (req.method === 'GET' && pathname === '/api/rtc-config') {
      const room = getRoom(url.searchParams.get('room'));
      const peer = authenticatedPeer(req, room, url.searchParams.get('peer'));
      if (!room || !peer) return sendJson(res, 401, { ok: false, error: 'Session inconnue' });
      if (!sessionRateLimit(res, peer, 'rtc-config', 20, 60 * 1000)) return;
      peer.lastSeen = Date.now();
      const config = await rtcConfigForPeer(peer.id);
      return sendJson(res, 200, { ok: true, ...config });
    }

    const stateMatch = pathname.match(/^\/api\/rooms\/([A-Z0-9]+)\/state$/i);
    if (req.method === 'GET' && stateMatch) {
      const room = getRoom(stateMatch[1]);
      const peer = authenticatedPeer(req, room, url.searchParams.get('peer'));
      if (!room || !peer) return sendJson(res, 401, { ok: false, error: 'Session inconnue' });
      if (!sessionRateLimit(res, peer, 'room-state', 240, 60 * 1000)) return;
      peer.lastSeen = Date.now();
      return sendJson(res, 200, { ok: true, room: roomSnapshot(room) });
    }

    if (req.method === 'POST' && pathname === '/api/ready') {
      const body = await readJson(req);
      const room = getRoom(body.room);
      const peer = authenticatedPeer(req, room, body.peerId);
      if (!room || !peer) return sendJson(res, 401, { ok: false, error: 'Session inconnue' });
      if (!sessionRateLimit(res, peer, 'ready', 60, 60 * 1000)) return;
      if (typeof body.ready !== 'boolean') return sendJson(res, 400, { ok: false, error: 'État ready invalide' });
      peer.ready = body.ready;
      peer.lastSeen = Date.now();
      if (room.peers.size === 2 && [...room.peers.values()].every(p => p.ready)) {
        room.phase = 'game';
      } else if ((room.phase || 'lobby') !== 'game') {
        room.phase = 'lobby';
      }
      broadcastRoomState(room);
      return sendJson(res, 200, { ok: true, room: roomSnapshot(room) });
    }

    if (req.method === 'POST' && pathname === '/api/signal') {
      const body = await readJson(req);
      const room = getRoom(body.room);
      const from = authenticatedPeer(req, room, body.from);
      if (!room || !from) return sendJson(res, 401, { ok: false, error: 'Session inconnue' });
      if (!sessionRateLimit(res, from, 'signal', 360, 60 * 1000)) return;
      if (!validateSignal(body.type, body.payload ?? null)) {
        return sendJson(res, 400, { ok: false, error: 'Signal WebRTC invalide' });
      }
      if (body.to && !getPeer(room, body.to)) return sendJson(res, 400, { ok: false, error: 'Destinataire inconnu' });
      if (body.to === from.id) return sendJson(res, 400, { ok: false, error: 'Signal vers soi-même refusé' });

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
      const peer = authenticatedPeer(req, room, body.peerId);
      if (!room || !peer) {
        clearRecoveryCookie(req, res);
        return sendJson(res, 200, { ok: true });
      }
      removePeer(room, peer.id, 'leave');
      clearRecoveryCookie(req, res);
      return sendJson(res, 200, { ok: true });
    }

    staticFile(req, res, pathname);
  } catch (err) {
    const status = Number(err?.statusCode) || 500;
    if (status >= 500) console.error('[server]', err?.stack || err?.message || String(err));
    if (!res.headersSent) sendJson(res, status, { ok: false, error: status >= 500 ? 'Erreur serveur' : (err.message || 'Requête invalide') });
    else res.end();
  }
});

setInterval(() => {
  const now = Date.now();
  for (const [ticket, record] of eventTickets) {
    if (record.expiresAt < now) eventTickets.delete(ticket);
  }
  for (const [ticket, record] of phoneEventTickets) {
    if (record.expiresAt < now) phoneEventTickets.delete(ticket);
  }
  for (const pair of [...phonePairs.values()]) {
    const expiredBeforeJoin = !pair.pairingConsumedAt && pair.expiresAt < now;
    const expiredSession = pair.phoneSessionExpiresAt && pair.phoneSessionExpiresAt < now;
    if (expiredBeforeJoin || expiredSession || !getPeer(getRoom(pair.roomCode), pair.peerId)) closePhonePair(pair, 'expired');
    else {
      if (pair.pcSse) sseSend(pair.pcSse, 'ping', { at: now });
      if (pair.phoneSse) sseSend(pair.phoneSse, 'ping', { at: now });
    }
  }
  for (const [key, bucket] of rateBuckets) {
    if (bucket.resetAt + 60 * 1000 < now) rateBuckets.delete(key);
  }
  for (const room of [...rooms.values()]) {
    if (now - room.createdAt > ROOM_TTL_MS) {
      for (const peer of room.peers.values()) {
        try { peer.sse?.end(); } catch {}
        if (peer.recoveryKey) recoveryIndex.delete(peer.recoveryKey);
      }
      rooms.delete(room.code);
      continue;
    }
    for (const peer of [...room.peers.values()]) {
      if (!peer.sse && peer.disconnectedAt && now - peer.disconnectedAt > DISCONNECTED_PEER_GRACE_MS) {
        removePeer(room, peer.id, 'disconnect-timeout');
        continue;
      }
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
  console.log(`TCGate Alpha 0.1 Candidate 11 -> http://127.0.0.1:${PORT}`);
  const nets = os.networkInterfaces();
  for (const entries of Object.values(nets)) {
    for (const net of entries || []) {
      if (net.family === 'IPv4' && !net.internal) console.log(`Réseau local     -> http://${net.address}:${PORT}`);
    }
  }
  console.log('Note: caméra/micro nécessitent HTTPS hors localhost dans les navigateurs modernes.');
});
