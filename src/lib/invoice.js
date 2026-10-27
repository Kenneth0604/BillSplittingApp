// 台灣電子發票證明聯「左邊」QR code 解析(財政部規格):
//   0-9   發票字軌號碼(2 英文 + 8 數字)
//   10-16 開立日期(民國年 3 碼 + 月日,例 1131027)
//   17-20 隨機碼
//   21-28 銷售額(未稅,16 進位)
//   29-36 總計額(含稅,16 進位)
//   37-44 買方統編、45-52 賣方統編、53-76 加密驗證資訊
//   之後以 ':' 分隔:營業人自用區、本張品項數、總品項數、中文編碼(0 Big5 / 1 UTF-8 / 2 Base64),接著每 3 欄一個品項(品名:數量:單價)
// 右邊 QR code 以 '**' 開頭,只放剩下的品項,這裡不處理。

export function isRightQR(text) {
  return typeof text === 'string' && text.startsWith('**')
}

function decodeName(s, encoding) {
  if (encoding === '2') {
    try {
      const bin = atob(s)
      return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))
    } catch { return s }
  }
  return s
}

/** @returns {null | { number, date: 'YYYY-MM-DD', total, untaxed, seller, items: [{ name, qty, price }] }} */
export function parseInvoiceQR(text) {
  if (typeof text !== 'string' || text.length < 77) return null
  const number = text.slice(0, 10)
  if (!/^[A-Z]{2}\d{8}$/.test(number)) return null
  const roc = text.slice(10, 17)
  if (!/^\d{7}$/.test(roc)) return null
  const y = Number(roc.slice(0, 3)) + 1911
  const m = Number(roc.slice(3, 5))
  const d = Number(roc.slice(5, 7))
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  const untaxed = parseInt(text.slice(21, 29), 16)
  const total = parseInt(text.slice(29, 37), 16)
  if (!Number.isFinite(total) || !/^[0-9a-fA-F]{8}$/.test(text.slice(29, 37))) return null
  const seller = text.slice(45, 53)

  const items = []
  const rest = text.slice(77)
  if (rest.startsWith(':')) {
    const f = rest.slice(1).split(':')
    const encoding = f[3]
    for (let i = 4; i + 2 < f.length; i += 3) {
      const name = decodeName(f[i], encoding).trim()
      const qty = Number(f[i + 1])
      const price = Number(f[i + 2])
      if (name) items.push({ name, qty: Number.isFinite(qty) ? qty : 1, price: Number.isFinite(price) ? price : 0 })
    }
  }
  const pad = (n) => String(n).padStart(2, '0')
  return { number, date: `${y}-${pad(m)}-${pad(d)}`, total, untaxed: Number.isFinite(untaxed) ? untaxed : null, seller, items }
}

/** 說明欄建議:前兩個品名(多的用「等 N 項」),沒有品項就用發票號碼 */
export function invoiceDesc(inv) {
  if (!inv) return ''
  const names = inv.items.map((x) => x.name).filter(Boolean)
  if (!names.length) return `發票 ${inv.number}`
  const head = names.slice(0, 2).join('、')
  return names.length > 2 ? `${head} 等 ${names.length} 項` : head
}
