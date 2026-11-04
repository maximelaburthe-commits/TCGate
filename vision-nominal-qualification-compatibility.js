'use strict';
// Read-only deployment proof. Hash the actual deployed files, never a Git index,
// branch name, cached manifest or the claimed qualified receipt itself.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const receiptApi = require('./public/vision-qualification-receipt.js');
const sum = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
// This scope binds the deployed model URL, file and serving implementation.
// New qualification/UI endpoints do not alter this contract. Ambiguous or
// missing declarations/handlers fail closed instead of silently hashing less.
function modelServingContract(bytes) {
  const source = bytes.toString('utf8').replace(/\r\n/g, '\n');
  const declarations = ['ROOT','MODEL_FILE','MODEL_ROUTE'].map(name => {
    const matches = [...source.matchAll(new RegExp('^const ' + name + ' = [^\\n]+;$', 'gm'))];
    if (matches.length !== 1) throw Error('Ambiguous model-serving declaration: ' + name);
    return matches[0][0];
  });
  const headers = [...source.matchAll(/^    if \(req\.method === 'GET' && pathname === MODEL_ROUTE\) \{$/gm)];
  if (headers.length !== 1) throw Error('Unique deployed GET model route required');
  const start = headers[0].index, opening = source.indexOf('{', start);
  let depth = 0, quote = null, lineComment = false, blockComment = false, end = -1;
  for (let i = opening; i < source.length; i++) {
    const ch = source[i], next = source[i + 1];
    if (lineComment) { if (ch === '\n') lineComment = false; continue; }
    if (blockComment) { if (ch === '*' && next === '/') { blockComment = false; i++; } continue; }
    if (quote) { if (ch === '\\') { i++; continue; } if (ch === quote) quote = null; continue; }
    if (ch === '/' && next === '/') { lineComment = true; i++; continue; }
    if (ch === '/' && next === '*') { blockComment = true; i++; continue; }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '{') depth++;
    if (ch === '}' && --depth === 0) { end = i + 1; break; }
  }
  if (end < 0 || source.slice(end - 5, end) !== '    }') throw Error('Model route block is incomplete');
  const route = source.slice(start, end);
  // Bind all uses of these model authorities to the one audited handler.
  for (const [name, expected] of [['MODEL_FILE',3],['MODEL_ROUTE',2]]) {
    const count = [...source.matchAll(new RegExp('\\b' + name + '\\b', 'g'))].length;
    if (count !== expected) throw Error('Model-serving authority used outside its qualified scope: ' + name);
  }
  return Buffer.from(declarations.join('\n') + '\n' + route + '\n');
}
function proofRecord(file, bytes) {
  return { path: file, sha256: sum(normalizedBytes(file, bytes)),
    ...(file === 'server.js' ? { scope: 'MODEL_SERVING_V1' } : {}) };
}
function normalizedBytes(file, bytes) {
  if (file === 'server.js') return modelServingContract(bytes);
  return /\.(?:js|json)$/.test(file) ? Buffer.from(bytes.toString('utf8').replace(/\r\n/g, '\n')) : bytes;
}
function getCompatibility(options = {}) {
  if (!path.isAbsolute(options.root || '') || !/^[a-f0-9]{40}$/.test(options.buildSha || '')) throw Error('Exact deployed root and SHA required');
  const root = fs.realpathSync(options.root);
  const read = relative => {
    const file = path.resolve(root, relative), resolved = fs.realpathSync(file);
    if (!resolved.startsWith(root + path.sep)) throw Error('Compatibility path escaped product root');
    return fs.readFileSync(resolved);
  };
  const files = receiptApi.ENGINE_PATHS.map(file => proofRecord(file, read(file)));
  const config = read('public/game-databases.js').toString('utf8');
  const databaseSha = config.match(/manifestUrl:\s*'https:\/\/raw\.githubusercontent\.com\/maximelaburthe-commits\/tcgate_db_cyberpunk\/([a-f0-9]{40})\/manifest\.json'/)?.[1];
  if (!databaseSha) throw Error('Immutable active Cyberpunk database source required');
  let receiptSha256 = null;
  const receiptFile = path.join(root, receiptApi.RECEIPT_FILE);
  if (fs.existsSync(receiptFile)) receiptSha256 = receiptApi.digest(JSON.parse(fs.readFileSync(receiptFile, 'utf8')));
  const output = { schemaVersion: '1.0', buildSha: options.buildSha, databaseSha, files,
    fingerprintSha256: receiptApi.digest(files),
    semantics: { harnessSha256: sum(normalizedBytes('public/vision-qualification-harness.js', read('public/vision-qualification-harness.js'))) }, receiptSha256 };
  if (options.context !== undefined || options.sampleDocument !== undefined) {
    const context = receiptApi.contextCompatibility(options.context, options.sampleDocument);
    if (context.databaseSha !== databaseSha || options.context.productSha !== options.buildSha) throw Error('Qualification context does not match the deployed product');
    return { ...output, ...context };
  }
  return output;
}
module.exports = { getCompatibility, normalizedBytes, modelServingContract, proofRecord };
