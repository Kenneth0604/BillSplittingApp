// 純計算單元測試:node test/calc.test.mjs
globalThis.localStorage = { getItem: () => null, setItem: () => {} }

const store = await import('../src/lib/store.js')
store.load()
const calc = await import('../src/lib/calc.js')

let pass = 0, fail = 0
const t = (name, cond) => (cond ? (pass++, console.log('✓', name)) : (fail++, console.log('✗', name)))

// 67 範例專案的既知答案
const bal = calc.balances()
t('餘額總和為零', Math.abs(Object.values(bal).reduce((a, b) => a + b, 0)) < 0.01)
t('未開獎 6767 不列入', Math.abs(bal[1]) < 6000)
const plan = calc.settlements()
t('結算方案筆數 ≤ 成員數-1', plan.length <= store.proj().members.length - 1)
plan.forEach((p) => t(`轉帳金額為正 (${p.amt})`, p.amt > 0))

// 結算後應完全打平
const after = { ...bal }
plan.forEach(({ from, to, amt }) => { after[from] += amt; after[to] -= amt })
t('依方案轉帳後全員歸零', Object.values(after).every((v) => Math.abs(v) < 0.01))

// 運算式引擎
t('evalAmt 670/3', Math.abs(calc.evalAmt('670/3') - 223.333) < 0.01)
t('evalAmt 結尾運算子忽略', calc.evalAmt('100+') === 100)
t('evalAmt 除以零為 NaN', Number.isNaN(calc.evalAmt('1/0')))
t('evalAmt 非法字元為 NaN', Number.isNaN(calc.evalAmt('1;alert(1)')))
t('editAmt 開頭不能是運算子', calc.editAmt('', '+') === '')
t('editAmt 連按運算子換運算子', calc.editAmt('12+', '*') === '12*')
t('editAmt 小數點只能一個', calc.editAmt('1.5', '.') === '1.5')
t('isValidAmount 擋 0 與負數', !calc.isValidAmount(0) && !calc.isValidAmount(-5) && calc.isValidAmount(10))

// 日期轉換
t('isoToMD', calc.isoToMD('2026-09-09') === '9/9')
t('dateToISO 回推當年', calc.dateToISO('7/15').endsWith('-07-15'))

// losersOf 相容舊格式
t('losersOf 舊格式 loser', calc.losersOf({ loser: 2 }).join() === '2')
t('losersOf 新格式 losers 優先', calc.losersOf({ loser: 2, losers: [1, 3] }).join() === '1,3')

// randInt 範圍
for (let i = 0; i < 50; i++) { const r = calc.randInt(3); if (r < 0 || r > 2) { fail++; console.log('✗ randInt 超出範圍', r); break } }

// 基金統計
const p = store.proj()
p.type = 'fund'
p.expenses = [
  { id: 1, kind: 'in', amount: 300, payer: 1, date: '1/1' },
  { id: 2, kind: 'in', amount: 200, payer: 2, date: '1/1' },
  { id: 3, kind: 'out', amount: 150, payer: 0, date: '1/2' },
]
const ls = calc.ledgerStats()
t('ledgerStats 餘額', ls.bal === 350 && ls.tin === 500 && ls.tout === 150)
t('depositBreakdown 排序', calc.depositBreakdown()[0].label === '阿肥')

console.log(`\n${pass} passed, ${fail} failed`)
if (fail) process.exit(1)
