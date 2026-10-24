'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const Model=require('./public/workspace-database-maintenance-model.js');
const activeRegistry=require(process.env.TCGATE_TEST_REPO?process.env.TCGATE_TEST_REPO+'/public/game-databases.js':'./public/game-databases.js');
const PIN='56402636a77af9c8b5dc4e3b61c509a185f3c834',HEAD='b'.repeat(40),FALLBACK=Model.FALLBACK_SHA;
const config={branch:Model.BRANCH,fallbackSha:FALLBACK,sha:FALLBACK,version:'1.2.0',schema:'2.1.0',status:'development',locales:['en','fr']};
const documents={
  manifest:{game_id:'cyberpunk-tcg',database_version:'1.2.0',runtime_scope:'cyberpunk-beta-2026',status:'development',runtime_ready:true,runtime_blockers:[],availableLocales:['en','fr']},
  databaseManifest:{schemaVersion:'2.1.0',databaseVersion:'1.2.0',activeSnapshot:'2026-09-24',status:'development',runtimeReady:true},
  candidateReport:{sourceSnapshot:{snapshotDate:'2026-09-24',capturedAt:'2026-09-24T19:09:56Z',canonicalCards:151,expectedOfficialPrintings:700,officialSite:'https://cyberpunktcg.com/cards'},sourceStatus:{authority:'OFFICIAL_SITE_THIRD_PARTY_BACKEND',assetRightsReviewRequired:true},updateSummary:{newCards:[],newPrintings:['p1','p2','p3'],newLocales:['fr'],newAssets:['a1','a2'],changedAssets:[],missingAssets:['m1','m2']}},
  syncReport:{mode:'staging_only',snapshotDate:'2026-09-12',sourceHealth:'HEALTHY',canonicalCards:151,printings:460,blocked:false,warnings:[]},
  coverage:{canonicalCards:151,officialPrintings:700,runtimeEligiblePrintings:229,runtimeDisplayAssets:229,runtimeVisionAssets:229,visionEligible:229,visionMissing:0,futureAssetsMissing:253},
  multilingualCoverage:{availableLocales:['en','fr'],localizationCoverage:{en:{canonicalCards:151,printings:550,displayAssets:447,visionAssets:447,missingAssets:103,missingMetadata:[]},fr:{canonicalCards:140,printings:150,displayAssets:0,visionAssets:0,missingAssets:150,missingMetadata:['officialRulesText','flavorText','typeLabel','tagLabels','keywordLabels']}}}
};
let assertions=0;
function check(condition,message){assert(condition,message);assertions++;}
function response(value,status=200){return {ok:status>=200&&status<300,status,text:async()=>JSON.stringify(value)};}
async function run(){
  const registryBefore=JSON.stringify(activeRegistry.databases),active=Model.activeFrom(activeRegistry);
  assert.deepEqual(active,{version:'1.1.0',sha:PIN,manifestUrl:'https://raw.githubusercontent.com/maximelaburthe-commits/tcgate_db_cyberpunk/'+PIN+'/manifest.json',game:'cyberpunk-tcg',status:'candidate-qualified',runtimeScope:'cyberpunk-beta-2026',runtimeReady:true,canonicalCards:150,runtimePrintings:229,recognitionGroups:150,matcherReferences:229,source:'public/game-databases.js'});assertions++;
  check(Model.activeFrom(activeRegistry,'swu')===null,'SWU active must remain unconfigured');
  check(Model.activeFrom({get:()=>({...activeRegistry.get('cyberpunk'),manifestUrl:'https://raw.githubusercontent.com/owner/db/main/manifest.json'})}).sha===null,'Mutable ref cannot be reported as immutable SHA');
  const urls=Model.candidateUrls(HEAD);check(Object.values(urls).every(url=>url.includes('/'+HEAD+'/')),'Every document must use resolved immutable SHA');
  assert.throws(()=>Model.candidateUrls('main'));assertions++;
  const requests=[],now=()=> '2026-10-24T10:00:00.000Z';
  const fetchImpl=async(url,options)=>{
    requests.push({url,options});assert.equal(options.method,'GET');assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');
    if(url.startsWith('https://api.github.com/'))return response({sha:HEAD});
    const key=Object.keys(urls).find(key=>urls[key]===url);return response(documents[key],key?200:404);
  };
  const loaded=await Model.loadCandidate(config,{fetchImpl,now});
  check(loaded.sha===HEAD,'Candidate branch HEAD must be resolved');
  check(loaded.headSource.startsWith('GitHub API'),'Actual HEAD source must be displayed');
  check(loaded.headResolvedAt===now()&&loaded.lastRead===now(),'Read timestamps must be available');
  check(requests.length===7,'HEAD and all six Candidate/staging documents are read');
  check(requests[0].url.endsWith('/commits/develop-cyberpunk-db-v1.2'),'Configured Candidate branch');
  check(loaded.urls.manifest===urls.manifest&&loaded.validManifest,'Candidate manifest must be SHA pinned and inspected');
  check(loaded.version==='1.2.0'&&loaded.schema==='2.1.0','Manifest version and DB schema');
  check(loaded.canonicalCards===151&&loaded.printings===700,'Candidate catalogue counts');
  check(loaded.snapshotDate==='2026-09-24'&&loaded.capturedAt==='2026-09-24T19:09:56Z','Candidate snapshot date');
  check(loaded.staging.snapshotDate==='2026-09-12'&&loaded.staging.printings===460,'Staging snapshot remains distinct');
  check(loaded.update.changes.newCards.count===0&&loaded.update.changes.newPrintings.count===3,'New card/printing arrays count independently');
  check(loaded.update.changes.newAssets.count===2&&loaded.update.changes.changedAssets.count===0,'New/changed asset counts');
  check(loaded.update.changes.missingAssets.count===2&&loaded.update.changes.missingAssets.items.join(',')==='m1,m2','All missing asset identifiers retained');
  check(loaded.update.changes.newLocales.items.join(',')==='fr','New locale summary');
  check(loaded.update.changes.missingMetadata.count===5&&loaded.update.changes.missingMetadata.items[0]==='fr : officialRulesText','Metadata counts and full localized list');
  check(loaded.localeCoverage[1].missingAssets.count===150&&loaded.localeCoverage[1].missingMetadata.items.length===5,'Full FR coverage');
  check(loaded.displayAssets===447&&loaded.visionAssets===447&&loaded.runtimeVisionAssets===229,'Runtime and complete locale asset totals remain separate');
  check(loaded.visionEligible===229&&loaded.visionMissing===0&&loaded.futureAssetsMissing===253&&loaded.update.changes.missingAssets.count===2,'Runtime coverage, catalogue missing assets and update delta stay distinct');
  check(loaded.game==='cyberpunk-tcg'&&loaded.runtimeScope==='cyberpunk-beta-2026','Candidate game and runtime scope derive from manifest metadata');
  check(loaded.update.assetRightsReviewRequired===true&&loaded.runtimeReady===true,'Rights review and runtime readiness remain independent');
  check(loaded.badges.includes('DEVELOPMENT')&&loaded.badges.includes('CANDIDATE')&&loaded.badges.includes('READY FOR LAB')&&!loaded.badges.includes('QUALIFIED'),'JS tests never qualify a Candidate');
  const qualified=Model.normalizeCandidate(config,{...documents,manifest:{...documents.manifest,status:'candidate-qualified'}},{sha:HEAD});
  check(qualified.badges.includes('QUALIFIED'),'Qualification may come from actual Candidate data');
  const blocked=Model.normalizeCandidate(config,{manifest:{...documents.manifest,runtime_ready:false,runtime_blockers:['missing-runtime']}},{sha:HEAD});
  check(blocked.badges.includes('BLOCKED')&&!blocked.badges.includes('READY FOR LAB'),'Readiness false/actual blockers cannot be ready');
  const fallback=await Model.loadCandidate(config,{now,fetchImpl:async(url,options)=>{assert.equal(options.method,'GET');return response({},url.includes('api.github.com')?403:404);}});
  check(fallback.sha===FALLBACK&&fallback.headSource.includes('fallback'),'API rate-limit uses configured fallback');
  check(fallback.headResolvedAt===null&&fallback.snapshotDate===null&&fallback.staging.snapshotDate===null,'Missing reports never invent timestamps');
  check(fallback.fallbackOnly&&fallback.version==='1.2.0'&&fallback.canonicalCards===null,'Known fallback remains useful without fabricated report counts');
  check(fallback.errors.length===7&&!fallback.badges.includes('QUALIFIED'),'Partial/unavailable reads remain visible');
  const fallbackWithReports=await Model.loadCandidate(config,{now,fetchImpl:async url=>{
    if(url.startsWith('https://api.github.com'))throw Error('offline');
    const key=Object.keys(Model.PATHS).find(key=>url.endsWith('/'+Model.PATHS[key]));check(url.includes('/'+FALLBACK+'/'),'Fallback reports must remain SHA pinned');return response(documents[key]);
  }});
  check(fallbackWithReports.validManifest&&fallbackWithReports.headSource.includes('fallback')&&fallbackWithReports.snapshotDate==='2026-09-24','Fallback SHA can still return real snapshot reports');
  const partial=Model.normalizeCandidate(config,{manifest:documents.manifest,databaseManifest:{...documents.databaseManifest,activeSnapshot:'2026-10-01'},candidateReport:{}});
  check(partial.snapshotDate==='2026-10-01'&&partial.snapshotSource==='db-manifest.json'&&partial.capturedAt===null,'Empty report must not borrow or relabel a DB manifest snapshot date');
  check(Model.normalizeCandidate(config,{manifest:documents.manifest,candidateReport:{},coverage:{snapshotDate:'2026-10-02'}}).snapshotSource==='data/coverage.json','Coverage fallback date keeps its actual source');
  const badHead=await Model.resolveCandidate(config,{fetchImpl:async()=>response({sha:'main'}),now});
  check(badHead.sha===FALLBACK&&badHead.headResolvedAt===null,'Malformed HEAD safely falls back');
  const malformed=await Model.loadCandidate(config,{fetchImpl:async url=>url.startsWith('https://api.github.com')?response({sha:HEAD}):{ok:true,text:async()=>'{invalid'},now});
  check(!malformed.validManifest&&malformed.errors.length===6,'Malformed reports are contained');
  const wrongGame=Model.normalizeCandidate(config,{manifest:{...documents.manifest,game_id:'wrong-game',status:'candidate-qualified'}});
  check(!wrongGame.validManifest&&wrongGame.game==='wrong-game'&&!wrongGame.badges.includes('READY FOR LAB')&&!wrongGame.badges.includes('QUALIFIED'),'Wrong game is visible and cannot be qualified or passed to Lab as inspected Candidate');
  assert.deepEqual(Model.parseSyncReport({snapshotDate:'2026-09-12'}).snapshotDate,'2026-09-12');assertions++;
  check(Model.WORKFLOW_URL==='https://github.com/maximelaburthe-commits/tcgate_db_cyberpunk/actions/workflows/build-database.yml','Exact human workflow link');
  check(JSON.stringify(activeRegistry.databases)===registryBefore,'Maintenance never mutates active application registry');
  const client=fs.readFileSync(__dirname+'/public/workspace-database-maintenance.js','utf8'),model=fs.readFileSync(__dirname+'/public/workspace-database-maintenance-model.js','utf8');
  check(client.includes("new CustomEvent('tcgate-workspace-test-candidate'")&&client.includes('manifestUrl:candidate.urls.manifest'),'Candidate handoff contains SHA-pinned manifest');
  check(!/TCGIdentificationLab|labStart|\.start\(/.test(client),'Candidate action cannot auto-start identification');
  check(client.includes('promote = false')&&client.includes('Validate TCGate database'),'Human workflow instructions');
  check(client.includes('Snapshot Candidate')&&client.includes('Dernière synchronisation staging'),'Distinct dated source sections');
  check(client.includes("element('details'")&&client.includes('summary.items.forEach'),'Full identifier lists are collapsed details');
  check(!/Authorization|github_pat_|ghp_|method\s*:\s*['"](?:POST|PUT|PATCH|DELETE)/.test(client+model),'No credentials or GitHub writes');
  console.log('WORKSPACE_DATABASE_MAINTENANCE_OK · '+assertions+' assertions · ACTIVE registry, immutable Candidate HEAD/fallback, snapshots, changes, locales, rights, safe workflow and Lab handoff');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
