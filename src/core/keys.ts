const TOKEN_TO_KEY: Record<string, string> = {
  '<Esc>': 'Escape',
  '<CR>': 'Enter',
  '<BS>': 'Backspace',
  '<Space>': ' ',
  '<lt>': '<',
}

const KEY_TO_TOKEN: Record<string, string> = {
  Escape: '<Esc>',
  Enter: '<CR>',
  Backspace: '<BS>',
  ' ': '<Space>',
  '<': '<lt>',
}

/** "wdw" や "i<Esc>" のようなキー表記をキー配列へ展開する */
export function parseKeys(notation: string): string[] {
  const keys: string[] = []
  let i = 0
  while (i < notation.length) {
    if (notation[i] === '<') {
      const end = notation.indexOf('>', i)
      if (end === -1) {
        throw new Error(`閉じていない山括弧: ${notation.slice(i)}`)
      }
      const token = notation.slice(i, end + 1)
      const key = TOKEN_TO_KEY[token]
      if (key === undefined) {
        throw new Error(`未知のキートークン: ${token}`)
      }
      keys.push(key)
      i = end + 1
      continue
    }
    keys.push(notation[i])
    i += 1
  }
  return keys
}

/** キーを表示用のトークンへ戻す */
export function formatKey(key: string): string {
  return KEY_TO_TOKEN[key] ?? key
}
