// 顯示名稱(留言區暱稱)相關:每個專案可以用不同名字
import { proj, projKey, save } from './store.js'
import { authUser } from './cloud.js'

export function chatName() {
  let n = ''
  try { n = localStorage.getItem('nick_' + projKey()) || '' } catch { /* ignore */ }
  if (!n && authUser) n = authUser.nickname
  if (!n) { try { n = localStorage.getItem('chatName') || '' } catch { /* ignore */ } }
  return n
}

export function rememberNick(name) {
  try {
    localStorage.setItem('nick_' + projKey(), name)
    localStorage.setItem('chatName', name)
  } catch { /* ignore */ }
}

/** 第一次加入雲端專案時詢問顯示名稱(之後可在留言區改) */
export function ensureProjNick() {
  const p = proj()
  if (p.type === 'personal') return
  let existing = ''
  try { existing = localStorage.getItem('nick_' + projKey()) || '' } catch { /* ignore */ }
  if (existing) return
  const def = (authUser && authUser.nickname) || chatName() || ''
  const n = prompt(`你在「${p.name}」要顯示的名稱?(留言時使用,之後可在留言區改)`, def)
  const val = (n && n.trim()) || def
  if (val) {
    try { localStorage.setItem('nick_' + projKey(), val) } catch { /* ignore */ }
  }
}

/** 加入專案時,自動把自己(以此專案的顯示名稱)加入成員名單;回傳提示文字或 null */
export function autoAddSelfAsMember() {
  const p = proj()
  if (p.type === 'personal') return null
  const name = chatName()
  if (!name) return null
  const myAvatar = (authUser && authUser.avatar) || ''
  const exist = p.members.find((m) => m.name === name)
  if (exist) {
    if (!exist.avatar && myAvatar) { exist.avatar = myAvatar; save() }
    return null
  }
  p.members.push({ id: p.nextMemberId++, name, avatar: myAvatar })
  save()
  return `已自動將「${name}」加入成員`
}
