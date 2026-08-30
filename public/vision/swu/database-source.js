function cleanBase(value) { return String(value || '').replace(/\/+$/, ''); }
function isAbsoluteHttp(value) { return /^https?:\/\//i.test(String(value || '')); }

export function resolveDatabasePath(baseUrl, relativePath) {
  const raw=String(relativePath || '');
  if (isAbsoluteHttp(raw)) return raw;
  const path=raw.replace(/^\/+/, '');
  if (!baseUrl || !path || path.includes('..')) throw new Error('Unsafe database path');
  return `${cleanBase(baseUrl)}/${path}`;
}
export class DatabaseSource {
  constructor({ baseUrl, fetchImpl=globalThis.fetch }) {
    if (typeof fetchImpl !== 'function') throw new Error('Fetch API unavailable');
    this.baseUrl=cleanBase(baseUrl);
    this.fetch=fetchImpl.bind(globalThis);
  }
  url(path) { return resolveDatabasePath(this.baseUrl, path); }
  async response(path, options={}) {
    const response=await this.fetch(this.url(path), { cache:'no-cache', ...options });
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    return response;
  }
  async json(path) { return (await this.response(path)).json(); }
  async arrayBuffer(path) { return (await this.response(path)).arrayBuffer(); }
}
