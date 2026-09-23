// Synthetic local preview. Replaces all Supabase access; never uses .env or credentials.
import { createRequire } from 'node:module';
import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const require = createRequire(import.meta.url);
const { build } = await import(pathToFileURL(path.join(path.dirname(require.resolve('lovable-tagger/package.json')), 'node_modules/esbuild/lib/main.js')));
const root = process.cwd();
const out = await mkdtemp(path.join(tmpdir(), 'issued-quote-preview-'));
const mock = `export const supabase = { from(table) { const filters = {}; let single = false; const chain = {
  select(){return chain}, eq(k,v){filters[k]=v;return chain}, neq(){return chain}, in(){return chain}, order(){return chain}, limit(){return chain},
  maybeSingle(){single=true;return chain}, single(){single=true;return chain},
  then(resolve) {
    let data=[];
    if(table==='panel_masters') data=[{id:filters.quality,quality:filters.quality}];
    if(table==='panel_pricing_versions') data=[{id:'test-version',version_name:'격리 현재 단가표',supplier_name:'TEST',effective_from:'2026-09-23'}];
    if(table==='panel_sizes') data=[{id:'size',panel_master_id:filters.panel_master_id, size_name:'4*8',thickness:filters.thickness,price:100000,is_active:true,actual_width:1220,actual_height:2440,pricing_version_id:'test-version'}];
    if(table==='processing_options') data=[{option_id:'raw-only',name:'원판 구매',option_type:'processing',category:'raw',multiplier:1.8,pricing_method:'panel_multiplier',is_active:true}];
    if(table==='color_options') data=[1,2].map(n=>({id:'color-'+filters.panel_master_id+'-'+n,color_name:'AC-A00'+n+' 테스트',color_code:n===1?'#ffffff':'#dd3344',is_active:true,is_producible:true}));
    const error = document.body.dataset.failPrices==='true' && table==='panel_sizes' ? new Error('격리 조회 실패') : null;
    return Promise.resolve({data: error ? null : single ? data[0] || null : data,error}).then(resolve);
  }
}; return chain; }};`;
await build({ entryPoints: ['tests/issued-quote-spec-preview.tsx'], outfile: path.join(out, 'preview.js'), bundle: true, format: 'esm', jsx: 'automatic', alias: { '@': path.join(root, 'src') },
  plugins: [{ name: 'no-live-db', setup(api) { api.onResolve({ filter: /integrations\/supabase\/client$/ }, () => ({ path: 'mock', namespace: 'no-live-db' })); api.onLoad({ filter: /.*/, namespace: 'no-live-db' }, () => ({ contents: mock, loader: 'js' })); } }],
});
const css = (await readdir('dist/assets')).find(file => file.endsWith('.css'));
await writeFile(path.join(out, 'index.html'), `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><title>격리 견적 검증</title><div id="root"></div><script type="module" src="/preview.js"></script>`);
createServer(async (req,res) => { try { const file = req.url === '/preview.js' ? path.join(out,'preview.js') : req.url === '/style.css' ? path.join(root,'dist/assets',css) : path.join(out,'index.html'); res.setHeader('Content-Type', req.url === '/preview.js' ? 'text/javascript' : req.url === '/style.css' ? 'text/css' : 'text/html'); res.end(await readFile(file)); } catch { res.writeHead(404);res.end(); } }).listen(4179,'127.0.0.1',()=>console.log('Isolated preview: http://127.0.0.1:4179 (no live DB)'));
