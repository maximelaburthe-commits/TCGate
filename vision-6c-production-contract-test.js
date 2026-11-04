'use strict';
// Exact-patch guard regression, never physical-card evidence.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const api=require('./vision-6c-production-contract.js');
const contract=require('./workspace-production-contract.js');
const generator=require('./generate-vision-6c-engine-patches.js');
const manifest=require('./VISION_6C_ENGINE_PATCHES.json');
const repo=process.env.TCGATE_6C_BASELINE_REPO||__dirname;
const target=process.env.TCGATE_6C_ENGINE_TARGET_ROOT||__dirname;
const phase1=process.env.TCGATE_6C_CANONICAL_TARGET_ROOT||target;
const git=args=>execFileSync('git',['-c','safe.directory='+path.resolve(repo),...args],{cwd:repo});
const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const lf=value=>value.toString('utf8').replace(/\r\n/g,'\n');
const copy=value=>JSON.parse(JSON.stringify(value));
let assertions=0;
const equal=(a,b,label)=>{assertions++;assert.deepEqual(a,b,label);};
const check=(v,label)=>{assertions++;assert.ok(v,label);};
const throws=(fn,re,label)=>{assertions++;assert.throws(fn,re,label);};
const oldAlgorithm='e5593e42a8dfd60a4d81850fb76c518c4212302906a1cd655fb3901cf9e18071';
const failsAlgorithm=source=>{try{return hash(contract.productionIdentification(Buffer.from(source)))!==oldAlgorithm;}catch{return true;}};
equal(git(['rev-parse',api.BASELINE_SHA+'^{commit}']).toString().trim(),api.BASELINE_SHA,'real Git baseline exists');
api.validateManifest(manifest);
let hunks=0;
for(const file of manifest.files){
  const before=lf(git(['show',api.BASELINE_SHA+':'+file.path]));
  const originalBefore=Buffer.from(before);
  const after=lf(fs.readFileSync(path.join(target,file.path)));
  const normalized=api.normalizeEngine6C(Buffer.from(after),file.path);
  equal(file.baselineGitBlob,git(['rev-parse',api.BASELINE_SHA+':'+file.path]).toString().trim(),'manifest Git blob authenticated against real Git');
  equal(file.baselineSha256,hash(before),'baseline bytes authenticated');
  equal(file.afterSha256,hash(after),'manifest matches actual staged target');
  equal(normalized.toString(),before,'ALL reviewed hunks reverse to exact real Git7082 source');
  equal(api.normalizeEngine6C(Buffer.from(before),file.path).toString(),before,'unpatched baseline remains unchanged');
  equal(originalBefore.toString(),before,'caller baseline bytes never mutated');
  equal(api.normalizeEngine6C(Buffer.from(after.replace(/\n/g,'\r\n')),file.path).toString(),before,'Git Windows text filters accepted');
  for(const h of file.hunks){
    hunks++;
    equal(hash(h.before),h.beforeSha256);equal(hash(h.after),h.afterSha256);
    equal(before.slice(h.oldOffset,h.oldOffset+h.before.length),h.before,'original hunk anchor is real');
    equal(after.slice(h.newOffset,h.newOffset+h.after.length),h.after,'after hunk anchor is exact');
    const at=h.newOffset+Math.max(1,Math.floor(h.after.length/2));
    const changed=after.slice(0,at)+'~'+after.slice(at+1);
    equal(api.normalizeEngine6C(Buffer.from(changed),file.path).toString(),changed,'one changed literal hunk prevents ALL stripping');
    check(hash(api.normalizeEngine6C(Buffer.from(changed),file.path))!==hash(before),'changed hunk fails complete source hash');
    const duplicate=after+'\n'+h.after;
    equal(api.normalizeEngine6C(Buffer.from(duplicate),file.path).toString(),duplicate,'duplicate after hunk is never stripped');
    const moved=after.slice(0,h.newOffset)+after.slice(h.newOffset+h.after.length)+'\n'+h.after;
    equal(api.normalizeEngine6C(Buffer.from(moved),file.path).toString(),moved,'hunk moved beyond recorded anchors is never stripped');
  }
  const first=file.hunks[0],partial=after.slice(0,first.newOffset)+first.before+after.slice(first.newOffset+first.after.length);
  equal(api.normalizeEngine6C(Buffer.from(partial),file.path).toString(),partial,'partly applied patch is never partly stripped');
  const extra='\n// OUT_OF_HUNK_TAMPER\nglobalThis.unapprovedRecognition=true;\n';
  const withExtra=api.normalizeEngine6C(Buffer.from(after+extra),file.path).toString();
  equal(withExtra,before+extra,'out-of-hunk extra code remains in normalized source');
  check(hash(withExtra)!==file.baselineSha256,'out-of-hunk code fails whole source hash');
  const lower=after.replace(/NORMAL_ACCEPT\s*=\s*(?:0)?\.235/,match=>match.replace('235','234'));
  check(lower!==after,'threshold mutation actually changes source');
  const lowerNormalized=api.normalizeEngine6C(Buffer.from(lower),file.path);
  check(hash(lowerNormalized)!==file.baselineSha256,'normalizer never hides lower acceptance threshold');
  throws(()=>generator.assertProtected(file.path,before,lower),/Protected engine constants changed/,'regeneration cannot bless a lower threshold');
  const descriptor=after.replace('.25*full','.24*full');
  check(descriptor!==after,'descriptor mutation actually changes source');
  throws(()=>generator.assertProtected(file.path,before,descriptor),/Protected engine function changed/,'regeneration cannot bless descriptor scoring changes');
  check(hash(api.normalizeEngine6C(Buffer.from(descriptor),file.path))!==file.baselineSha256,'descriptor changes survive normalization for rejection');
  const legacy=lf(git(['show','7baeb9844ac8a2a68b2c5a38011003514bab5f98:'+file.path]));
  const final=file.path==='public/identification.js'?contract.stripQualificationDiagnostics(normalized):normalized;
  equal(final.toString(),legacy,'entire normalized matcher equals original 7ba engine, not only named functions');
  if(file.path==='public/identification.js'){
    equal(hash(contract.productionIdentification(Buffer.from(after))),oldAlgorithm,'all79 original named functions and protected constants keep original hash');
    equal(hash(contract.productionIdentification(Buffer.from(before))),oldAlgorithm,'before source keeps original79 fingerprint');
    check(failsAlgorithm(lower),'lower threshold fails original79 fingerprint');
    const h=file.hunks.find(h=>h.after.includes('canonicalRankCandidates'));
    check(failsAlgorithm(after.replace(h.after,h.after.replace('bestByCard','changedBestByCard'))),'modified new code cannot be silently hidden by original function contract');
  }else equal(hash(api.productionIdentificationWorker(Buffer.from(after))),'306eafe4decdcce26287683bc581cd8ca24a0c2f58cd299873b093942127a14a','historical full worker CRLF hash stays unchanged');
}
const tampered=copy(manifest);tampered.files[0].hunks[0].after+='unapproved';
throws(()=>api.validateManifest(tampered),/Invalid literal 6C hunk/,'manifest hunk hashes protect literal content');
const wrongBaseline=copy(manifest);wrongBaseline.files[0].baselineSha256='0'.repeat(64);
throws(()=>api.validateManifest(wrongBaseline),/frozen source identity/);
throws(()=>api.normalizeEngine6C(Buffer.from('x'),'public/detection-worker.js'),/Unsupported/,'no detector normalization route exists');
// Re-generation works for the current frozen target and an optional earlier
// canonical-only target. Each is authenticated back to the same real Git7082.
const firstManifest=generator.generate({repo,afterRoot:phase1});
for(const file of firstManifest.files){const bytes=fs.readFileSync(path.join(phase1,file.path));equal(api.normalizeEngine6C(bytes,file.path,firstManifest).toString(),lf(git(['show',api.BASELINE_SHA+':'+file.path])),'regenerated earlier/current manifest reverses exactly');}
const regenerated=generator.generate({repo,afterRoot:target});
equal(regenerated,manifest,'external Git-diff generator is deterministic for frozen target');
// Preserve and authenticate the complete historical228-entry manifest. Only
// three original Workspace presentation files and two engines are exceptions.
const frozen=JSON.parse(fs.readFileSync(path.join(repo,'VISION_QUALIFICATION_ENGINE_BASELINE.json'),'utf8'));
equal(frozen.productSha,'7baeb9844ac8a2a68b2c5a38011003514bab5f98');equal(frozen.files.length,228);
const tree=new Map(git(['ls-tree','-r',frozen.productSha]).toString().trim().split('\n').map(line=>{const m=line.match(/^\d+ blob ([a-f0-9]{40})\t(.+)$/);return m?[m[2],m[1]]:['',''];}));
for(const entry of frozen.files)equal(tree.get(entry.path),entry.gitBlob,'all original manifest blobs remain authenticated');
const exceptions=new Set(['public/workspace.html','public/workspace.js','public/workspace.css','public/identification.js','public/identification-worker.js']);
const strict=frozen.files.filter(f=>!exceptions.has(f.path));equal(strict.length,223);
for(const name of ['public/detection-worker.js','public/table-state-engine.js','models/card_detector_v53_512.onnx'])check(strict.some(f=>f.path===name),'detector/table/model stay strict frozen paths');
console.log('VISION_6C_PRODUCTION_CONTRACT_PASS '+assertions+' assertions; '+hunks+' exact hunks; original228 manifest /223 strict files /old79 fingerprint unchanged');
