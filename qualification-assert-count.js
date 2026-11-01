'use strict';
// Test-process instrumentation only. Never imported by the application.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const originalLoad = Module._load;
const cache = new WeakMap();
const methods = new Set(['ok', 'fail', 'equal', 'notEqual', 'deepEqual', 'notDeepEqual', 'strictEqual', 'notStrictEqual', 'deepStrictEqual', 'notDeepStrictEqual', 'throws', 'doesNotThrow', 'rejects', 'doesNotReject', 'ifError', 'match', 'doesNotMatch', 'partialDeepStrictEqual']);
let calls = 0;
function instrument(target) {
  if (cache.has(target)) return cache.get(target);
  const wrappedMethods = new Map();
  const proxy = new Proxy(target, {
    apply(fn, receiver, args) { calls++; return Reflect.apply(fn, receiver, args); },
    get(fn, key) {
      const value = Reflect.get(fn, key);
      if (key === 'strict') return instrument(value);
      if (!methods.has(key) || typeof value !== 'function') return value;
      if (!wrappedMethods.has(key)) wrappedMethods.set(key, function (...args) { calls++; return Reflect.apply(value, fn, args); });
      return wrappedMethods.get(key);
    }
  });
  cache.set(target, proxy);
  return proxy;
}
Module._load = function (request, parent, main) {
  const loaded = originalLoad.call(this, request, parent, main);
  return /^(?:node:)?assert(?:\/strict)?$/.test(request) ? instrument(loaded) : loaded;
};
process.once('exit', () => {
  const directory = process.env.TCGATE_QUALIFICATION_ASSERT_DIR;
  if (directory) fs.writeFileSync(path.join(directory, process.pid + '.json'), JSON.stringify({ pid: process.pid, nodeAssertionCalls: calls }));
});
