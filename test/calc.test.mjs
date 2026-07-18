// 純計算單元測試：node test/calc.test.mjs
globalThis.localStorage = { getItem: () => null, setItem: () => { } };
globalThis.window = globalThis;
import { readFileSync } from 'fs';
const V = readFileSync(new URL('../index.html', import.meta.url), 'utf8').match(/main\.js\?v=(\d+)/)[1];
const store = await import(new URL(`../src/store.js?v=${V}`, import.meta.url).href);
store.load();
const calc = await import(new URL(`../src/calc.js?v=${V}`, import.meta.url).href);

let pass = 0, fail = 0;
const t = (name, cond) => cond ? (pass++, console.log('✓', name)) : (fail++, console.log('✗', name));

// 67 範例專案的既知答案
const bal = calc.balances();
t('餘額總和為零', Math.abs(Object.values(bal).reduce((a, b) => a + b, 0)) < 0.01);
t('未開獎 6767 不列入', Math.abs(bal[1]) < 6000);
const plan = calc.settlements();
t('結算方案筆數 ≤ 成員數-1', plan.length <= store.proj().members.length - 1);
plan.forEach(p => t(`轉帳金額為正 (${p.amt})`, p.amt > 0));

// 運算式引擎
t('evalAmt 67+67', calc.evalAmt('67+67') === 134);
t('evalAmt 670/3', Math.round(calc.evalAmt('670/3')) === 223);
t('evalAmt 結尾運算子', calc.evalAmt('50*') === 50);
t('evalAmt 惡意輸入', isNaN(calc.evalAmt('alert(1)')));
t('editAmt 運算子替換', calc.editAmt('5+', '*') === '5*');
t('editAmt 小數點限本段', calc.editAmt('1.5+2', '.') === '1.5+2.');

// 取整與格式
t('fmt 取整', calc.fmt(223.4) === 'NT$ 223' && calc.fmt(1580.5) === 'NT$ 1,581');
// esc
t('esc 跳脫', calc.esc('<b>&"') === '&lt;b&gt;&amp;&quot;');
// losersOf 相容
t('losersOf 舊資料', JSON.stringify(calc.losersOf({ loser: 2 })) === '[2]');
t('losersOf 新資料', JSON.stringify(calc.losersOf({ losers: [1, 3] })) === '[1,3]');
// 日期
t('dateToISO', /^\d{4}-07-05$/.test(calc.dateToISO('7/5')));

console.log(`\n===== ${pass} 通過 / ${fail} 失敗 =====`);
process.exit(fail ? 1 : 0);
