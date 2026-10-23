'use strict';
const fs = require('node:fs');

function capture(source, expression, label) {
  const value = source.match(expression)?.[1];
  if (!value) throw new Error(`Missing ${label}`);
  return value;
}

function assertCandidateMetadata() {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const app = fs.readFileSync('public/app.js', 'utf8');
  const server = fs.readFileSync('server.js', 'utf8');
  const packageCandidate = capture(pkg.version, /candidate\.(\d+)$/, 'package candidate');
  const productCandidate = capture(app, /const PRODUCT_VERSION = 'TCGate Alpha 0\.1 Candidate (\d+) · UI ([\d.]+)'/, 'product candidate');
  const productUi = app.match(/const PRODUCT_VERSION = 'TCGate Alpha 0\.1 Candidate \d+ · UI ([\d.]+)'/)?.[1];
  const serverCandidate = capture(server, /const VERSION = 'tcgate-alpha-0\.1-candidate-(\d+)'/, 'server candidate');
  if (packageCandidate !== productCandidate || productCandidate !== serverCandidate) throw new Error(`Candidate metadata mismatch: package=${packageCandidate}, product=${productCandidate}, server=${serverCandidate}`);
  if (!productUi) throw new Error('UI version missing from PRODUCT_VERSION');
  if (!/pathname === '\/api\/health'[\s\S]*version: VERSION/.test(server)) throw new Error('Health endpoint must expose the server VERSION source of truth');
  return { candidate: productCandidate, ui: productUi, packageVersion: pkg.version, serverVersion: `tcgate-alpha-0.1-candidate-${serverCandidate}` };
}

module.exports = { assertCandidateMetadata };
