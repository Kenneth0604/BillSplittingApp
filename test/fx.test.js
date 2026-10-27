import { describe, it, expect } from 'vitest'
import { toBase, fmtCur, fmtRate, invertRates } from '../src/lib/fx.js'

describe('多幣別', () => {
  it('換算成新台幣取整數,無效值回 NaN', () => {
    expect(toBase(3000, 0.2134)).toBe(640)
    expect(toBase('12.5', 32.1)).toBe(401)
    expect(toBase(100, 0)).toBeNaN()
    expect(toBase('x', 1)).toBeNaN()
  })
  it('原幣顯示依幣別小數位', () => {
    expect(fmtCur(3000, 'JPY')).toBe('¥3,000')
    expect(fmtCur(12.5, 'USD')).toBe('US$12.50')
    expect(fmtCur(12, 'USD')).toBe('US$12')
  })
  it('匯率顯示', () => {
    expect(fmtRate(0.213456)).toBe('0.2135')
    expect(fmtRate(32.149)).toBe('32.15')
    expect(fmtRate(0.00128)).toBe('0.00128')
  })
  it('API 匯率反轉成 1 外幣 = ? 台幣', () => {
    const r = invertRates({ JPY: 4.7, USD: 0.03125, XXX: 2 })
    expect(r.USD).toBeCloseTo(32)
    expect(r.JPY).toBeCloseTo(0.2128, 3)
    expect(r.XXX).toBeUndefined()
    expect(r.TWD).toBe(1)
  })
})
