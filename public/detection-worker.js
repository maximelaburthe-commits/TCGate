'use strict';

const ORT_CDN_BASE = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0/dist/';
const MODEL_URL = '/api/model/card-detector-v53-512-alpha9p1.onnx?v=20260814-alpha9p1-512';
const MODEL_SIZE = 512;

let ortReady = false;
let session = null;
let provider = null;
let inputName = null;
let outputShape = '—';
let canvas = null;
let ctx = null;

function post(type, payload = {}) {
  self.postMessage({ type, ...payload });
}

async function ensureOrt() {
  if (ortReady) return;
  importScripts(`${ORT_CDN_BASE}ort.webgpu.min.js`);
  if (!self.ort) throw new Error('ONNX Runtime Web indisponible dans le worker.');
  ort.env.wasm.wasmPaths = ORT_CDN_BASE;
  ort.env.wasm.numThreads = 1;
  if (ort.env.webgpu) {
    ort.env.webgpu.powerPreference = 'high-performance';
    ort.env.webgpu.forceFallbackAdapter = false;
  }
  ortReady = true;
}

async function fetchModelBuffer() {
  post('model-progress', { received: 0, total: 0, pct: 0, text: 'Chargement du détecteur personnalisé…' });
  const response = await fetch(MODEL_URL, { cache: 'no-store' });
  if (!response.ok) {
    let details = '';
    try { details = (await response.json()).error || ''; } catch {}
    throw new Error(details || `Téléchargement du modèle impossible (HTTP ${response.status}).`);
  }
  const total = Number(response.headers.get('content-length') || 0);
  if (!response.body) {
    const arr = new Uint8Array(await response.arrayBuffer());
    post('model-progress', { received: arr.length, total: arr.length, pct: 100, text: 'Modèle prêt' });
    return arr;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    const pct = total ? Math.min(100, (received / total) * 100) : 0;
    post('model-progress', { received, total, pct, text: total ? `Modèle ${pct.toFixed(0)} %` : 'Téléchargement du modèle…' });
  }
  const merged = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.length; }
  post('model-progress', { received, total: total || received, pct: 100, text: 'Modèle prêt' });
  return merged;
}

async function createSession(modelBytes) {
  await ensureOrt();
  const common = { graphOptimizationLevel: 'all' };
  if (self.navigator?.gpu) {
    // Graph capture peut nettement réduire l'overhead CPU sur un modèle à forme fixe.
    // Si ce modèle / navigateur ne le supporte pas, on retente sans graph capture.
    try {
      post('status', { text: 'Initialisation WebGPU haute performance…', kind: 'warn' });
      const s = await ort.InferenceSession.create(modelBytes, {
        ...common,
        enableGraphCapture: true,
        executionProviders: ['webgpu']
      });
      return { session: s, provider: 'WebGPU · graph capture' };
    } catch (graphErr) {
      try {
        post('status', { text: 'Initialisation WebGPU…', kind: 'warn' });
        const s = await ort.InferenceSession.create(modelBytes, {
          ...common,
          executionProviders: ['webgpu']
        });
        return { session: s, provider: 'WebGPU' };
      } catch (gpuErr) {
        post('warning', { text: 'WebGPU indisponible pour ce modèle. Passage en WASM/CPU.' });
      }
    }
  }
  post('status', { text: 'Initialisation WASM/CPU…', kind: 'warn' });
  const s = await ort.InferenceSession.create(modelBytes, {
    ...common,
    executionProviders: ['wasm']
  });
  return { session: s, provider: 'WASM / CPU' };
}

async function loadModel() {
  if (session) return;
  const bytes = await fetchModelBuffer();
  const created = await createSession(bytes);
  session = created.session;
  provider = created.provider;
  inputName = session.inputNames[0];

  // Warm-up : force la première compilation/exécution WebGPU avant la première vraie carte.
  // Le coût est payé une seule fois au chargement du modèle.
  try {
    post('status', { text: 'Warm-up du détecteur…', kind: 'warn' });
    const zeros = new Float32Array(1 * 3 * MODEL_SIZE * MODEL_SIZE);
    const warmTensor = new ort.Tensor('float32', zeros, [1, 3, MODEL_SIZE, MODEL_SIZE]);
    await session.run({ [inputName]: warmTensor });
  } catch (warmErr) {
    post('warning', { text: `Warm-up non bloquant : ${warmErr?.message || warmErr}` });
  }

  post('model-ready', { provider });
}

function ensureCanvas() {
  if (!canvas) {
    canvas = new OffscreenCanvas(MODEL_SIZE, MODEL_SIZE);
    ctx = canvas.getContext('2d', { willReadFrequently: true });
  }
}

function preprocessBitmap(bitmap) {
  ensureCanvas();
  const sourceW = bitmap.width;
  const sourceH = bitmap.height;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, MODEL_SIZE, MODEL_SIZE);
  const scale = Math.min(MODEL_SIZE / sourceW, MODEL_SIZE / sourceH);
  const drawW = sourceW * scale;
  const drawH = sourceH * scale;
  const padX = (MODEL_SIZE - drawW) / 2;
  const padY = (MODEL_SIZE - drawH) / 2;
  ctx.drawImage(bitmap, 0, 0, sourceW, sourceH, padX, padY, drawW, drawH);
  bitmap.close();

  const rgba = ctx.getImageData(0, 0, MODEL_SIZE, MODEL_SIZE).data;
  const plane = MODEL_SIZE * MODEL_SIZE;
  const chw = new Float32Array(plane * 3);
  for (let p = 0, i = 0; p < plane; p += 1, i += 4) {
    chw[p] = rgba[i] / 255;
    chw[plane + p] = rgba[i + 1] / 255;
    chw[plane * 2 + p] = rgba[i + 2] / 255;
  }
  return {
    tensor: new ort.Tensor('float32', chw, [1, 3, MODEL_SIZE, MODEL_SIZE]),
    prep: { sourceW, sourceH, scale, padX, padY }
  };
}

function pickDetectionTensor(results) {
  const entries = Object.entries(results);
  const preferred = entries.find(([, tensor]) => tensor?.dims?.includes(7));
  return preferred || entries[0] || null;
}

function readRows(tensor) {
  const dims = tensor.dims.map(Number);
  const data = tensor.data;
  outputShape = `[${dims.join(', ')}]`;
  if (dims.length === 2 && dims[1] === 7) {
    return Array.from({ length: dims[0] }, (_, r) => data.slice(r * 7, r * 7 + 7));
  }
  if (dims.length === 3 && dims[0] === 1 && dims[2] === 7) {
    return Array.from({ length: dims[1] }, (_, r) => data.slice(r * 7, r * 7 + 7));
  }
  if (dims.length === 3 && dims[0] === 1 && dims[1] === 7) {
    return Array.from({ length: dims[2] }, (_, r) => {
      const row = new Float32Array(7);
      for (let c = 0; c < 7; c += 1) row[c] = data[c * dims[2] + r];
      return row;
    });
  }
  throw new Error(`Format de sortie inattendu : [${dims.join(', ')}]`);
}

function toSourceDetection(row, prep, confidence) {
  let [cx, cy, w, h, conf, cls, angle] = Array.from(row, Number);
  if (![cx, cy, w, h, conf, angle].every(Number.isFinite)) return null;
  if (conf < confidence) return null;
  if (Math.max(Math.abs(cx), Math.abs(cy), Math.abs(w), Math.abs(h)) <= 2.5) {
    cx *= MODEL_SIZE; cy *= MODEL_SIZE; w *= MODEL_SIZE; h *= MODEL_SIZE;
  }
  if (Math.abs(angle) > Math.PI * 2.2) angle = angle * Math.PI / 180;
  cx = (cx - prep.padX) / prep.scale;
  cy = (cy - prep.padY) / prep.scale;
  w /= prep.scale;
  h /= prep.scale;
  if (cx < -w || cy < -h || cx > prep.sourceW + w || cy > prep.sourceH + h) return null;
  if (w < 18 || h < 18) return null;
  return { cx, cy, w, h, conf, cls: Math.round(cls || 0), angle };
}

function parseDetections(results, prep, confidence) {
  const picked = pickDetectionTensor(results);
  if (!picked) return [];
  const rows = readRows(picked[1]);
  return rows
    .map((row) => toSourceDetection(row, prep, confidence))
    .filter(Boolean)
    .sort((a, b) => b.conf - a.conf)
    .slice(0, 80);
}

async function infer(bitmap, confidence, requestId) {
  if (!session) await loadModel();
  const started = performance.now();
  const { tensor, prep } = preprocessBitmap(bitmap);
  const prepDone = performance.now();
  const results = await session.run({ [inputName]: tensor });
  const detections = parseDetections(results, prep, confidence);
  const ended = performance.now();
  post('inference-result', {
    requestId,
    detections,
    provider,
    outputShape,
    preprocessMs: prepDone - started,
    inferenceMs: ended - prepDone,
    totalMs: ended - started
  });
}

self.onmessage = async (event) => {
  const msg = event.data || {};
  try {
    if (msg.type === 'load-model') {
      await loadModel();
      return;
    }
    if (msg.type === 'infer') {
      await infer(msg.bitmap, Number(msg.confidence || 0.55), msg.requestId);
      return;
    }
  } catch (err) {
    try { msg.bitmap?.close?.(); } catch {}
    post('error', { message: err?.message || String(err), stack: err?.stack || '' });
  }
};
