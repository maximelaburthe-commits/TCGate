'use strict';
// External developer tool: Git reads only; writes only explicit manifest output
// and its own temporary diff inputs. No commit, checkout, index or source edit.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {execFileSync,spawnSync}=require('node:child_process');
const BASELINE_SHA='7082e92a66b50d0e0654ef44a6bdba89b0715e2b';
const PATHS=['public/identification.js','public/identification-worker.js'];
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const lf=b=>b.toString('utf8').replace(/\r\n/g,'\n');
const allowedFunctions={
  'public/identification.js':new Set(['matcherWorkerPayload','rehydrateWorkerResult','identifyCanvas','identityKey','identifyTrack','onPointerMove','refreshStationaryPointerHover','serializeRanked','canonicalRankCandidates','qualificationDecision','beginQualificationTracking']),
  'public/identification-worker.js':new Set(['canonicalRankCandidates','metaRef','identify'])
};
function functionSections(source){
  const out=new Map();
  for(const match of source.matchAll(/^([ \t]*)(?:async )?function (\w+)\([^\n]*\)\s*\{/gm)){
    const firstEnd=source.indexOf('\n',match.index),firstLine=source.slice(match.index,firstEnd);let end=firstEnd;
    if(!firstLine.trimEnd().endsWith('}')){
      const closing=new RegExp('^'+match[1]+'}[;]?$','gm');closing.lastIndex=firstEnd;const last=closing.exec(source);
      if(!last)throw Error('Unterminated source function '+match[2]);end=last.index+last[0].length;
    }
    if(out.has(match[2]))throw Error('Duplicate named engine function '+match[2]);out.set(match[2],source.slice(match.index,end));
  }
  return out;
}
function assertProtected(file,before,after){
  const a=functionSections(before),b=functionSections(after),allowed=allowedFunctions[file];
  for(const [name,source] of a)if(!allowed.has(name)&&b.get(name)!==source)throw Error('Protected engine function changed: '+file+':'+name);
  for(const name of b.keys())if(!a.has(name)&&!allowed.has(name))throw Error('Unauthorised new engine function: '+name);
  const constants=s=>[...s.matchAll(/^[ \t]*const ([A-Z][A-Z_0-9]*)\s*=[\s\S]*?;/gm)].map(m=>[m[1],m[0]]);
  if(JSON.stringify(constants(before))!==JSON.stringify(constants(after)))throw Error('Protected engine constants changed: '+file);
  const compact=s=>s.replace(/\s/g,'');
  const acceptance=['(best.score>=NORMAL_ACCEPT&&margin>=NORMAL_MARGIN)||(best.score>=LOW_ACCEPT&&margin>=LOW_MARGIN)','mb.score>=.655&&mm>=.038','mm>margin+.035'];
  for(const expression of acceptance)if(compact(before).split(expression).length!==compact(after).split(expression).length)throw Error('Protected acceptance thresholds changed: '+file);
  if(!after.includes("ref?.locale==='en'&&ref.cardId")||!after.includes("'physical:'+index"))throw Error('EN-only canonical boundary missing: '+file);
}
function offsets(source){const out=[0];for(let i=0;i<source.length;i++)if(source[i]==='\n')out.push(i+1);return out;}
function parseHunks(diff,before,after){
  const oldOffsets=offsets(before),newOffsets=offsets(after),lines=diff.split('\n'),hunks=[];let h=null;
  for(const line of lines){
    const m=line.match(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
    if(m){h={oldStart:Number(m[1]),oldLines:m[2]===undefined?1:Number(m[2]),newStart:Number(m[3]),newLines:m[4]===undefined?1:Number(m[4]),before:'',after:''};hunks.push(h);continue;}
    if(!h)continue;
    if(line.startsWith(' ')){h.before+=line.slice(1)+'\n';h.after+=line.slice(1)+'\n';}
    else if(line.startsWith('-'))h.before+=line.slice(1)+'\n';
    else if(line.startsWith('+'))h.after+=line.slice(1)+'\n';
    else if(line.startsWith('\\ No newline'))throw Error('Unexpected missing final engine newline');
  }
  if(!hunks.length)throw Error('Expected explicit canonical engine patch');
  for(const value of hunks){
    value.oldOffset=oldOffsets[Math.max(0,value.oldStart-1)];value.newOffset=newOffsets[Math.max(0,value.newStart-1)];
    if(before.slice(value.oldOffset,value.oldOffset+value.before.length)!==value.before||after.slice(value.newOffset,value.newOffset+value.after.length)!==value.after)throw Error('Diff hunk does not match real source');
    if(after.indexOf(value.after)!==value.newOffset||after.indexOf(value.after,value.newOffset+value.after.length)>=0)throw Error('Nonunique literal diff anchor');
    value.beforeSha256=hash(value.before);value.afterSha256=hash(value.after);
  }
  let reversed=after;for(const value of [...hunks].reverse())reversed=reversed.slice(0,value.newOffset)+value.before+reversed.slice(value.newOffset+value.after.length);
  if(reversed!==before)throw Error('Literal hunk reversal failed entire-source equality');
  return hunks;
}
function generate({repo,afterRoot,output}){
  const git=args=>execFileSync('git',['-c','safe.directory='+path.resolve(repo),...args],{cwd:repo});
  if(git(['rev-parse',BASELINE_SHA+'^{commit}']).toString().trim()!==BASELINE_SHA)throw Error('Missing real Git baseline');
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'tcgate-6c-literal-diff-'));
  const files=PATHS.map((file,index)=>{
    const original=git(['show',BASELINE_SHA+':'+file]),before=lf(original),after=lf(fs.readFileSync(path.join(afterRoot,file)));
    assertProtected(file,before,after);
    const oldFile=path.join(temporary,index+'-before.js'),newFile=path.join(temporary,index+'-after.js');
    fs.writeFileSync(oldFile,before);fs.writeFileSync(newFile,after);
    const diff=spawnSync('git',['--no-pager','-c','core.safecrlf=false','diff','--no-index','--text','--unified=3','--',oldFile,newFile],{encoding:'utf8'});
    if(diff.status!==1)throw Error('Expected native Git diff code1, got '+diff.status+': '+diff.stderr);
    return {path:file,baselineGitBlob:git(['rev-parse',BASELINE_SHA+':'+file]).toString().trim(),baselineSha256:hash(before),afterSha256:hash(after),hunks:parseHunks(diff.stdout,before,after)};
  });
  const manifest={schemaVersion:'6C-engine-literal-patches-1',baselineProductSha:BASELINE_SHA,legacyEngineBaselineProductSha:'7baeb9844ac8a2a68b2c5a38011003514bab5f98',policy:'Reverse only every exact unique unified3 literal hunk at its recorded position. Any partial, altered, duplicated or moved match leaves the input unchanged; all other bytes remain protected by existing hashes.',files};
  if(output){
    const target=path.resolve(output);if(fs.existsSync(target)){const previous=fs.readFileSync(target),backup=target+'.previous-'+hash(previous).slice(0,16)+'.json';if(!fs.existsSync(backup))fs.writeFileSync(backup,previous,{flag:'wx'});}
    fs.writeFileSync(target,JSON.stringify(manifest,null,2)+'\n');
  }
  return manifest;
}
if(require.main===module){
  try{const args={};for(let i=2;i<process.argv.length;i+=2){const key=process.argv[i],value=process.argv[i+1];if(!['--repo','--after-root','--output'].includes(key)||!value||args[key])throw Error('Usage: --repo BASELINE_REPO --after-root STAGED_TARGET --output MANIFEST.json');args[key]=value;}
    if(!args['--repo']||!args['--after-root']||!args['--output'])throw Error('All three explicit paths required');
    const manifest=generate({repo:args['--repo'],afterRoot:args['--after-root'],output:args['--output']});console.log(JSON.stringify({baseline:BASELINE_SHA,files:manifest.files.map(f=>({path:f.path,hunks:f.hunks.length,baselineGitBlob:f.baselineGitBlob,afterSha256:f.afterSha256}))}));
  }catch(error){console.error(error.stack||error.message);process.exitCode=1;}
}
module.exports={generate,assertProtected,parseHunks};
