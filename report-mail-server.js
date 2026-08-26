'use strict';

/**
 * TCGate v0.4 - Alpha report mail bridge
 *
 * This file wraps Node's http.createServer BEFORE server.js is loaded.
 * The existing TCGate server remains unchanged for every route except:
 *   GET  /api/report-email/status
 *   POST /api/report-email
 *
 * Configuration stays server-side in Railway:
 *   RESEND_API_KEY
 *   TCGATE_REPORT_TO_EMAIL
 *   TCGATE_REPORT_FROM_EMAIL
 */

const http = require('http');
const crypto = require('crypto');

const originalCreateServer = http.createServer.bind(http);
const RESEND_API_KEY = String(process.env.RESEND_API_KEY || '').trim();
const REPORT_TO = String(process.env.TCGATE_REPORT_TO_EMAIL || '').trim();
const REPORT_FROM = String(process.env.TCGATE_REPORT_FROM_EMAIL || '').trim();

const REPORT_BODY_LIMIT = 8 * 1024 * 1024;
const REPORT_ATTACHMENT_LIMIT = 5 * 1024 * 1024;
const NOTE_LIMIT = 2000;
const rateBuckets = new Map();

function configured() {
  return Boolean(RESEND_API_KEY && REPORT_TO && REPORT_FROM);
}

function sendJson(res, status, body) {
  const payload = Buffer.from(JSON.stringify(body));
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': payload.length,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(payload);
}

function sameOrigin(req) {
  const origin = String(req.headers.origin || '').trim();
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

function fingerprint(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return crypto.createHash('sha256')
    .update(`${forwarded}|${req.socket.remoteAddress || 'unknown'}`)
    .digest('hex')
    .slice(0, 24);
}

function rateAllowed(req) {
  const key = fingerprint(req);
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  let bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    rateBuckets.set(key, bucket);
  }
  bucket.count += 1;
  return bucket.count <= 10;
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    let bytes = 0;
    req.setEncoding('utf8');

    req.on('data', chunk => {
      bytes += Buffer.byteLength(chunk, 'utf8');
      if (bytes > REPORT_BODY_LIMIT) {
        reject(Object.assign(new Error('Rapport trop volumineux'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      raw += chunk;
    });

    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(Object.assign(new Error('JSON invalide'), { statusCode: 400 }));
      }
    });

    req.on('error', reject);
  });
}

function cleanText(value, max = 200) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function cleanMultiline(value, max = NOTE_LIMIT) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/\u0000/g, '')
    .trim()
    .slice(0, max);
}

function safeFilename(value) {
  const name = String(value || 'tcgate-alpha-rapport-complet.zip')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .slice(0, 120);
  return name.endsWith('.zip') ? name : `${name}.zip`;
}

function escapeHtml(value) {
  return String(value || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  })[c]);
}

async function sendViaResend({ attachment, filename, note, roomCode, context }) {
  const subjectRoom = roomCode ? ` - salon ${roomCode}` : '';
  const subject = `TCGate Alpha - rapport testeur${subjectRoom}`;
  const noteText = note || '(aucune note fournie)';
  const text = [
    'TCGate - Rapport Alpha',
    '',
    `Salon : ${roomCode || 'non renseigne'}`,
    `Contexte : ${context || 'non renseigne'}`,
    '',
    'Note du testeur :',
    noteText,
    '',
    'Le rapport technique complet est joint au format ZIP.'
  ].join('\n');

  const html = `
    <h2>TCGate - Rapport Alpha</h2>
    <p><strong>Salon :</strong> ${escapeHtml(roomCode || 'non renseigne')}</p>
    <p><strong>Contexte :</strong> ${escapeHtml(context || 'non renseigne')}</p>
    <h3>Note du testeur</h3>
    <p style="white-space:pre-wrap">${escapeHtml(noteText)}</p>
    <p>Le rapport technique complet est joint au format ZIP.</p>
  `;

  const idem = crypto.createHash('sha256')
    .update(attachment)
    .update('\n')
    .update(note)
    .digest('hex')
    .slice(0, 48);

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `tcgate-report-${idem}`
    },
    body: JSON.stringify({
      from: REPORT_FROM,
      to: [REPORT_TO],
      subject,
      text,
      html,
      attachments: [{
        content: attachment.toString('base64'),
        filename
      }],
      tags: [
        { name: 'source', value: 'tcgate-alpha' },
        { name: 'kind', value: 'tester-report' }
      ]
    })
  });

  const payloadText = await response.text();
  let payload = null;
  try { payload = payloadText ? JSON.parse(payloadText) : null; }
  catch { payload = { raw: payloadText.slice(0, 500) }; }

  if (!response.ok) {
    const msg = payload?.message || payload?.error?.message || `Resend HTTP ${response.status}`;
    throw Object.assign(new Error(msg), { statusCode: 502 });
  }

  return payload;
}

async function handleReportMail(req, res, pathname) {
  res.setHeader('Referrer-Policy', 'no-referrer');

  if (req.method === 'GET' && pathname === '/api/report-email/status') {
    return sendJson(res, 200, { ok: true, configured: configured() });
  }

  if (req.method !== 'POST' || pathname !== '/api/report-email') {
    return false;
  }

  if (!sameOrigin(req)) {
    sendJson(res, 403, { ok: false, error: 'Origine refusee.' });
    return true;
  }

  if (!rateAllowed(req)) {
    sendJson(res, 429, { ok: false, error: 'Trop de rapports envoyes depuis cette connexion. Reessaie plus tard.' });
    return true;
  }

  if (!configured()) {
    sendJson(res, 503, { ok: false, error: 'Envoi par mail non configure sur le serveur.' });
    return true;
  }

  const body = await readJsonBody(req);
  const base64 = String(body.zipBase64 || '').replace(/\s+/g, '');
  if (!base64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    sendJson(res, 400, { ok: false, error: 'Piece jointe invalide.' });
    return true;
  }

  const attachment = Buffer.from(base64, 'base64');
  if (!attachment.length || attachment.length > REPORT_ATTACHMENT_LIMIT) {
    sendJson(res, 413, { ok: false, error: 'Rapport trop volumineux pour cet envoi.' });
    return true;
  }

  // Basic ZIP signature guard.
  if (attachment[0] !== 0x50 || attachment[1] !== 0x4b) {
    sendJson(res, 400, { ok: false, error: 'Le rapport transmis n est pas un ZIP valide.' });
    return true;
  }

  const note = cleanMultiline(body.note);
  const roomCode = cleanText(body.roomCode, 12).toUpperCase();
  const context = cleanText(body.context, 120);
  const filename = safeFilename(body.filename);

  const result = await sendViaResend({ attachment, filename, note, roomCode, context });
  sendJson(res, 200, { ok: true, messageId: result?.id || null });
  return true;
}

http.createServer = function patchedCreateServer(optionsOrListener, maybeListener) {
  const hasOptions = typeof optionsOrListener !== 'function';
  const listener = hasOptions ? maybeListener : optionsOrListener;

  if (typeof listener !== 'function') {
    return originalCreateServer(optionsOrListener, maybeListener);
  }

  const wrapped = async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      if (url.pathname === '/api/report-email' || url.pathname === '/api/report-email/status') {
        const handled = await handleReportMail(req, res, url.pathname);
        if (handled !== false) return;
      }
      return listener(req, res);
    } catch (err) {
      const status = Number(err?.statusCode) || 500;
      console.error('[report-mail]', err?.message || String(err));
      if (!res.headersSent) {
        sendJson(res, status, {
          ok: false,
          error: status >= 500 ? 'Impossible d envoyer le rapport pour le moment.' : (err.message || 'Requete invalide.')
        });
      } else {
        res.end();
      }
    }
  };

  return hasOptions
    ? originalCreateServer(optionsOrListener, wrapped)
    : originalCreateServer(wrapped);
};

require('./server.js');
