'use strict';
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const path=require('node:path');
const net=require('node:net');
let assertions=0;
function check(condition,message){assert(condition,message);assertions++;}
async function availablePort(){const listener=net.createServer();await new Promise((resolve,reject)=>{listener.once('error',reject);listener.listen(0,'127.0.0.1',resolve);});const port=listener.address().port;await new Promise(resolve=>listener.close(resolve));return port;}
async function run(){
 const port=await availablePort(),base='http://127.0.0.1:'+port;
 const serverFile=process.env.TCGATE_UI12_SERVER||path.join(__dirname,'server.js');
 const child=spawn(process.execPath,[serverFile],{cwd:path.dirname(serverFile),env:{...process.env,PORT:String(port),HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});
 let logs='';child.stdout.on('data',data=>logs+=data);child.stderr.on('data',data=>logs+=data);
 const streamController=new AbortController();let reader;
 const call=async(url,method='GET',body,actor,cookie)=>{
  const headers={};if(body!==undefined)headers['Content-Type']='application/json';if(actor?.sessionToken)headers.Authorization='Bearer '+actor.sessionToken;if(cookie)headers.Cookie=cookie;
  const response=await fetch(base+url,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  const data=await response.json();return {status:response.status,data,cookie:(response.headers.get('set-cookie')||'').split(';')[0]};
 };
 const state=actor=>call('/api/rooms/'+actor.code+'/state?peer='+encodeURIComponent(actor.peerId),'GET',undefined,actor);
 const patch=(actor,fields)=>call('/api/rooms/'+actor.code,'PATCH',{peerId:actor.peerId,...fields},actor);
 const signal=(actor,payload,type='gig-state')=>call('/api/signal','POST',{room:actor.code,from:actor.peerId,type,payload},actor);
 let sseBuffer='',sseQueue=[];
 async function eventWhere(type,predicate){
  const timeout=setTimeout(()=>streamController.abort(),3500);
  try{
   while(true){
    const found=sseQueue.findIndex(event=>event.type===type&&predicate(event.data));if(found>=0)return sseQueue.splice(found,1)[0].data;
    const result=await reader.read();if(result.done)throw Error('SSE stream ended before '+type);
    sseBuffer+=new TextDecoder().decode(result.value);
    const events=sseBuffer.split('\n\n');sseBuffer=events.pop();
    for(const text of events){const lines=text.split('\n'),name=lines.find(line=>line.startsWith('event: ')),data=lines.find(line=>line.startsWith('data: '));if(name&&data)sseQueue.push({type:name.slice(7),data:JSON.parse(data.slice(6))});}
   }
  }finally{clearTimeout(timeout);}
 }
 try{
  let healthy=false;for(let attempt=0;attempt<80;attempt++){try{const response=await fetch(base+'/api/health');if(response.ok){healthy=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,50));}check(healthy,'Server must start: '+logs);
  const created=await call('/api/rooms','POST',{name:'UI12 Host'});check(created.status===201,'Host room creation');let host=created.data;let hostCookie=created.cookie;
  check(host.room.game==='cyberpunk'&&host.room.gigDiceEnabled===true,'Creation defaults to Cyberpunk with Gig Dice enabled');
  check(typeof host.room.gigDiceEnabled==='boolean'&&Number.isFinite(host.room.serverNowMs),'Snapshot has typed bool and authoritative clock');
  const noGame=await call('/api/rooms','POST',{name:'Universal Host',game:'no-game',gigDiceEnabled:true});check(noGame.status===201&&noGame.data.room.gigDiceEnabled===false,'No-game creation forces false even with an untrusted true field');
  const recoveryNoGame=await call('/api/recovery-state','GET',undefined,undefined,noGame.cookie);check(recoveryNoGame.data.available&&recoveryNoGame.data.gigDiceEnabled===false,'No-game recovery-state exposes false');
  const joined=await call('/api/rooms/'+host.code+'/join','POST',{name:'UI12 Guest'});check(joined.status===200,'Guest joins room');const guest=joined.data;
  check(guest.room.gigDiceEnabled===true&&guest.role==='guest','Join hydrates shared bool');
  const ticket=await call('/api/events-ticket','POST',{room:host.code,peerId:guest.peerId},guest);check(ticket.status===200&&ticket.data.ticket,'Guest event ticket');
  const stream=await fetch(base+'/api/events?ticket='+encodeURIComponent(ticket.data.ticket),{signal:streamController.signal});check(stream.ok,'Guest SSE opens');reader=stream.body.getReader();
  check((await eventWhere('room-state',room=>room.code===host.code)).gigDiceEnabled===true,'Initial SSE snapshot contains bool');
  const dice=[{id:'host-ui12',origin:'host',owner:'guest',sides:6,value:4}];
  const validState=await signal(host,{dice});check(validState.status===200&&validState.data.delivered===1,'Enabled Gig payload forwarded');
  const forwarded=await eventWhere('signal',event=>event.type==='gig-state'&&Array.isArray(event.payload?.dice));assert.deepEqual(forwarded.payload.dice,dice);assertions++;check(forwarded.fromRole==='host','Payload owner transport unchanged');
  check((await signal(guest,{request:true})).status===200,'Enabled Guest Gig request accepted');
  check((await signal(host,{dice:[{...dice[0],value:7}]})).status===400,'Existing dice payload validation still rejects out-of-range values');
  const forbidden=await patch(guest,{gigDiceEnabled:false});check(forbidden.status===403,'Guest cannot modify shared Gig Dice');
  check((await state(host)).data.room.gigDiceEnabled===true,'Guest rejection leaves option intact');
  for(const value of ['false',0,1,null,[],{}]){check((await patch(host,{gigDiceEnabled:value})).status===400,'Non-boolean option rejected: '+JSON.stringify(value));}
  check((await state(guest)).data.room.gigDiceEnabled===true,'Invalid values leave shared bool intact');
  const invalidMixed=await patch(host,{game:'no-game',name:'Should Not Apply',gigDiceEnabled:true});check(invalidMixed.status===400,'Cannot activate module while switching to no-game');
  const afterInvalid=await state(host);check(afterInvalid.data.room.game==='cyberpunk'&&afterInvalid.data.room.peers.find(peer=>peer.id===host.peerId).name==='UI12 Host','Gig-specific refusal precedes all settings mutations');
  const disabled=await patch(host,{gigDiceEnabled:false});check(disabled.status===200&&disabled.data.room.gigDiceEnabled===false,'Host disables shared Gig Dice');
  const guestDisabled=await eventWhere('room-state',room=>room.gigDiceEnabled===false);check(guestDisabled.game==='cyberpunk','SSE propagates disabled bool to Guest without changing game');
  check((await state(guest)).data.room.gigDiceEnabled===false,'Guest authenticated state exposes false');
  check((await signal(host,{dice})).status===403,'Disabled module blocks Host state forwarding');check((await signal(host,{request:true})).status===403,'Disabled module blocks Host state requests');
  check((await signal(guest,{dice})).status===403,'Disabled module blocks Guest state forwarding');check((await signal(guest,{request:true})).status===403,'Disabled module blocks Guest requests');
  const media={cameraEnabled:true,microphoneEnabled:false};check((await signal(host,media,'media-state')).status===200,'Unrelated media-state signaling preserved');
  assert.deepEqual((await eventWhere('signal',event=>event.type==='media-state')).payload,media);assertions++;
  const recovery=await call('/api/recovery-state','GET',undefined,undefined,hostCookie);check(recovery.data.available&&recovery.data.gigDiceEnabled===false,'Recovery availability exposes disabled bool');
  const resumed=await call('/api/resume','POST',{room:host.code,peerId:host.peerId},host);check(resumed.status===200&&resumed.data.room.gigDiceEnabled===false,'F5 resume retains disabled bool');
  const recovered=await call('/api/recover','POST',undefined,undefined,hostCookie);check(recovered.status===200&&recovered.data.room.gigDiceEnabled===false,'Cookie recovery retains disabled bool');
  check(recovered.data.sessionToken!==host.sessionToken&&recovered.cookie!==hostCookie,'Existing bearer and cookie rotation preserved');host={...host,...recovered.data};hostCookie=recovered.cookie;
  check((await patch(host,{game:'cyberpunk'})).data.room.gigDiceEnabled===false,'Patching current game does not re-enable disabled module');
  check((await patch(host,{game:'no-game'})).data.room.gigDiceEnabled===false,'Switch to no-game forces false');
  check((await patch(host,{gigDiceEnabled:true})).status===400,'No-game cannot activate module');
  check((await state(host)).data.room.game==='no-game'&&(await state(host)).data.room.gigDiceEnabled===false,'Rejected no-game activation preserves false');
  check((await signal(host,{request:true})).status===403,'No-game cannot request Gig state');
  const combined=await patch(host,{game:'cyberpunk',gigDiceEnabled:false});check(combined.status===200&&combined.data.room.game==='cyberpunk'&&combined.data.room.gigDiceEnabled===false,'Explicit false wins on switch to Cyberpunk');
  await patch(host,{game:'no-game'});const backToCyberpunk=await patch(host,{game:'cyberpunk'});check(backToCyberpunk.data.room.gigDiceEnabled===true,'Actual no-game to Cyberpunk transition restores historical default');
  check((await signal(host,{dice})).status===200,'Re-enabled module uses unchanged payload transport');
  const hostTimer=await patch(host,{timer:{enabled:false,durationMinutes:25}});check(hostTimer.status===200&&hostTimer.data.room.timer.durationSeconds===1500&&hostTimer.data.room.gigDiceEnabled===true,'Existing Host Timer settings preserved');
  check((await patch(guest,{timer:{enabled:true,durationMinutes:15}})).status===403,'Timer remains Host-only');
  check((await patch(guest,{game:'no-game'})).status===403,'Game selection remains Host-only');
  const hostReady=await call('/api/ready','POST',{room:host.code,peerId:host.peerId,ready:true},host);check(hostReady.status===200&&hostReady.data.room.phase==='lobby','First Ready does not launch');
  const readyToggle=await patch(host,{gigDiceEnabled:false});check(readyToggle.status===200&&readyToggle.data.room.peers.find(peer=>peer.id===host.peerId).ready===true,'Existing lobby-only lock semantics and Ready state preserved');
  const guestReady=await call('/api/ready','POST',{room:host.code,peerId:guest.peerId,ready:true},guest);check(guestReady.status===200&&guestReady.data.room.phase==='game'&&guestReady.data.room.gigDiceEnabled===false,'Two Ready actors launch with shared disabled option');
  check((await patch(host,{gigDiceEnabled:true})).status===409,'Room option locked after launch');check((await patch(host,{game:'no-game'})).status===409,'Existing game settings lock after launch preserved');
  const gameResume=await call('/api/resume','POST',{room:host.code,peerId:host.peerId},host);check(gameResume.data.room.phase==='game'&&gameResume.data.room.gigDiceEnabled===false&&gameResume.data.room.peers.every(peer=>peer.ready),'Game resume preserves phase, Ready and module');
  const gameRecover=await call('/api/recover','POST',undefined,undefined,hostCookie);check(gameRecover.status===200&&gameRecover.data.room.phase==='game'&&gameRecover.data.room.gigDiceEnabled===false,'In-game persistent recovery retains disabled module');
  check((await signal(guest,{request:true})).status===403,'Disabled Gig remains blocked after recovery');
  console.log('TCGATE_UI_1_2_ROOM_OK - '+assertions+' assertions - Host/Guest HTTP+SSE, defaults, access, snapshots, recovery, signaling and existing locks');
 }finally{
  streamController.abort();try{await reader?.cancel();}catch{}child.kill('SIGTERM');setTimeout(()=>child.kill('SIGKILL'),1000).unref();
 }
}
run().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
