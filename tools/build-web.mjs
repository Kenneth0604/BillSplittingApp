// 把網頁本體（index.html／style.css／src/）複製進 www/，供 Capacitor 打包進 iOS/Android App。
// 用法：npm run build:web（cap:sync 系列指令會自動先跑這支）
//
// 為什麼要另外複製一份到 www/，而不是直接把整個專案資料夾當 webDir？
// 因為專案根目錄還有 node_modules、.git、test/、tools/ 等開發用檔案，
// 直接整包塞進 App 既龐大又不必要；www/ 只放「App 實際需要載入的檔案」。
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync } from 'fs';

const rootDir = new URL('../', import.meta.url);
const wwwDir = new URL('www/', rootDir);

// 1) 清空重建 www/
rmSync(wwwDir, { recursive: true, force: true });
mkdirSync(wwwDir, { recursive: true });

// 2) 複製 App 執行期需要的檔案
cpSync(new URL('index.html', rootDir), new URL('index.html', wwwDir));
cpSync(new URL('style.css', rootDir), new URL('style.css', wwwDir));
cpSync(new URL('src/', rootDir), new URL('src/', wwwDir), { recursive: true });

// 3) 若有 icon/manifest 之類的靜態資源也一併帶上（存在才複製，避免報錯）
for (const f of ['favicon.ico', 'manifest.json', 'icon.png']) {
  const src = new URL(f, rootDir);
  if (existsSync(src)) cpSync(src, new URL(f, wwwDir));
}

console.log(`已將網頁檔案輸出至 ${wwwDir.pathname}`);
