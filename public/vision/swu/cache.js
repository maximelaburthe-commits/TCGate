const PREFIX='tcgate-vision-lab';
export function cacheNamespace({gameId,databaseVersion,visionProfile,descriptorVersion='v5-fast-72x108',refId=null}) {
  for (const v of [gameId,databaseVersion,visionProfile,descriptorVersion]) if (!v) throw new Error('Incomplete cache namespace');
  const parts=[PREFIX,gameId,databaseVersion,visionProfile,descriptorVersion];
  if(refId)parts.push(String(refId));
  return parts.join(':');
}
export function detailCacheNamespace(values){return cacheNamespace(values);}
export class InstrumentedCache {
  constructor(storage=globalThis.localStorage) { this.storage=storage; this.last={status:'MISS',bytes:0,rebuildMs:0}; }
  get(key) { const value=this.storage?.getItem(key); this.last={status:value?'HIT':'MISS',bytes:value?.length||0,rebuildMs:0}; return value?JSON.parse(value):null; }
  set(key,value,rebuildMs=0) { const raw=JSON.stringify(value); this.storage?.setItem(key,raw); this.last={status:'BUILD',bytes:raw.length,rebuildMs}; }
}
export class DescriptorCache {
  constructor(cacheApi=globalThis.caches){this.api=cacheApi;this.last={status:'MISS',bytes:0,rebuildMs:0};}
  requestKey(namespace){return new Request(new URL(`/__vision-cache__/${encodeURIComponent(namespace)}`,globalThis.location?.origin||'http://vision-lab.local'));}
  async get(namespace){const start=performance.now();if(!this.api)return null;const cache=await this.api.open(PREFIX),response=await cache.match(this.requestKey(namespace));if(!response){this.last={status:'MISS',bytes:0,rebuildMs:0,lookupMs:performance.now()-start};return null;}const raw=await response.text();this.last={status:'HIT',bytes:new TextEncoder().encode(raw).byteLength,rebuildMs:0,lookupMs:performance.now()-start};return JSON.parse(raw);}
  async has(namespace){if(!this.api)return false;const cache=await this.api.open(PREFIX);return Boolean(await cache.match(this.requestKey(namespace)));}
  async set(namespace,value,rebuildMs=0){if(!this.api)return;const start=performance.now(),raw=JSON.stringify(value),cache=await this.api.open(PREFIX);await cache.put(this.requestKey(namespace),new Response(raw,{headers:{'Content-Type':'application/json'}}));this.last={status:'BUILD',bytes:new TextEncoder().encode(raw).byteLength,rebuildMs,writeMs:performance.now()-start};}
  async deletePrefix(namespacePrefix){
    if(!this.api)return 0;const cache=await this.api.open(PREFIX),keys=await cache.keys();let deleted=0;
    for(const request of keys){let namespace='';try{namespace=decodeURIComponent(new URL(request.url).pathname.split('/').pop()||'');}catch{}
      if(namespace===namespacePrefix||namespace.startsWith(`${namespacePrefix}:`))deleted+=Number(await cache.delete(request));
    }
    return deleted;
  }
}
