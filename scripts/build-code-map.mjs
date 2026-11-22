import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';

await build({
  entryPoints:[fileURLToPath(new URL('../src/code-map.mjs', import.meta.url))],
  outfile:fileURLToPath(new URL('../dist/code-map.js', import.meta.url)),
  bundle:true,
  format:'iife',
  minify:true,
  legalComments:'inline'
});
