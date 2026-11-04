'use strict';
// Developer-side contract only. Never loaded by a player page.
// Every exception is an exact, anchored literal hunk; this is not a function,
// identifier, comment or regular-expression deletion rule.
const crypto=require('node:crypto');
const defaultManifest=require('./VISION_6C_ENGINE_PATCHES.json');
const BASELINE_SHA='7082e92a66b50d0e0654ef44a6bdba89b0715e2b';
const BASELINE_HASHES=Object.freeze({
  'public/identification.js':'618a87323f186409930d74c640205e0cfccfd48237e4e29a9b2141bbed7b92fa',
  'public/identification-worker.js':'111f1b10bc726475aa1dd7d29405892328dd9ba414cb7fd10762c86e78fe49ee'
});
const lf=value=>Buffer.isBuffer(value)?value.toString('utf8').replace(/\r\n/g,'\n'):String(value).replace(/\r\n/g,'\n');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
function validateManifest(manifest){
  if(manifest?.schemaVersion!=='6C-engine-literal-patches-1'||manifest.baselineProductSha!==BASELINE_SHA||
      !Array.isArray(manifest.files)||manifest.files.length!==2)throw Error('Invalid exact 6C engine manifest');
  const seen=new Set();
  for(const file of manifest.files){
    if(!Object.hasOwn(BASELINE_HASHES,file.path)||seen.has(file.path)||file.baselineSha256!==BASELINE_HASHES[file.path]||
        !/^[a-f0-9]{40}$/.test(file.baselineGitBlob)||!Array.isArray(file.hunks)||!file.hunks.length)throw Error('Invalid 6C frozen source identity');
    seen.add(file.path);let previousOld=-1,previousNew=-1;
    for(const h of file.hunks){
      if(typeof h.before!=='string'||typeof h.after!=='string'||!h.before||!h.after||h.before===h.after||
          !Number.isSafeInteger(h.oldOffset)||h.oldOffset<0||!Number.isSafeInteger(h.newOffset)||h.newOffset<0||
          h.oldOffset<=previousOld||h.newOffset<=previousNew||hash(h.before)!==h.beforeSha256||hash(h.after)!==h.afterSha256)throw Error('Invalid literal 6C hunk');
      previousOld=h.oldOffset+h.before.length-1;previousNew=h.newOffset+h.after.length-1;
    }
  }
  return manifest;
}
function normalizeEngine6C(buffer,filePath,manifest=defaultManifest){
  const source=lf(buffer);
  const file=validateManifest(manifest).files.find(value=>value.path===filePath);
  if(!file)throw Error('Unsupported 6C engine source');
  // Baseline input remains unchanged. A partial, edited, duplicated or moved
  // patch is never partly stripped: leave the complete source for hash failure.
  for(const h of file.hunks){
    const at=source.indexOf(h.after);
    if(at<0||at!==h.newOffset||source.indexOf(h.after,at+h.after.length)>=0)return Buffer.from(source);
  }
  let normalized=source;
  for(const h of [...file.hunks].reverse())normalized=normalized.slice(0,h.newOffset)+h.before+normalized.slice(h.newOffset+h.after.length);
  return Buffer.from(normalized);
}
function normalizeIdentification6C(buffer,manifest=defaultManifest){return normalizeEngine6C(buffer,'public/identification.js',manifest);}
function normalizeWorker6C(buffer,manifest=defaultManifest){return normalizeEngine6C(buffer,'public/identification-worker.js',manifest);}
function productionIdentificationWorker(buffer){
  // The historical direct worker hash was recorded from the Windows CRLF
  // checkout. Keep that exact expected hash while accepting Git text filters.
  return Buffer.from(normalizeWorker6C(buffer).toString('utf8').replace(/\n/g,'\r\n'));
}
module.exports={BASELINE_SHA,BASELINE_HASHES,validateManifest,normalizeEngine6C,normalizeIdentification6C,normalizeWorker6C,productionIdentificationWorker};
