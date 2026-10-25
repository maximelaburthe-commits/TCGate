(function initPhonePrivacy(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.TCGatePhoneCameraPrivacy=api;
})(typeof window!=='undefined'?window:globalThis,function createPhonePrivacy(){
  'use strict';
  function privateKey(key){
    const name=key.replace(/[_-]/g,'').toLowerCase();
    return /token|authorization|cookie|password|secret|credential|username|iceufrag|icepwd|iceservers|sdp|deviceid|groupid|rawcandidate/.test(name)||/^(proto|prototype|constructor|ip|ipaddress|address|localip|remoteip|localaddress|remoteaddress|candidate|candidates|image|images|frame|frames|video|audio|screenshot|screenshots)(data|bytes|buffer|base64|url)?$/.test(name);
  }
  function text(value,secrets=[]){
    let result=String(value);
    for(const secret of secrets)if(typeof secret==='string'&&secret.length>=8)result=result.split(secret).join('[redacted]');
    if(/(?:data:|blob:)/i.test(result)||/\bsdp["']?\s*[:=]|\bv=0(?:\\r|\\n|\r|\n|$)|(?:^|\n)\s*(?:o=|m=(?:audio|video)|a=(?:candidate|ice-)|c=IN)\b|\bcandidate:\d+/i.test(result))return '[redacted]';
    return result
      .replace(/\bBearer\s+[^\s,;]+/gi,'Bearer [redacted]')
      .replace(/\b([\w-]*(?:tokens?|authorization|password|secrets?|credentials?|username|cookie|ice[-_]?ufrag|ice[-_]?pwd|device[-_]?id|group[-_]?id))["']?\s*[:=]\s*["']?[^\s"'&,;]+/gi,'$1=[redacted]')
      .replace(/(?:\b(?:[a-f\d]{1,4}:){2,}[a-f\d:.]*(?:%[\w-]+)?|::(?:[a-f\d]{1,4}:)*[a-f\d:.]+(?:%[\w-]+)?)/gi,'[redacted-ip]')
      .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g,'[redacted-ip]')
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,' ');
  }
  function sanitize(value,{secrets=[]}={}){
    function clean(item,depth){
      if(depth>8)return null;
      if(item==null||typeof item==='boolean')return item;
      if(typeof item==='number')return Number.isFinite(item)?item:null;
      if(typeof item==='string')return item.length>1000?null:text(item,secrets);
      if(Array.isArray(item))return item.slice(-120).map(entry=>clean(entry,depth+1));
      if(typeof item!=='object')return null;
      const result={};
      for(const[key,entry]of Object.entries(item).slice(0,80))if(!privateKey(key))result[key]=clean(entry,depth+1);
      return result;
    }
    return clean(value,0);
  }
  return Object.freeze({sanitize,text});
});
