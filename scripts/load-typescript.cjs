const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const cache = new Map();
module.exports = function load(file) {
  file = path.resolve(file);
  if (cache.has(file)) return cache.get(file).exports;
  const mod = { exports: {} }; cache.set(file, mod);
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
  const resolve = name => name.startsWith('.') ? module.exports(path.resolve(path.dirname(file), name + '.ts')) : require(name);
  new Function('module', 'exports', 'require', source)(mod, mod.exports, resolve);
  return mod.exports;
};
