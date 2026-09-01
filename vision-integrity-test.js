'use strict';
const fs=require('fs');
const integrity=require('./public/vision-library-integrity.js');
const assert=(value,message)=>{if(!value)throw new Error(message);};

const refs=Array.from({length:141},(_,i)=>({name:`Card ${i}`}));
const sourceRef='6d3a296724838265a75008f2b64b37e945cd1351';
let cache=integrity.validateCache({fingerprint:'fp',sourceRef,sourceCount:141,refs},{fingerprint:'fp',sourceRef,sourceCount:141});
assert(cache.status==='hit'&&cache.refs.length===141,'matching source cache rejected');
cache=integrity.validateCache({fingerprint:'fp',sourceRef,sourceCount:141,refs},{fingerprint:'fp',sourceRef,sourceCount:142});
assert(cache.status==='invalid-source-count','changed source cardinality accepted');
cache=integrity.validateCache({fingerprint:'fp',sourceRef:'another-ref',sourceCount:141,refs},{fingerprint:'fp',sourceRef,sourceCount:141});
assert(cache.status==='invalid-source-ref','changed source revision accepted');
const healthy=integrity.assess({sourceReferences:141,loadedReferences:141,failedReferences:0,baselineMinimum:141,sourceRef,sourceImmutable:true});
assert(!healthy.degraded&&integrity.isReady(healthy),'141/141 library not healthy');
assert(healthy.sourceRef===sourceRef&&healthy.sourceImmutable===true,'source provenance missing');
const partial=integrity.assess({sourceReferences:141,loadedReferences:32,failedReferences:109,baselineMinimum:141,failed:[{name:'Synthetic failure'}]});
assert(partial.degraded&&partial.reason==='reference-assets-incomplete'&&partial.failedReferences===109&&partial.failed[0].name==='Synthetic failure','32/141 failure diagnostics missing');
assert(!integrity.isReady(partial),'libraryReady masks invalid integrity');
const fallback=integrity.assess({sourceReferences:142,loadedReferences:142,failedReferences:0,baselineMinimum:141,sourceRef:'main',sourceImmutable:false,sourceError:'Manifest HTTP 404'});
assert(fallback.degraded&&fallback.reason==='source-fallback-active'&&!integrity.isReady(fallback),'fallback silently reported as ready');
const future=integrity.assess({sourceReferences:180,loadedReferences:180,failedReferences:0,baselineMinimum:141,sourceRef,sourceImmutable:true});
assert(!future.degraded&&integrity.isReady(future),'future catalogue growth rejected');

const identification=fs.readFileSync('./public/identification.js','utf8');
assert(identification.includes('const NORMAL_ACCEPT = 0.235;')&&identification.includes('const NORMAL_MARGIN = 0.075;')&&identification.includes('const LOW_ACCEPT = 0.185;')&&identification.includes('const LOW_MARGIN = 0.135;'),'Vision thresholds changed');
console.log('VISION_LIBRARY_INTEGRITY_OK');
