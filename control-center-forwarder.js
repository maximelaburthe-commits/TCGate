'use strict';

const DEFAULT_TIMEOUT_MS = 5000;

function normalizeOrigin(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) return null;
    if (url.pathname !== '/' && url.pathname !== '') return null;
    return url.origin;
  } catch {
    return null;
  }
}

function createControlCenterForwarder(options = {}) {
  const origin = normalizeOrigin(options.url);
  const ingestKey = String(options.ingestKey || '').trim();
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const timeoutMs = Number(options.timeoutMs || DEFAULT_TIMEOUT_MS);

  function configured() {
    return Boolean(origin && ingestKey && typeof fetchImpl === 'function');
  }

  async function forward({ attachment, filename }) {
    if (!configured()) return { configured: false, forwarded: false, reason: 'not-configured' };
    if (!Buffer.isBuffer(attachment) || !attachment.length) throw new Error('control-center-invalid-attachment');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const form = new FormData();
      form.append('report', new Blob([attachment], { type: 'application/zip' }), filename);
      const response = await fetchImpl(`${origin}/api/reports`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ingestKey}` },
        body: form,
        signal: controller.signal
      });
      const text = await response.text();
      let payload = null;
      try { payload = text ? JSON.parse(text) : null; } catch {}
      if (!response.ok) throw new Error(`control-center-http-${response.status}`);
      return {
        configured: true,
        forwarded: true,
        duplicate: Boolean(payload?.duplicate),
        reportId: payload?.reportId || null,
        sessionRunId: payload?.sessionRunId || null,
        status: response.status
      };
    } finally {
      clearTimeout(timer);
    }
  }

  return Object.freeze({ configured, forward, origin });
}

async function deliverReport({ report, sendEmail, forwarder, logger = console }) {
  const centerPromise = forwarder.forward(report).catch(error => {
    logger.warn?.('[control-center-forward] failed', {
      reason: error?.name === 'AbortError' ? 'timeout' : error?.message || 'unknown'
    });
    return { configured: forwarder.configured(), forwarded: false, reason: error?.name === 'AbortError' ? 'timeout' : 'request-failed' };
  });
  const email = await sendEmail(report);
  const controlCenter = await centerPromise;
  if (controlCenter.forwarded) logger.info?.('[control-center-forward] report accepted');
  return { email, controlCenter };
}

module.exports = { createControlCenterForwarder, deliverReport, normalizeOrigin, DEFAULT_TIMEOUT_MS };
