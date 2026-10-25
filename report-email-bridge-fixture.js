'use strict';
// Test-only real HTTP server. Outbound email is intercepted in the child process.
const path=require('node:path'),http=require('node:http'),crypto=require('node:crypto');
const {fork}=require('node:child_process');
const ROOT=process.cwd();
async function startBridgeFixture({configured=true,bridgePath=path.join(ROOT,'report-mail-server.js'),root=ROOT}={}){
  const child=fork(__filename,['--bridge-child'],{cwd:root,env:{...process.env,PORT:'0',HOST:'127.0.0.1',RESEND_API_KEY:configured?'fixture-resend-key-never-real':'',TCGATE_REPORT_TO_EMAIL:configured?'recipient@example.invalid':'',TCGATE_REPORT_FROM_EMAIL:configured?'TCGate Fixture <sender@example.invalid>':'',REPORT_MAIL_TEST_ROOT:root,REPORT_MAIL_TEST_BRIDGE:path.resolve(bridgePath)},stdio:['ignore','pipe','pipe','ipc']});
  const requests=[],pending=new Map();let nextId=0,logs='';child.stdout.on('data',data=>logs+=data);child.stderr.on('data',data=>logs+=data);
  child.on('message',message=>{if(message?.type==='resend-call')requests.push(message.request);else if(message?.type==='ack'){pending.get(message.id)?.resolve();pending.delete(message.id);}});
  function command(type,value){return new Promise((resolve,reject)=>{const id=++nextId;pending.set(id,{resolve,reject});child.send({type,id,value},error=>{if(error){pending.delete(id);reject(error);}});});}
  try{
    const origin=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Fixture server did not start: '+logs)),12000);child.on('message',message=>{if(message?.type==='listening'){clearTimeout(timer);resolve('http://127.0.0.1:'+message.port);}});child.once('exit',code=>{clearTimeout(timer);reject(Error('Fixture exited '+code+': '+logs));});child.once('error',error=>{clearTimeout(timer);reject(error);});});
    return {origin,requests,setMode:mode=>command('mode',mode),clearRequests:()=>requests.splice(0),getLogs:()=>logs,close:async()=>{if(child.exitCode!==null)return;const stopped=new Promise(resolve=>child.once('exit',resolve));await command('stop').catch(()=>{});await Promise.race([stopped,new Promise(resolve=>setTimeout(()=>{child.kill();resolve();},1500))]);}};
  }catch(error){child.kill();throw error;}
}
function createTestZip(){
  const name=Buffer.from('report.json'),data=Buffer.from('{"reportSchemaVersion":2,"fixture":true}');let crc=0xffffffff;
  for(const byte of data){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}crc=(crc^0xffffffff)>>>0;
  const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(20,4);local.writeUInt32LE(crc,14);local.writeUInt32LE(data.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(name.length,26);
  const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(20,4);central.writeUInt16LE(20,6);central.writeUInt32LE(crc,16);central.writeUInt32LE(data.length,20);central.writeUInt32LE(data.length,24);central.writeUInt16LE(name.length,28);
  const directory=Buffer.concat([central,name]),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(local.length+name.length+data.length,16);
  return Buffer.concat([local,name,data,directory,end]);
}
if(process.argv.includes('--bridge-child')){
  const root=path.resolve(process.env.REPORT_MAIL_TEST_ROOT),bridge=path.resolve(process.env.REPORT_MAIL_TEST_BRIDGE);let mode='success',server;
  const originalCreate=http.createServer.bind(http);http.createServer=(...args)=>{const created=originalCreate(...args);server=created;created.once('listening',()=>process.send?.({type:'listening',port:created.address().port}));return created;};
  globalThis.fetch=async(url,options={})=>{
    if(String(url)!=='https://api.resend.com/emails')throw Error('Fixture blocked unexpected outbound URL '+String(url));
    const payload=JSON.parse(options.body),attachments=(payload.attachments||[]).map(attachment=>{const bytes=Buffer.from(attachment.content,'base64');return {filename:attachment.filename,size:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),...(bytes.length<1024?{content:attachment.content}:{})};});
    const request={url:String(url),method:options.method,headers:options.headers,payload:{...payload,attachments}};process.send?.({type:'resend-call',request});
    if(mode==='network-error')throw Error('Simulated provider network failure; fixture-resend-key-never-real');
    if(mode==='unauthorized')return new Response(JSON.stringify({message:'Simulated private provider authorization diagnostic'}),{status:401});
    if(mode==='server-error')return new Response(JSON.stringify({error:{message:'Simulated private provider server diagnostic'}}),{status:500});
    if(mode==='invalid-json')return new Response('provider response is not JSON',{status:200});
    return new Response(JSON.stringify({id:'fixture-message-id'}),{status:200});
  };
  process.on('message',message=>{if(message?.type==='mode'){mode=message.value;process.send?.({type:'ack',id:message.id});}else if(message?.type==='stop'){process.send?.({type:'ack',id:message.id});server?.closeAllConnections?.();server?.close(()=>process.exit(0));setTimeout(()=>process.exit(0),500).unref();}});
  // A staged bridge may be outside the repository. Its final import still runs the real TCGate server.
  const Module=require('node:module'),originalLoad=Module._load;Module._load=function(request,parent,isMain){if(request==='./server.js'&&parent?.filename===bridge)return originalLoad.call(this,path.join(root,'server.js'),parent,isMain);return originalLoad.call(this,request,parent,isMain);};
  require(bridge);
}else module.exports={startBridgeFixture,createTestZip};
