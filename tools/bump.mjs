// 一鍵升版：讓所有模組與樣式的快取失效
// 用法：node tools/bump.mjs   （改完程式、commit 前跑一次）
import { readFileSync, writeFileSync } from 'fs';

// 用腳本自身位置解析路徑，避免依賴執行時的當前工作目錄
const rootDir = new URL('../', import.meta.url);
const indexPath = new URL('index.html', rootDir);

let idx;
try {
  idx = readFileSync(indexPath, 'utf8');
} catch (e) {
  console.error(`✗ 找不到 index.html（${indexPath.pathname}）：${e.message}`);
  process.exit(1);
}

const match = idx.match(/main\.js\?v=(\d+)/);
if (!match) {
  console.error('✗ 在 index.html 中找不到 "main.js?v=<數字>" 的版本標記，已中止（避免版本號被靜默重置為 0）。');
  process.exit(1);
}
const cur = +match[1];
const next = cur + 1;

// index.html：style.css 與 main.js 的版本
let out = idx
  .replace(/style\.css\?v=\d+/g, `style.css?v=${next}`)
  .replace(/main\.js\?v=\d+/g, `main.js?v=${next}`);
try {
  writeFileSync(indexPath, out);
} catch (e) {
  console.error(`✗ 寫入 index.html 失敗：${e.message}`);
  process.exit(1);
}

// src/*.js：內部 import 全部帶上同一版本
for (const f of ['src/store.js', 'src/calc.js', 'src/cloud.js', 'src/ui.js', 'src/main.js']) {
  const filePath = new URL(f, rootDir);
  try {
    let s = readFileSync(filePath, 'utf8');
    s = s.replace(/from '\.\/(store|calc|cloud|ui)\.js\?v=\d+'/g, (_, m) => `from './${m}.js?v=${next}'`);
    writeFileSync(filePath, s);
  } catch (e) {
    console.error(`✗ 處理 ${f} 失敗：${e.message}`);
    process.exit(1);
  }
}
console.log(`版本已升至 v=${next}（index.html＋全部模組 import）`);
