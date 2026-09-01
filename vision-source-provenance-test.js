'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
const integrity = require('./public/vision-library-integrity.js');

const publicRoot = path.resolve(__dirname, 'public');
const sourceBase = '/assets/card-db/cyberpunk/0.7.0-6d3a296';
const expectedSourceRef = '6d3a296724838265a75008f2b64b37e945cd1351';

function assert(value, message) {
  if (!value) throw new Error(message);
}

function publicFile(requestPath) {
  const decoded = decodeURIComponent(requestPath.split('?')[0]);
  const resolved = path.resolve(publicRoot, `.${decoded}`);
  if (resolved !== publicRoot && !resolved.startsWith(`${publicRoot}${path.sep}`)) return null;
  return resolved;
}

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    http.get(url, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, body: Buffer.concat(chunks) }));
    }).on('error', reject);
  });
}

const server = http.createServer((request, response) => {
  const file = publicFile(request.url || '/');
  if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
    response.writeHead(404).end();
    return;
  }
  response.writeHead(200, { 'Content-Type': file.endsWith('.json') ? 'application/json' : 'image/webp' });
  fs.createReadStream(file).pipe(response);
});

server.listen(0, '127.0.0.1', async () => {
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    const manifestResponse = await fetchBuffer(`${origin}${sourceBase}/vision-source-manifest.json`);
    assert(manifestResponse.status === 200, 'source manifest is not browser-accessible');
    const manifest = JSON.parse(manifestResponse.body.toString('utf8'));
    assert(manifest.sourceRef === expectedSourceRef, 'unexpected source revision');
    assert(manifest.sourceImmutable === true, 'source revision is not declared immutable');
    assert(manifest.sourceReferences === 147, 'expected 147 canonical references');

    const indexResponse = await fetchBuffer(`${origin}${sourceBase}/${manifest.referenceIndex}`);
    assert(indexResponse.status === 200, 'canonical Vision index is not browser-accessible');
    const index = JSON.parse(indexResponse.body.toString('utf8'));
    assert(Array.isArray(index.references) && index.references.length === 147, 'canonical Vision index is not 147 references');

    const paths = index.references.map(reference => reference.visionAssetPath || reference.referenceImageUrl);
    assert(new Set(paths).size === 147, 'Vision source contains duplicate asset paths');
    const cachedRefs = index.references.map(reference => ({ name: reference.name }));
    const cache = integrity.validateCache(
      { fingerprint: 'pinned-source', sourceRef: manifest.sourceRef, sourceCount: paths.length, refs: cachedRefs },
      { fingerprint: 'pinned-source', sourceRef: manifest.sourceRef, sourceCount: manifest.sourceReferences }
    );
    assert(cache.status === 'hit' && cache.librarySize === 147, 'cache is not coherent with pinned source provenance');
    for (const assetPath of paths) {
      assert(typeof assetPath === 'string' && assetPath.startsWith('assets/vision/'), `invalid Vision asset path: ${assetPath}`);
      const asset = await fetchBuffer(`${origin}${sourceBase}/${assetPath}`);
      assert(asset.status === 200, `Vision asset is not browser-accessible: ${assetPath}`);
      assert(asset.body.length > 12 && asset.body.subarray(0, 4).toString('ascii') === 'RIFF' && asset.body.subarray(8, 12).toString('ascii') === 'WEBP', `invalid WebP asset: ${assetPath}`);
    }

    console.log(`VISION_SOURCE_PROVENANCE_OK refs=${paths.length} sourceRef=${manifest.sourceRef}`);
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    server.close();
  }
});
