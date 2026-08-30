'use strict';

const assert=require('assert');
const fs=require('fs');
const crypto=require('crypto');

(async()=>{
  const {expectedSwuLayout,normalizeStarWarsUnlimited}=await import('./public/vision/swu/database.js');
  const {PROGRESSIVE_K}=await import('./public/vision/swu/scalable-reference-engine.js');
  const {classifyVisualVariant,resolveCanonicalDisplay}=await import('./public/vision/swu/display-resolution.js');
  const {resolvePrintingResult}=await import('./public/vision/printing-result.js');
  const {VariantConsensus,variantIdentityKey}=await import('./public/vision/swu/distinct-consensus.js');
  assert.strictEqual(expectedSwuLayout({type:'Leader'},'front'),'landscape');
  assert.strictEqual(expectedSwuLayout({type:'Leader'},'back'),'portrait');
  assert.strictEqual(expectedSwuLayout({type:'Base'},'front'),'landscape');
  assert.strictEqual(expectedSwuLayout({type:'Unit'},'front'),'portrait');
  assert.deepStrictEqual([...PROGRESSIVE_K],[8,24,44]);
  const cards=Array.from({length:3048},(_,index)=>({id:`card-${index}`,name:`Card ${index}`,type:'Unit'}));
  const canonicalRefs=Array.from({length:7180},(_,index)=>({refId:`ref-${index}`,cardId:'card-0',side:index<6719?'front':'back',visualFamilyId:'family',recognitionGroupId:'group',imageUrl:`ref-${index}.jpg`}));
  const baseFixture={source:{url:value=>value},manifest:{game:'star-wars-unlimited',databaseVersion:'0.3.0-dev.3',recognitionProfileId:'swu-v1-canonical-dev',descriptorVersion:'tcgate-ident-v5-fast-72x108-b63435e'},cards,canonical:canonicalRefs,printingIndex:{cards:[]},descriptorManifest:{},printings:[]};
  assert.throws(()=>normalizeStarWarsUnlimited({...baseFixture,canonical:canonicalRefs.slice(0,7179),coarseManifest:{},coarseBuffer:new ArrayBuffer(0)}),/canonical references: expected 7180, got 7179/);
  assert.throws(()=>normalizeStarWarsUnlimited({...baseFixture,coarseManifest:{referenceCount:7180,dimension:216,byteLength:6203516},coarseBuffer:new ArrayBuffer(0)}),/Invalid SWU coarse byteLength/);
  assert.throws(()=>normalizeStarWarsUnlimited({...baseFixture,coarseManifest:{referenceCount:7180,dimension:216,byteLength:6203520},coarseBuffer:new ArrayBuffer(4)}),/Invalid SWU coarse binary/);
  assert.strictEqual(classifyVisualVariant([{variant:'Showcase'}]).classification,'DISTINCT');
  assert.strictEqual(classifyVisualVariant([{variant:'Hyperspace'}]).classification,'NEAR_VARIANT');
  const database={cards:[{id:'rex',cardId:'rex',primaryPrintingId:'standard'}],cardById:new Map([['rex',{id:'rex',cardId:'rex',primaryPrintingId:'standard'}]]),printings:[{id:'standard',printingId:'standard',cardId:'rex',variant:'Standard',frontImageUrl:'standard.png'},{id:'hyperspace',printingId:'hyperspace',cardId:'rex',variant:'Hyperspace',frontImageUrl:'hyperspace.png'},{id:'showcase',printingId:'showcase',cardId:'rex',variant:'Showcase',frontImageUrl:'showcase.png'}]};
  const canonical=resolveCanonicalDisplay(database,'rex','front');assert.strictEqual(canonical.displayAssetPath,'standard.png');assert.strictEqual(canonical.printingId,null);
  const key=variantIdentityKey('track-a','rex','front'),consensus=new VariantConsensus({trackUid:'track-a',cardId:'rex',side:'front'}),observation={identityKey:key,phase:'COMPLETE',status:'DISTINCT_CANDIDATE',candidateCountFailed:0,visualFamilyId:'showcase',recognitionGroupId:'showcase',variantKind:'Showcase',displayAssetPath:'showcase.png'};
  consensus.add(observation);consensus.add(observation);const confirmed=consensus.add(observation);assert.strictEqual(confirmed.status,'DISTINCT_CONFIRMED');assert.strictEqual(confirmed.printingId,null);
  const mixed=new VariantConsensus({trackUid:'track-a',cardId:'rex',side:'front'});mixed.add(observation);mixed.add({...observation,status:'CANONICAL',visualFamilyId:null});assert.strictEqual(mixed.add(observation).status,'CANONICAL');
  const stale=new VariantConsensus({trackUid:'track-b',cardId:'leia',side:'front'});assert.strictEqual(stale.add(observation).sampleCount,0);
  const cyberpunk={cards:[{cardId:'cp-card',name:'Cyberpunk card',primaryPrintingId:'cp-primary'}],printings:[{cardId:'cp-card',printingId:'cp-primary',displayAssetPath:'primary.jpg'},{cardId:'cp-card',printingId:'cp-alt',displayAssetPath:'alt.jpg'}],recognitionGroups:[{cardId:'cp-card',recognitionGroupId:'exact',mode:'exact',candidatePrintingIds:['cp-alt']},{cardId:'cp-card',recognitionGroupId:'shared',mode:'shared',candidatePrintingIds:['cp-primary','cp-alt']}]};
  const exact=resolvePrintingResult(cyberpunk,'cp-card','exact'),shared=resolvePrintingResult(cyberpunk,'cp-card','shared'),canonicalOnly=resolvePrintingResult(cyberpunk,'cp-card');assert.strictEqual(exact.printingId,'cp-alt');assert.strictEqual(exact.displayAssetPath,'alt.jpg');assert.strictEqual(shared.printingId,null);assert.strictEqual(shared.displayAssetPath,'primary.jpg');assert.strictEqual(canonicalOnly.printingId,null);assert.strictEqual(canonicalOnly.displayAssetPath,'primary.jpg');
  const runtime=fs.readFileSync('public/swu-identification.js','utf8'),server=fs.readFileSync('server.js','utf8'),scalable=fs.readFileSync('public/vision/swu/scalable-reference-engine.js','utf8');assert(runtime.includes('COARSE + ON-DEMAND'));assert(runtime.includes('tcgate_db_star_wars_unlimited/develop-swu-db-v0.3'));assert(runtime.includes("rejectionReason='glare-high'"));assert(scalable.includes('/api/image-proxy?url='));assert(server.includes("target.hostname !== SWU_IMAGE_HOST"));assert(server.includes("target.protocol !== 'https:'"));assert(!runtime.includes('lab-track-selector'));assert(!runtime.includes('landscapeForensics'));
  const rawIdentification=fs.readFileSync('public/identification-worker.js'),rawDetection=fs.readFileSync('public/detection-worker.js'),hash=value=>crypto.createHash('sha256').update(value).digest('hex');
  const hashes={identification:hash(rawIdentification),detection:hash(Buffer.from(rawDetection.toString('utf8').replace(/\r\n/g,'\n'),'utf8'))};
  assert.strictEqual(hashes.identification,'306eafe4decdcce26287683bc581cd8ca24a0c2f58cd299873b093942127a14a');assert.strictEqual(hashes.detection,'e749551f11065a03bd2cfc75577f23c4ece893a2c7d08bc82a341b2a35619b7a');
  console.log('SWU_R14_RUNTIME_OK');
})().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
