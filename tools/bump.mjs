// 一鍵升版：讓所有模組與樣式的快取失效
// 用法：node tools/bump.mjs   （改完程式、commit 前跑一次）
import { readFileSync, writeFileSync } from 'fs';

const idx = readFileSync('index.html', 'utf8');
const cur = +(idx.match(/main\.js\?v=(\d+)/)?.[1] || 0);
const next = cur + 1;

// index.html：style.css 與 main.js 的版本
let out = idx
  .replace(/style\.css\?v=\d+/g, `style.css?v=${next}`)
  .replace(/main\.js\?v=\d+/g, `main.js?v=${next}`);
writeFileSync('index.html', out);

// src/*.js：內部 import 全部帶上同一版本
for (const f of ['src/store.js', 'src/calc.js', 'src/cloud.js', 'src/ui.js', 'src/main.js']) {
  let s = readFileSync(f, 'utf8');
  s = s.replace(/from '\.\/(store|calc|cloud|ui)\.js(\?v=\d+)?'/g, (_, m) => `from './${m}.js?v=${next}'`);
  writeFileSync(f, s);
}
console.log(`版本已升至 v=${next}（index.html＋全部模組 import）`);
