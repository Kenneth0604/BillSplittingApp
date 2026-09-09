# 算錢用ㄉ東西 💸

多人分帳 / 共同基金 / 個人記帳的 PWA。React + Vite + Tailwind 前端,Supabase 做雲端同步與帳號,部署在 GitHub Pages;另以 Capacitor 包成 iOS / Android App(內容直接載入正式網站,不需重新上架)。

> **v2(React 重寫)**:程式結構與 UI 殼和 [發任務用ㄉ東西(MissionApp)](https://github.com/Kenneth0604/MissionApp) 相同:雙主題(粉粉 / 黑黑)、整頁鎖定只上下捲動、Service Worker、manifest、GitHub Actions 部署。
> **資料完全相容**:localStorage 的 `splitapp` 與所有 Supabase 資料表、RPC、RLS 都沒有改變,舊版使用者直接升級,資料與分享代碼照常可用。

---

## 一、整體架構

```
index.html ─ src/main.jsx(載入資料、註冊 Service Worker、掛 Provider)
                 │
                 ├─ lib/store.js      資料層:狀態、localStorage、遷移、subscribe(無 DOM 相依)
                 ├─ lib/calc.js       純計算:結算演算法、運算式引擎、格式化(依賴 store)
                 ├─ lib/cloud.js      雲端層:supabase-js、同步、身分(依賴 store,用 hooks 通知 UI)
                 ├─ lib/nick.js       每個專案的顯示名稱(留言暱稱)
                 ├─ lib/app.jsx       React context:把 store / cloud 包起來,資料變動就重繪
                 ├─ lib/theme.jsx     雙主題切換(粉粉 / 黑黑)
                 ├─ lib/toast.jsx     提示訊息
                 ├─ components/       Layout(頂欄 + 分頁)、Sheet(底部表單)、ui(卡片 / 列 / chips / 頭貼)、
                 │                    AmountInput、PieChart、Chat、ExpenseRows
                 ├─ pages/            Expenses(記記)、Members(自訂)、Settle(結算 / 基金狀況 / 統計)
                 └─ sheets/           ExpenseSheet、ProjectSheet、DateSheet、AuthSheet、ProfileSheet、
                                      MemberSheets、CatSheets、AdminSheets、ShareCodeSheet
src/sw.js                             Service Worker(建置時輸出成 /BillSplittingApp/sw.js)
public/manifest.json、icons/          PWA
legacy/                               舊版(單一 HTML + 原生 ES Modules)原始碦,僅供對照,不會被建置
```

**重點觀念**:所有邏輯仍在前端。`store.js` 與 `calc.js` 從舊版原樣搬過來(只拿掉 `?v=` 版本參數),所以資料結構、結算演算法、運算式引擎都與舊版一模一樣;舊版 1500 行的 `ui.js` 改寫成 React 頁面與底部表單。

資料流:元件透過 `useApp()` 讀取 `p`(目前專案)與 `data`;要修改資料就呼叫 `act((data, p) => { ...直接改... })`,`act` 會 `save()`(寫 localStorage → 排程上雲 → 通知所有元件重繪)。

## 二、運作原理

### 2.1 資料模型

全部資料存在瀏覽器 `localStorage` 的 `splitapp` 這個 key,結構:

```js
{
  projects: [ /* 專案陣列 */ ],
  currentProjectId: 1,     // 目前開啟的專案
  nextProjectId: 2,        // 專案流水號
}
```

每個專案(project):

```js
{
  id: 1,
  name: '67元快樂研究小組',
  type: 'split',                    // split=多人分帳 / fund=共同基金 / personal=個人記帳
  members: [{ id, name, avatar? }], // avatar 為 96px JPEG dataURL(選填)
  cats: { out: [...], in: [...] },  // 此專案的自訂分類
  expenses: [ /* 帳目,見下 */ ],
  chats: [{ name, text, time }],    // 留言區(最多 200 則)
  nextMemberId, nextExpenseId,
  cloud: { code: 'ABC123', ts },    // 有上雲才有;code=分享代碼(僅存本機,不上傳)
}
```

帳目(expense)依分帳方式有幾種形態:

```js
// 均分:payer 先付 amount,splitters 平均分攤
{ id, cat, desc, amount, payer, splitters: [1,2,3], date, by? }

// 特定付款(mode:'exact'):逐人記「先付」與「實際支出」,兩邊合計必須相等
{ id, cat, desc, amount, mode:'exact', paid:{成員id:金額}, spent:{成員id:金額}, date }
//   雙人模式直記欠帳:duo:true(paid 付款人、spent 對方全額)
//   清償紀錄:settle:true(結算頁按「已付」產生,不進消費統計)

// 隨機付款(mode:'random'):建立當下就抽出 losers,revealed 控制是否公布
{ id, cat, desc, amount, mode:'random', payer, candidates:[...], losers:[...], loser, revealed, date }

// 基金 / 個人記帳用 kind 區分收支:'in'=存入/收入、'out'=支出
{ id, cat, desc, amount, kind:'in'|'out', payer, date }
```

`date` 一律是 `M/D` 字串(不含年份),`by` 是新增者的顯示名稱。

### 2.2 結算演算法(多人分帳)

1. `balances()`:算每人淨額 = 先付總額 − 應分攤總額(正數該收錢、負數該付錢)。**未開獎的隨機付款不列入**,避免從餘額反推出結果。
2. `settlements()`:貪婪演算法,欠最多的人依序付給該收最多的人,產生最少轉帳筆數的清單。

共同基金:`ledgerStats()` 算總存入 / 總支出 / 餘額;「應補繳」= 總支出均攤額 − 已存入。

**雙人模式**:多人分帳且剛好兩位成員時,記記頁直接顯示「誰欠誰多少」,新增表單簡化為「誰先付 + 金額(= 對方欠的錢)」,結算分頁隱藏。

### 2.3 雲端同步機制

- **需要登入**:上雲、加入專案、同步都以登入身分執行(RLS 在後端驗證權限,見第五章)。
- **上雲**:專案 JSON 整包(去掉 `cloud` 欄位)存進 `shared_projects` 表,產生 6 碼分享代碼。
- **推送**:任何 `save()` 觸發 800ms 防抖動後,把所有已上雲專案 update 上去(內容沒變就略過)。
- **拉取**:每 20 秒、視窗重新聚焦、回到前景時,先比對雲端 `updated_at`,較新才抓整包蓋回本機並重繪。
- **衝突策略**:最後寫入者獲勝(Last-Write-Wins)。

### 2.4 帳號與身分

- Supabase Auth(Email + 密碼),註冊時記錄暱稱在 `user_metadata.nickname`,大頭貼存在 `user_metadata.avatar`。登入狀態由 supabase-js 存在 localStorage(key `billsplit-auth`),重開仍有效。
- **顯示名稱**:第一次加入某個雲端專案時會詢問「要在此專案顯示的名稱」,存在該裝置 `localStorage` 的 `nick_<專案代碼>`。留言暱稱優先序:此專案自訂名稱 → 帳號名稱 → 上次用過的名字。
- **登入即同步專案清單**:登入後自動抓回「你是成員的所有專案」。專案面板按 ✕ 即退出成員資格。
- 管理員:資料庫 `is_admin()` 為準;前端 `ADMIN_EMAILS` 只影響按鈕顯示。

## 三、操作手冊

| 想做什麼 | 怎麼做 |
|---|---|
| 切換 / 新建專案 | 左上角 📁 專案名稱 → 選專案,或填名稱 + 選類型建立 |
| 退出專案 | 專案面板 ✕:雲端專案 = 退出成員(可用代碡再加入);純本機專案 = 永久刪除 |
| 記一筆帳 | 記記頁右下 ＋ → 分類 → 說明(選填)→ 日期 → 分帳方式 → 金額(可打算式如 `670/3`) |
| 特定付款 | 表格中填各人「先付 / 支出」,兩邊合計相等才能送出;也可勾人後「把先付合計均分到支出」 |
| 均分 | 切「均分」→ 金額 → 誰先付、誰分攤 |
| 隨機付款 | 切「🎲 隨機付款」→ 選參加抽籤的人與抽幾人 → 「立刻公布」或「結帳時公布」 |
| 開獎 | 結算頁「🎲 未開獎」按「開獎」,或記記列表該筆的 🎲 |
| 編輯 / 刪除 | 每一列的 ✎ / ✕;編輯時分帳方式鎖定,隨機付款只能改金額等欄位不重抽 |
| 看誰欠誰 | 結算頁:最少轉帳方案(每筆可按「已付」記清償)+ 三張圓餅圖 |
| 依日期查看 | 頂欄 📅 |
| 管理成員 / 分類 | 自訂頁:成員(可改名、換頭貼)、分類(點一下改名,會同步更新既有帳目) |
| 留言 | 記記頁底部留言區,暱稱欄每個專案可填不同的 |
| 上雲分享 | 先登入 → 專案面板 → 專案旁 ☁ → 顯示 6 碼代碼並可複製 |
| 加入別人的專案 | 先登入 → 專案面板 → 「加入雲端專案」輸入代碼 |
| 登入 / 註冊 / 換主題 | 右上角 👤 |
| 手動同步 | 頂欄 ↻ |

### 管理員操作

管理員帳號登入 → 右上角 👤 → 「🛡️ 管理員」:

- **檢視所有雲端專案**:列出雲端全部專案,點任一個直接加入;✎ 改名、✕ 從雲端刪除。
- **管理帳號**:列出所有註冊帳號,可「設為 admin / 移除 admin」,或刪除帳號(自己與創始管理員除外)。

## 四、開發與部署

### 4.1 本機開發

```bash
npm install
npm run dev          # http://localhost:5174/BillSplittingApp/
npm test             # 純計算單元測試(test/calc.test.mjs)
npm run build        # 產出 dist/
```

Supabase 連線預設寫在 `src/lib/cloud.js`(Publishable key 本來就是公開的);也可用 `.env.local` 的 `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` 覆寫。

### 4.2 部署到 GitHub Pages

推送到 `main` 即由 [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) 自動測試、建置、部署。

**第一次啟用時**:Repo → Settings → Pages → Source 改選 **GitHub Actions**(舊版是「Deploy from a branch」)。

不再需要 `tools/bump.mjs` 手動升版:Vite 的產出檔名帶 hash,Service Worker 也會在每次建置換新的快取 ID。

### 4.3 Keep-alive

Supabase 免費方案 7 天沒有活動會暫停專案,[`.github/workflows/keepalive.yml`](.github/workflows/keepalive.yml) 每 3 天 ping 一次(需要 repo secret `SUPABASE_KEY`)。GitHub 對 60 天沒 commit 的 repo 會停用排程,到 Actions 頁 Enable 即可。

### 4.4 重要常數

| 常數 | 位置 | 用途 |
|---|---|---|
| `SUPABASE_URL` / `SUPABASE_KEY` | `src/lib/cloud.js` | Supabase 連線(可用環境變數覆寫) |
| `ADMIN_EMAILS` | `src/lib/cloud.js` | 管理員 email(真正的權限在資料庫 `is_admin()`) |
| `CATS` | `src/lib/store.js` | 新專案的預設分類 |
| `setInterval(cloud.pullAll, 20000)` | `src/lib/app.jsx` | 同步拉取頻率 |
| `defaultData()` | `src/lib/store.js` | 第一次開啟時的範例資料 |
| `THEMES` | `src/lib/theme.jsx` | 主題清單;色票在 `src/index.css` |

### 4.5 常見問題

| 症狀 | 解法 |
|---|---|
| 網站 404 / 還是舊版 | Settings → Pages → Source 必須是 GitHub Actions;看 Actions 分頁是否綠燈 |
| 上傳失敗:relation ... does not exist | `shared_projects` 表沒建,去 SQL Editor 跑第五章 SQL |
| 註冊後登不進去 | Supabase Auth 關掉 Confirm email,或去信箱點確認 |
| 朋友看不到我的新帳目 | 等 20 秒或按頂欄 ↻;確認雙方都已登入且用代碼加入過 |
| 換裝置登入後專案沒出現 | 確認已執行第五章 RLS SQL;按 ↻ 或重新登入 |
| 資料不見了 | 資料存在瀏覽器;清除瀏覽資料會消失。已上雲的專案登入後會自動同步回來 |

## 五、安全性設計(RLS)

原則:**前端程式碼永遠視為公開且可被竄改,所有安全規則都在後端(Row Level Security)強制執行。**

| 動作 | 誰可以做 | 由誰強制 |
|---|---|---|
| 建立雲端專案 | 任何登入使用者(owner 自動成為成員) | RLS insert 政策 + trigger |
| 讀取 / 更新專案 | 該專案成員,或管理員 | RLS select / update 政策 |
| 刪除專案 | 擁有者或管理員 | RLS delete 政策 |
| 用代碼加入 | 登入使用者,透過 `join_project()` 驗證代碼後登記成員 | SECURITY DEFINER 函式 |
| 檢視所有專案 / 帳號管理 | 只有管理員 | `is_admin()`、`admin_*()` 函式 |
| 未登入 | 只能用純本機模式 | 所有政策都要求 `auth.uid()` |

管理員:`piuuuuu20069564@gmail.com`(要換人改資料庫的 `is_admin()` 函式)。

### 設定步驟(新專案才需要;既有資料庫已套用)

到 Supabase → **SQL Editor** → New query,貼上整段執行:

```sql
-- ========== 算錢用ㄉ東西:RLS 安全模型 ==========
alter table public.shared_projects add column if not exists owner uuid default auth.uid();

create table if not exists public.project_members (
  project_id uuid references public.shared_projects(id) on delete cascade,
  user_id uuid not null,
  joined_at timestamptz not null default now(),
  primary key (project_id, user_id)
);
alter table public.project_members enable row level security;

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
create policy "admins visible to admins" on public.admins for select using (public.is_admin());

create or replace function public.is_member(p_project uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from project_members where project_id = p_project and user_id = auth.uid())
$$;

create or replace function public.add_owner_as_member()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.owner is not null then
    insert into project_members(project_id, user_id) values (new.id, new.owner) on conflict do nothing;
  end if;
  return new;
end $$;
drop trigger if exists trg_owner_member on public.shared_projects;
create trigger trg_owner_member after insert on public.shared_projects
for each row execute function public.add_owner_as_member();

create or replace function public.join_project(p_code text)
returns setof public.shared_projects
language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  if auth.uid() is null then raise exception '請先登入'; end if;
  select id into pid from shared_projects where code = upper(p_code);
  if pid is null then raise exception '找不到此代碼'; end if;
  insert into project_members(project_id, user_id) values (pid, auth.uid()) on conflict do nothing;
  return query select * from shared_projects where id = pid;
end $$;

drop policy if exists "anon read"   on public.shared_projects;
drop policy if exists "anon insert" on public.shared_projects;
drop policy if exists "anon update" on public.shared_projects;
drop policy if exists "members or admin read" on public.shared_projects;
create policy "members or admin read" on public.shared_projects for select using (public.is_member(id) or public.is_admin());
drop policy if exists "logged-in create" on public.shared_projects;
create policy "logged-in create" on public.shared_projects for insert with check (auth.uid() is not null and owner = auth.uid());
drop policy if exists "members or admin update" on public.shared_projects;
create policy "members or admin update" on public.shared_projects for update using (public.is_member(id) or public.is_admin());
drop policy if exists "owner or admin delete" on public.shared_projects;
create policy "owner or admin delete" on public.shared_projects for delete using (owner = auth.uid() or public.is_admin());

drop policy if exists "read own memberships" on public.project_members;
create policy "read own memberships" on public.project_members for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists "leave own membership" on public.project_members;
create policy "leave own membership" on public.project_members for delete using (user_id = auth.uid());

drop function if exists public.admin_list_users();
create or replace function public.admin_list_users()
returns table (id uuid, email text, nickname text, created_at timestamptz, projects bigint, is_admin boolean)
language sql security definer set search_path = public as $$
  select u.id, u.email::text,
         coalesce(u.raw_user_meta_data->>'nickname', split_part(u.email::text, '@', 1)),
         u.created_at,
         (select count(*) from project_members m where m.user_id = u.id),
         (u.email::text = 'piuuuuu20069564@gmail.com' or exists (select 1 from admins a where a.user_id = u.id))
  from auth.users u
  where public.is_admin()
  order by u.created_at desc
$$;

create or replace function public.admin_delete_user(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception '沒有管理員權限'; end if;
  if p_user = auth.uid() then raise exception '不能刪除自己的帳號'; end if;
  delete from project_members where user_id = p_user;
  delete from admins where user_id = p_user;
  delete from auth.users where id = p_user;
end $$;

create or replace function public.admin_set_admin(p_user uuid, p_grant boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_email text;
begin
  if not public.is_admin() then raise exception '沒有管理員權限'; end if;
  select email::text into v_email from auth.users where id = p_user;
  if v_email is null then raise exception '找不到帳號'; end if;
  if v_email = 'piuuuuu20069564@gmail.com' then raise exception '創始管理員不可變更'; end if;
  if p_grant then
    insert into admins(user_id, email, granted_by) values (p_user, v_email, auth.uid()) on conflict (user_id) do nothing;
  else
    delete from admins where user_id = p_user;
  end if;
end $$;
```

## 六、行動裝置 App(Capacitor)

`android/`、`ios/` 是原生殼,`capacitor.config.json` 讓 App 開啟後直接載入正式網址:

```json
"server": { "url": "https://kenneth0604.github.io/BillSplittingApp/" }
```

所以**網頁一更新,App 重開就是新版**,不必重新 build 或重裝。只有改 App 名稱 / 圖示 / Bundle ID、加原生外掛時才要重新 build。

```bash
npm run cap:sync            # 建置 dist/ 並同步進 android/、ios/(改了 capacitor.config.json 才需要)
npm run cap:open:android    # Android Studio → Build → Build APK(s) → 把 apk 傳到手機安裝
npm run cap:open:ios        # Xcode(僅 macOS)→ 選裝置 → Run;免費 Apple ID 簽章 7 天過期需重新 Run
```

`webDir` 已改為 `dist`(Vite 產出);若想做完全離線版,刪掉 `server` 區塊再 `npm run cap:sync`。

---

*v2 由 Claude 協助重寫。舊版原始碼保留在 `legacy/` 供對照。*
