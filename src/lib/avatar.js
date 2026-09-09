/** 把選到的圖片裁成正方形並縮到 96×96 的小型 JPEG dataURL(存在 metadata / 專案 JSON 內) */
export function readAvatar(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('沒有選擇檔案'))
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = 96
      c.height = 96
      const ctx = c.getContext('2d')
      const side = Math.min(img.width, img.height)
      ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, 96, 96)
      URL.revokeObjectURL(url)
      resolve(c.toDataURL('image/jpeg', 0.8))
    }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('無法讀取圖片')) }
    img.src = url
  })
}
