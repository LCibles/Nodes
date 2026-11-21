import {mkdir, readFile, writeFile} from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const types = {
  'index.html':'text/html',
  'style.css':'text/css',
  'app.js':'text/javascript',
  'github.js':'text/javascript'
};
const assets = Object.fromEntries(await Promise.all(Object.entries(types).map(async ([file, type]) => [
  '/' + file, {type:type + '; charset=utf-8', body:await readFile(new URL('dist/' + file, root), 'utf8')}
])));
const worker = await readFile(new URL('worker/index.mjs', root), 'utf8');
const source = 'const assets = ' + JSON.stringify(assets) + ';\n' + worker;
await mkdir(new URL('dist/server/', root), {recursive:true});
await writeFile(new URL('dist/server/index.js', root), source);
