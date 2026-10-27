import { describe, it, expect } from 'vitest'
import { parseInvoiceQR, invoiceDesc, isRightQR } from '../src/lib/invoice.js'

// 組一條符合規格的左邊 QR 字串
function qr({ no = 'AB12345678', date = '1131027', total = 150, untaxed = 143, items = ':**********:2:2:1:珍珠奶茶:1:65:雞排:1:85' } = {}) {
  const hex = (n) => n.toString(16).padStart(8, '0')
  return no + date + '1234' + hex(untaxed) + hex(total) + '00000000' + '12345678' + 'A'.repeat(24) + items
}

describe('電子發票 QR', () => {
  it('解析號碼、日期(民國轉西元)、金額與品項', () => {
    const r = parseInvoiceQR(qr())
    expect(r).toMatchObject({ number: 'AB12345678', date: '2024-10-27', total: 150, untaxed: 143, seller: '12345678' })
    expect(r.items).toEqual([{ name: '珍珠奶茶', qty: 1, price: 65 }, { name: '雞排', qty: 1, price: 85 }])
    expect(invoiceDesc(r)).toBe('珍珠奶茶、雞排')
  })
  it('Base64 品名', () => {
    const b64 = btoa(String.fromCharCode(...new TextEncoder().encode('拿鐵')))
    const r = parseInvoiceQR(qr({ items: `:**********:1:1:2:${b64}:2:60` }))
    expect(r.items[0]).toEqual({ name: '拿鐵', qty: 2, price: 60 })
  })
  it('沒有品項時用發票號碼當說明;多品項顯示「等 N 項」', () => {
    expect(invoiceDesc(parseInvoiceQR(qr({ items: '' })))).toBe('發票 AB12345678')
    expect(invoiceDesc({ items: [{ name: 'a' }, { name: 'b' }, { name: 'c' }] })).toBe('a、b 等 3 項')
  })
  it('不是左邊 QR 的內容回 null', () => {
    expect(parseInvoiceQR('https://example.com')).toBeNull()
    expect(parseInvoiceQR(qr({ no: 'ab12345678' }))).toBeNull()
    expect(parseInvoiceQR(qr({ date: '1131327' }))).toBeNull()
    expect(isRightQR('**:雞排:1:85')).toBe(true)
  })
})
