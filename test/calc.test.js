// 純計算單元測試:npm test(vitest)
import { describe, it, expect } from 'vitest'

// store.js 在載入時會讀 localStorage,先塞假的(必須在動態 import 之前)
globalThis.localStorage = { getItem: () => null, setItem: () => {} }

const store = await import('../src/lib/store.js')
store.load()
const calc = await import('../src/lib/calc.js')

describe('多人分帳:餘額 / 結算 / 運算式 / 日期 / 隨機付款', () => {
  // 測試用固定資料(涵蓋均分 / 特定付款 / 已開獎與未開獎的隨機付款)
  Object.assign(store.proj(), {
    members: [{ id: 1, name: '阿肥' }, { id: 2, name: '67哥' }, { id: 3, name: '胖虎' }],
    expenses: [
      { id: 1, cat: '🧋 飲料', amount: 670, payer: 1, splitters: [1, 2, 3], date: '7/15' },
      { id: 2, cat: '📦 其他', amount: 67, payer: 2, splitters: [2], date: '7/15' },
      { id: 3, cat: '🍽️ 晚餐', amount: 667, mode: 'exact', paid: { 2: 667 }, spent: { 1: 500, 2: 67, 3: 100 }, payer: 0, splitters: [], date: '7/16' },
      { id: 4, cat: '🎮 娛樂', amount: 676, mode: 'random', payer: 3, candidates: [1, 2, 3], loser: 2, revealed: true, splitters: [], date: '7/16' },
      { id: 5, cat: '📦 其他', amount: 6767, mode: 'random', payer: 1, candidates: [1, 2, 3], losers: [2], loser: 2, revealed: false, splitters: [], date: '7/17' },
    ],
    nextMemberId: 4, nextExpenseId: 6,
  })

  // 既知答案
  const bal = calc.balances()
  const plan = calc.settlements()

  it('餘額總和為零', () => {
    expect(Math.abs(Object.values(bal).reduce((a, b) => a + b, 0))).toBeLessThan(0.01)
  })
  it('未開獎 6767 不列入', () => {
    expect(Math.abs(bal[1])).toBeLessThan(6000)
  })
  it('結算方案筆數 ≤ 成員數-1', () => {
    expect(plan.length).toBeLessThanOrEqual(store.proj().members.length - 1)
  })
  it('轉帳金額為正', () => {
    plan.forEach((p) => expect(p.amt, `轉帳金額為正 (${p.amt})`).toBeGreaterThan(0))
  })
  it('依方案轉帳後全員歸零', () => {
    const after = { ...bal }
    plan.forEach(({ from, to, amt }) => { after[from] += amt; after[to] -= amt })
    expect(Object.values(after).every((v) => Math.abs(v) < 0.01)).toBe(true)
  })

  // 運算式引擎
  it('evalAmt 670/3', () => {
    expect(Math.abs(calc.evalAmt('670/3') - 223.333)).toBeLessThan(0.01)
  })
  it('evalAmt 結尾運算子忽略', () => {
    expect(calc.evalAmt('100+')).toBe(100)
  })
  it('evalAmt 除以零為 NaN', () => {
    expect(Number.isNaN(calc.evalAmt('1/0'))).toBe(true)
  })
  it('evalAmt 非法字元為 NaN', () => {
    expect(Number.isNaN(calc.evalAmt('1;alert(1)'))).toBe(true)
  })
  it('editAmt 開頭不能是運算子', () => {
    expect(calc.editAmt('', '+')).toBe('')
  })
  it('editAmt 連按運算子換運算子', () => {
    expect(calc.editAmt('12+', '*')).toBe('12*')
  })
  it('editAmt 小數點只能一個', () => {
    expect(calc.editAmt('1.5', '.')).toBe('1.5')
  })
  it('isValidAmount 擋 0 與負數', () => {
    expect(calc.isValidAmount(0)).toBe(false)
    expect(calc.isValidAmount(-5)).toBe(false)
    expect(calc.isValidAmount(10)).toBe(true)
  })

  // 日期轉換
  it('isoToMD', () => {
    expect(calc.isoToMD('2026-09-09')).toBe('9/9')
  })
  it('dateToISO 回推當年', () => {
    expect(calc.dateToISO('7/15').endsWith('-07-15')).toBe(true)
  })

  // losersOf 相容舊格式
  it('losersOf 舊格式 loser', () => {
    expect(calc.losersOf({ loser: 2 }).join()).toBe('2')
  })
  it('losersOf 新格式 losers 優先', () => {
    expect(calc.losersOf({ loser: 2, losers: [1, 3] }).join()).toBe('1,3')
  })

  // randInt 範圍
  it('randInt 不超出範圍', () => {
    for (let i = 0; i < 50; i++) {
      const r = calc.randInt(3)
      expect(r).toBeGreaterThanOrEqual(0)
      expect(r).toBeLessThanOrEqual(2)
    }
  })
})

describe('共同基金:統計', () => {
  // 沿用上面的成員,改成基金專案(依原始腳本順序,在分帳測試之後執行)
  const p = store.proj()
  p.type = 'fund'
  p.expenses = [
    { id: 1, kind: 'in', amount: 300, payer: 1, date: '1/1' },
    { id: 2, kind: 'in', amount: 200, payer: 2, date: '1/1' },
    { id: 3, kind: 'out', amount: 150, payer: 0, date: '1/2' },
  ]

  it('ledgerStats 餘額', () => {
    const ls = calc.ledgerStats()
    expect(ls.bal).toBe(350)
    expect(ls.tin).toBe(500)
    expect(ls.tout).toBe(150)
  })
  it('depositBreakdown 排序', () => {
    expect(calc.depositBreakdown()[0].label).toBe('阿肥')
  })
})
