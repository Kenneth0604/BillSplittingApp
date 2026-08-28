# 算錢用ㄉ東西 💸

多人分帳／共同基金／個人記帳的網頁 App。單一 HTML 檔、免安裝、免後端伺服器，透過 Supabase 做雲端同步與帳號系統，部署在 GitHub Pages。

---

## 一、整體架構

```
index.html（外殼）─ style.css（樣式）
      │
      └─ <script type="module"> src/main.js（開機組裝）
              │
              ├─ src/store.js   資料層：狀態、localStorage、遷移（無相依）
              ├─ src/calc.js    純計算：結算演算法、運算式引擎、格式化（依賴 store）
              ├─ src/cloud.js   雲端層：Supabase 同步與身分（依賴 store，UI 用 hooks 注入）
              └─ src/ui.js      介面層：渲染、表單、事件（依賴以上三者）
                        │ supabase-js（CDN）
                        ▼
                  Supabase（shared_projects＋project_members＋Auth）
```

重點觀念：**所有邏輯都在前端**，程式碼以原生 ES Modules 拆分（無 bundler）。相依方向固定為 store → calc → cloud → ui → main，雲端層對 UI 的呼叫透過 `hooks`（main.js 接線）避免循環相依；HTML 樣板的內聯事件經由 `window.app` 橋呼叫模組函式。

這套網頁本體同時也是手機 App 的內容——透過 Capacitor 包了一層原生殼（`android/`／`ios/`），開啟後直接顯示這個正式網站，兩邊共用同一份程式碼，不需要另外維護。細節見第六章。

**開發注意**：ES Modules 受 CORS 限制，**不能直接雙擊 index.html 開啟（file:// 會失敗）**。本機開發請在專案資料夾跑 `python -m http.server 8000` 後開 `http://localhost:8000`；部署到 GitHub Pages 則不受影響。改版時記得把 index.html 內 `main.js?v=N` 的版本號 +1，強制使用者拿到新程式。

## 二、運作原理

### 2.1 資料模型

全部資料存在瀏覽器 `localStorage` 的 `splitapp` 這個 key，結構：

```js
{
  projects: [ /* 專案陣列 */ ],
  currentProjectId: 1,     // 目前開啟的專案
  nextProjectId: 2,        // 專案流水號
}
```

每個專案（project）：

```js
{
  id: 1,
  name: '67元快樂研究小組',
  type: 'split',                    // split=多人分帳 / fund=共同基金 / personal=個人記帳
  members: [{ id, name }],
  cats: { out: [...], in: [...] }, // 此專案的自訂分類
  expenses: [ /* 帳目，見下 */ ],
  chats: [{ name, text, time }],   // 留言區
  nextMemberId, nextExpenseId,
  cloud: { code: 'ABC123', ts },   // 有上雲才有；code=分享代碼（僅存本機，不上傳）
}
```

帳目（expense）依分帳方式有三種形態：

```js
// 均分：payer 先付 amount，splitters 平均分攤
{ id, cat, desc, amount, payer, splitters: [1,2,3], date }

// 特定付款（mode:'exact'）：逐人記「先付」與「實際支出」，兩邊合計必須相等
{ id, cat, desc, amount, mode:'exact', paid:{成員id:金額}, spent:{成員id:金額}, date }

// 隨機付款（mode:'random'）：建立當下就抽出 loser，revealed 控制是否公布
{ id, cat, desc, amount, mode:'random', payer, candidates:[...], loser, revealed, date }

// 基金／個人記帳用 kind 區分收支：'in'=存入/收入、'out'=支出
{ id, cat, desc, amount, kind:'in'|'out', payer, date }
```

### 2.2 結算演算法（多人分帳）

1. `balances()`：算每人淨額 = 先付總額 − 應分攤總額（正數該收錢、負數該付錢）。**未開獎的隨機付款不列入**，避免從餘額反推出結果。
2. `settlements()`：貪婪演算法——欠最多的人依序付給該收最多的人，產生最少轉帳筆數的清單。

共同基金：`ledgerStats()` 算總存入／總支出／餘額；「應補繳」＝總支出均攤額 − 已存入。

### 2.3 雲端同步機制

- **需要登入**：上雲、加入專案、同步都以登入身分執行（RLS 在後端驗證權限，見第五章）。
- **上雲**：專案 JSON 整包（去掉 `cloud` 欄位）存進 `shared_projects` 表，產生 6 碼分享代碼。
- **推送**：任何 `save()` 觸發 800ms 防抖動後，把所有已上雲專案 update 上去。
- **拉取**：每 8 秒、以及視窗重新聚焦時，比對雲端 `updated_at`，較新就整包蓋回本機並重繪。
- **衝突策略**：最後寫入者獲勝（Last-Write-Wins）。兩人在同步窗內同時改，晚寫的會蓋掉早寫的。

### 2.4 帳號與身分

- Supabase Auth（Email＋密碼），註冊時記錄暱稱在 `user_metadata.nickname`。登入狀態由 supabase-js 存在 localStorage，重開瀏覽器仍有效。
- **使用者名稱**：每個帳號綁定一個名稱（註冊時設定，帳號視窗可隨時修改）。**第一次進入**某個專案時會詢問「要在此專案顯示的名稱」，預設帶帳號名稱，之後記住（存在該裝置 `localStorage` 的 `nick_<專案代碼>`）。留言暱稱優先序：此專案自訂名稱 → 帳號名稱 → 上次用過的名字，同一人在不同專案可用不同名稱。
- **登入即同步專案清單**：登入後自動從雲端抓回「你是成員的所有專案」——換裝置登入同帳號，專案清單會自動出現，不必重新輸入代碼。專案面板按 ✕ 即退出成員資格（同步就不會再抓回來），想回來用代碼重新加入即可。
- 管理員：email 在程式內 `ADMIN_EMAILS` 名單中者，登入後可在專案面板列出雲端全部專案並一鍵加入。

## 三、操作手冊

### 基本操作

| 想做什麼 | 怎麼做 |
|---|---|
| 切換／新建專案 | 點左上角 📁 專案列 → 選專案或填名稱＋選類型建立 |
| 退出專案 | 專案面板按 ✕：雲端專案＝退出成員（可用代碼再加入）；純本機專案＝永久刪除 |
| 記一筆帳 | 記記頁右下 ＋ → 選分類 → 填說明（選填）→ 選分帳方式 → 數字鍵盤輸入金額 |
| 特定付款 | （預設）表格中點各人「先付／支出」格子後用鍵盤輸入，兩邊合計相等才能送出 |
| 均分 | 切「均分」→ 輸入總額 → 選誰先付、誰分攤 |
| 隨機付款 | 切「🎲 隨機付款」→ 選參加抽籤的人 → 選「立刻公布」或「結帳時公布」 |
| 開獎 | 結算頁「🎲 未開獎」區按「開獎」（或記記列表該筆的 🎲） |
| 看誰欠誰 | 結算頁：最少轉帳方案＋三張圓餅圖（誰先付、誰花得多、支出分類） |
| 管理成員／分類 | 自訂頁：加刪成員、加刪分類（可自訂 emoji 分類） |
| 留言 | 記記頁底部留言區，暱稱欄每個專案可填不同的 |
| 上雲分享 | 先登入 → 專案面板 → 專案旁 ☁ → 取得 6 碼代碼傳給朋友 |
| 加入別人的專案 | 先登入 → 專案面板 → 「加入雲端專案」輸入代碼 |
| 登入／註冊 | 右上角 👤 → Email＋密碼（＋暱稱）|
| 手機當 App 用 | iPhone Safari／Android Chrome 開網址 → 加入主畫面 |

### 管理員操作

用 `ADMIN_EMAILS` 名單內的帳號登入 → 專案面板出現「🛡️ 管理員」：

- **檢視所有雲端專案**：列出雲端全部專案，點任一個直接加入。
- **管理帳號**：列出所有註冊帳號（暱稱、email、專案數、註冊日、admin 徽章），可「設為 admin／移除 admin」指派其他管理員，或刪除帳號（自己與創始管理員除外）。刪除後該帳號無法登入、成員資格移除，但帳目與專案內容保留。
- 管理員入口在右上角 👤 帳號視窗內；管理員的名稱旁會顯示 admin 徽章、頂端按鈕會多一個 🛡️。

## 四、維護手冊

### 4.1 更新程式與測試

```bash
# 本機預覽
python -m http.server 8000     # 開 http://localhost:8000

# 跑測試（改完必跑）
node test/calc.test.mjs        # 純計算單元測試
node test/integration.mjs      # 完整功能整合測試

# 部署
git add -A
git commit -m "說明這次改了什麼"
git push                       # 約 1 分鐘後 GitHub Pages 自動更新
```

改完程式在 commit 前跑 `node tools/bump.mjs`——會把 index.html 和**所有模組 import** 的 `?v=N` 一起 +1，徹底避免「一半新一半舊」的快取問題（測試會自動讀取目前版本）。

部署狀態看 repo 的 **Actions** 分頁（pages build and deployment）。

### 4.2 重要常數（都在 index.html 內搜尋即可）

| 常數 | 用途 |
|---|---|
| `SUPABASE_URL` / `SUPABASE_KEY` | `src/cloud.js`：Supabase 連線設定，留空＝純本機模式 |
| `ADMIN_EMAILS` | `src/cloud.js`：管理員 email 名單（真正的權限在資料庫 `is_admin()`） |
| `CATS` | `src/store.js`：新專案的預設分類 |
| `setInterval(pullAll, 8000)` | `src/main.js`：同步拉取頻率（毫秒）|
| `defaultData()` | `src/store.js`：第一次開啟時的範例資料 |

### 4.3 Supabase 設定備忘

- 資料表：`shared_projects`（專案內容）＋ `project_members`（成員名單），權限由 RLS 控管（完整設計與 SQL 見第五章）。
- Auth：Authentication → Sign In / Providers → Email → 關閉「Confirm email」可免信箱驗證。
- 金鑰位置：Project Settings → Data API（URL）、API Keys（Publishable key）。
- 免費額度：500MB 資料庫；專案閒置一週會休眠，第一個請求會自動喚醒（等幾秒）。

### 4.4 常見問題排錯

| 症狀 | 原因與解法 |
|---|---|
| 畫面全空、按了沒反應 | F12 → Console 看紅字錯誤；多半是改壞 JS（缺引號、缺分號）。用 git 還原：`git checkout index.html` |
| 上傳失敗：Invalid path | `SUPABASE_URL` 格式錯誤——只能是 `https://xxx.supabase.co`，不能有結尾斜線或其他路徑 |
| 上傳失敗：relation ... does not exist | `shared_projects` 表沒建，去 SQL Editor 跑建表 SQL |
| 顯示「尚未設定雲端」 | 兩個常數沒填好、沒存檔、或瀏覽器快取——Ctrl+F5 |
| 註冊後登不進去 | Email 確認信沒關：去 Supabase 關掉 Confirm email，或去信箱點確認 |
| 朋友看不到我的新帳目 | 等 8 秒或切換視窗觸發同步；還是不行就確認雙方都已登入、且用代碼加入過（RLS 只讓成員讀寫） |
| 加入失敗：請先登入 / new row violates row-level security | 沒登入就操作雲端功能——先登入再試；若是舊資料看不到，重新用代碼加入一次（見 5.3） |
| 網站 404 | Actions 還在部署中，或 Pages 設定的 branch／資料夾不對；`index.html` 必須全小寫且在根目錄 |
| 資料不見了 | 資料存在瀏覽器——清除瀏覽資料、無痕模式、換瀏覽器都會看不到舊資料。已上雲的專案登入後會自動同步回來 |
| 換裝置登入後專案沒出現 | 確認已執行第五章的 RLS SQL（同步依賴 `project_members` 表）；然後重新整理頁面或重新登入 |

### 4.5 已知限制

1. **衝突**：整包 JSON 的 Last-Write-Wins，極端情況會蓋掉別人同時的修改。正式版可改為逐筆帳目寫入資料表。
2. 留言與帳目沒有編輯功能（只能刪除重記）。
3. 分享代碼等同邀請票：拿到代碼的「登入使用者」都可加入成為成員。若代碼外流，目前沒有移除成員／換代碼的 UI（可在資料庫手動處理 `project_members`）。

## 五、安全性設計（RLS）

原則：**前端程式碼永遠視為公開且可被竄改，所有安全規則都在後端（Row Level Security）強制執行。** 前端的 `ADMIN_EMAILS` 名單只影響按鈕要不要顯示，真正的權限判斷在資料庫。

### 5.1 權限模型

| 動作 | 誰可以做 | 由誰強制 |
|---|---|---|
| 建立雲端專案 | 任何登入使用者（owner 自動記錄，並自動成為成員） | RLS insert 政策＋trigger |
| 讀取／更新專案 | 該專案成員，或管理員 | RLS select／update 政策 |
| 刪除專案 | 擁有者或管理員 | RLS delete 政策 |
| 用代碼加入 | 登入使用者，透過後端函式 `join_project()` 驗證代碼後登記成員 | SECURITY DEFINER 函式 |
| 檢視所有專案 | 只有管理員（JWT email 比對，寫死在資料庫函式裡） | `is_admin()` 函式 |
| 帳號管理（列出／刪除帳號） | 只有管理員 | `admin_list_users()`／`admin_delete_user()` SECURITY DEFINER 函式 |
| 指派／移除管理員 | 只有管理員（創始管理員不可被變更） | `admins` 表＋`admin_set_admin()` 函式 |
| 未登入 | 只能用純本機模式，碰不到任何雲端資料 | 所有政策都要求 `auth.uid()` |

管理員：`piuuuuu20069564@gmail.com`（要換人改資料庫的 `is_admin()` 函式，不是改前端）。

### 5.2 設定步驟

到 Supabase → **SQL Editor** → New query，貼上整段執行：

```sql
-- ========== 算錢用ㄉ東西：RLS 安全模型 ==========

-- 1) 擁有者欄位（建立時自動填入登入者）
alter table public.shared_projects
  add column if not exists owner uuid default auth.uid();

-- 2) 成員表
create table if not exists public.project_members (
  project_id uuid references public.shared_projects(id) on delete cascade,
  user_id uuid not null,
  joined_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
alter table public.project_members enable row level security;

-- 3) 管理員名單（創始管理員寫死在 is_admin；其他人由管理員指派進 admins 表）
create table if not exists public.admins (
  user_id uuid primary key,
  email text not null,
  granted_by uuid,
  granted_at timestamptz not null default now()
);
alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(auth.jwt()->>'email', '') = 'piuuuuu20069564@gmail.com'
      or exists (select 1 from admins where user_id = auth.uid())
$$;

drop policy if exists "admins visible to admins" on public.admins;
create policy "admins visible to admins" on public.admins
  for select using (public.is_admin());

-- 4) 成員判斷
create or replace function public.is_member(p_project uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from project_members
    where project_id = p_project and user_id = auth.uid()
  )
$$;

-- 5) 建立專案時，擁有者自動成為成員
create or replace function public.add_owner_as_member()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.owner is not null then
    insert into project_members(project_id, user_id) values (new.id, new.owner)
    on conflict do nothing;
  end if;
  return new;
end $$;
drop trigger if exists trg_owner_member on public.shared_projects;
create trigger trg_owner_member after insert on public.shared_projects
for each row execute function public.add_owner_as_member();

-- 6) 用代碼加入：唯一合法入口（代碼＝邀請票，後端驗證）
create or replace function public.join_project(p_code text)
returns setof public.shared_projects
language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  if auth.uid() is null then
    raise exception '請先登入';
  end if;
  select id into pid from shared_projects where code = upper(p_code);
  if pid is null then
    raise exception '找不到此代碼';
  end if;
  insert into project_members(project_id, user_id) values (pid, auth.uid())
  on conflict do nothing;
  return query select * from shared_projects where id = pid;
end $$;

-- 7) 移除舊的「大家都能讀寫」政策，換成成員制
drop policy if exists "anon read"   on public.shared_projects;
drop policy if exists "anon insert" on public.shared_projects;
drop policy if exists "anon update" on public.shared_projects;

drop policy if exists "members or admin read" on public.shared_projects;
create policy "members or admin read" on public.shared_projects
  for select using (public.is_member(id) or public.is_admin());
drop policy if exists "logged-in create" on public.shared_projects;
create policy "logged-in create" on public.shared_projects
  for insert with check (auth.uid() is not null and owner = auth.uid());
drop policy if exists "members or admin update" on public.shared_projects;
create policy "members or admin update" on public.shared_projects
  for update using (public.is_member(id) or public.is_admin());
drop policy if exists "owner or admin delete" on public.shared_projects;
create policy "owner or admin delete" on public.shared_projects
  for delete using (owner = auth.uid() or public.is_admin());

-- 8) 成員表：只能看到自己的成員資格（管理員全看）
drop policy if exists "read own memberships" on public.project_members;
create policy "read own memberships" on public.project_members
  for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "leave own membership" on public.project_members;
create policy "leave own membership" on public.project_members
  for delete using (user_id = auth.uid());

-- 9) 管理員：列出所有帳號（含 admin 身分；非管理員呼叫會拿到空清單）
drop function if exists public.admin_list_users();
create or replace function public.admin_list_users()
returns table (id uuid, email text, nickname text, created_at timestamptz, projects bigint, is_admin boolean)
language sql security definer set search_path = public as $$
  select u.id, u.email::text,
         coalesce(u.raw_user_meta_data->>'nickname', split_part(u.email::text, '@', 1)),
         u.created_at,
         (select count(*) from project_members m where m.user_id = u.id),
         (u.email::text = 'piuuuuu20069564@gmail.com'
          or exists (select 1 from admins a where a.user_id = u.id))
  from auth.users u
  where public.is_admin()
  order by u.created_at desc
$$;

-- 10) 管理員：刪除帳號（成員資格一併移除；專案內容保留）
create or replace function public.admin_delete_user(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then
    raise exception '沒有管理員權限';
  end if;
  if p_user = auth.uid() then
    raise exception '不能刪除自己的帳號';
  end if;
  delete from project_members where user_id = p_user;
  delete from admins where user_id = p_user;
  delete from auth.users where id = p_user;
end $$;

-- 11) 管理員：指派／移除其他管理員（創始管理員不可變更）
create or replace function public.admin_set_admin(p_user uuid, p_grant boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_email text;
begin
  if not public.is_admin() then
    raise exception '沒有管理員權限';
  end if;
  select email::text into v_email from auth.users where id = p_user;
  if v_email is null then
    raise exception '找不到帳號';
  end if;
  if v_email = 'piuuuuu20069564@gmail.com' then
    raise exception '創始管理員不可變更';
  end if;
  if p_grant then
    insert into admins(user_id, email, granted_by) values (p_user, v_email, auth.uid())
    on conflict (user_id) do nothing;
  else
    delete from admins where user_id = p_user;
  end if;
end $$;
```

執行後 push 最新的 `index.html`（前端已改為登入後才可上雲、加入改走 `join_project()`）。

### 5.3 既有資料的處理

執行前就存在的雲端專案沒有成員紀錄，套用政策後一般人會讀不到：

- 各成員登入後，重新用原本的 6 碼代碼「加入雲端專案」一次即可（會登記成員資格，資料不變）。
- 管理員登入後本來就看得到全部，也可從管理員清單點入。

### 5.4 驗證安全是否生效

1. 未登入 → 點 ☁ 或輸入代碼 → 應被要求登入。
2. 登入 A 帳號、開瀏覽器 Console 執行 `await sb.from('shared_projects').select('*')` → 只回傳 A 是成員的專案。
3. 用非管理員帳號同樣查詢 → 看不到別人的專案；用管理員帳號 → 看得到全部。

## 六、行動裝置 App（Capacitor WebView 包裝）

專案除了原本的網頁本體，還多了一層「原生殼」，讓手機可以像裝一般 App 一樣安裝，**不透過 App Store／Google Play**。

### 6.1 多了哪些檔案、程式碼放在哪

```
package.json ／ package-lock.json    npm 套件清單（@capacitor/core、ios、android、cli）
capacitor.config.json                App 設定：appId、appName、要載入的網址
tools/build-web.mjs                  把 index.html／style.css／src 複製到 www/（打包用，日常開發不用管）
www/                                 build-web.mjs 產生的暫存輸出（.gitignore 排除，不進版控）
android/                             Android 原生專案（用 Android Studio 開）
ios/                                 iOS 原生專案（用 Xcode 開，僅能在 macOS 上編譯）
```

**app 本身沒有另外一份程式邏輯**：`index.html`／`style.css`／`src/` 仍然是唯一的程式碼來源，
跟網頁版共用同一套。`android/`、`ios/` 只是「殼」，負責顯示一個全螢幕、有 App 圖示、可離線安裝的視窗。

### 6.2 運作方式：App 直接連正式網站，不是把網頁包死在裡面

`capacitor.config.json` 設定 App 開啟後直接載入現有的正式網址：

```json
"server": { "url": "https://kenneth0604.github.io/BillSplittingApp/" }
```

也就是說 App **不是**把 `index.html` 這些檔案封裝進安裝檔離線執行，而是像一個「裝了殼、拿掉網址列的瀏覽器」，
永遠顯示 GitHub Pages 上最新的版本。

### 6.3 如何更新

**跟現在完全一樣，不需要多做任何事**：改程式 → `node tools/bump.mjs` → commit → push，
GitHub Pages 部署完成後，手機上的 App 重新開啟／回到前景就是新版本，**不必重新 build、不必重新安裝 App**。

只有下列情況才需要回頭重新 build 原生殼、重新安裝：
- 要改 App 名稱、圖示、Bundle ID／Package name（改 `capacitor.config.json` 之後）
- 要加裝原生功能（相機、推播通知等 Capacitor 外掛）
- 之後真的要送審上架 App Store／Google Play

（若之後想要「完全離線也能開」的版本，把 `capacitor.config.json` 的 `server` 區塊刪掉、
只留 `webDir: "www"`，執行 `npm run cap:sync` 重新打包即可；代價是屆時每次改版都要重新 build＋重裝，
不像現在這樣自動更新。）

### 6.4 如何安裝：Android（免上架，直接裝 apk）

需要一台裝了 **Android Studio**（含 Android SDK）的電腦：

```bash
npm install                  # 第一次先裝相依套件
npm run cap:open:android     # 用 Android Studio 開啟 android/ 專案
```

在 Android Studio 裡：
1. 選單 **Build → Build Bundle(s) / APK(s) → Build APK(s)**
2. build 完成後點通知裡的「locate」，或到 `android/app/build/outputs/apk/debug/app-debug.apk` 找檔案
3. 把這個 `.apk` 傳到手機（雲端硬碟、Line、USB 都可以），在手機上點開安裝
   （第一次會被系統擋下，去「設定」允許此來源安裝未知 App 即可，之後就跟一般 App 一樣）

之後**不需要重新安裝**，開啟 App 就是最新內容（見 6.3）；只有換圖示/名稱這種殼本身的改動才要重新 build＋重裝一次。

### 6.5 如何安裝：iOS（免上架，裝到自己的 iPhone）

需要一台 **Mac**（跑 Windows 沒辦法完成這步，是蘋果官方限制，`ios/` 專案結構已經生成好放在這個 repo 裡了）：

```bash
npm install
npm run cap:open:ios         # 用 Xcode 開啟 ios/App/App.xcworkspace（需先跑過 pod install）
```

在 Xcode 裡：
1. 用傳輸線接上 iPhone，左上角選你的裝置
2. Signing & Capabilities 登入自己的 Apple ID（免費帳號即可）
3. 按 ▶ Run，App 就會裝到手機上

**限制**：免費 Apple ID 簽的 App，裝置上 **7 天後會過期**（圖示變灰、打不開），
回 Xcode 對同一台裝置重新按一次 Run 就會重新啟用，不用改任何程式碼；
不想每 7 天重裝一次的話，需要付費 Apple Developer Program（US$99/年）簽章可撐一整年。
內容更新一樣不受影響（見 6.3），只有這個簽章過期要重複處理。

### 6.6 常用指令備忘

| 指令 | 用途 |
|---|---|
| `npm install` | 安裝 Capacitor 相關套件（第一次或 clone 下來後執行） |
| `npm run cap:sync` | 把最新網頁檔案＋設定同步進 `android/`、`ios/`（改了 `capacitor.config.json` 才需要跑，日常內容更新不需要） |
| `npm run cap:open:android` | 用 Android Studio 開啟 Android 專案 |
| `npm run cap:open:ios` | 用 Xcode 開啟 iOS 專案（僅限 macOS） |
| `npm test` | 跑單元＋整合測試（等同 `node test/calc.test.mjs && node test/integration.mjs`） |

---

*本專案由 Claude 協助開發。檔案：`index.html`＋`style.css`＋`src/`（App 本體，ES Modules，網頁版與行動裝置 App 共用）、`test/`（單元與整合測試）、`android/`／`ios/`／`capacitor.config.json`（Capacitor 行動裝置殼，見第六章）、`README.md`（本文件）。*
