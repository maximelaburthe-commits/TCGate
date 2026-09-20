'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');

const source = fs.readFileSync('server.js', 'utf8');
const start = source.indexOf('function purgeTurnCredentialCache(');
const end = source.indexOf('\nfunction securityHeaders', start);
assert(start >= 0 && end > start, 'TURN cache purge helper unavailable');
const purgeTurnCredentialCache = new Function(`${source.slice(start, end)}; return purgeTurnCredentialCache;`)();

const now = 10_000;
const cache = new Map([
  ['active', { expiresAtMs: now + 60_000 }],
  ['expired', { expiresAtMs: now - 1 }],
  ['room-peer', { expiresAtMs: now + 60_000 }]
]);

assert.equal(purgeTurnCredentialCache(cache, now), 1);
assert(cache.has('active'), 'active TURN credential was purged');
assert(!cache.has('expired'), 'expired TURN credential survived purge');
assert(cache.has('room-peer'), 'unrelated active peer credential was purged');

assert.equal(purgeTurnCredentialCache(cache, now, ['room-peer']), 1);
assert(!cache.has('room-peer'), 'expired room peer credential survived room cleanup');
assert(cache.has('active'), 'active TURN credential was purged during room cleanup');

assert.match(source, /purgeTurnCredentialCache\(turnCredentialCache, now\)/);
assert.match(source, /purgeTurnCredentialCache\(turnCredentialCache, now, expiredPeerIds\)/);
console.log('TURN_CACHE_CLEANUP_OK');
