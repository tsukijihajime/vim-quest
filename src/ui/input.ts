export function normalizeKeyEvent(event: KeyboardEvent): string | null {
  // 修飾キー付きの入力はブラウザのショートカットを潰さないよう透過させる
  if (event.ctrlKey || event.altKey || event.metaKey) return null
  if (event.key === 'Escape') return 'Escape'
  if (event.key === 'Enter') return 'Enter'
  if (event.key === 'Backspace') return 'Backspace'
  if (event.key.length === 1) return event.key
  return null
}

/** キーボードを購読する。戻り値を呼ぶと購読を解除する */
export function attachKeyboard(target: Window, onKey: (key: string) => void): () => void {
  const handler = (event: KeyboardEvent): void => {
    const key = normalizeKeyEvent(event)
    if (key === null) return
    event.preventDefault()
    onKey(key)
  }
  target.addEventListener('keydown', handler)
  return () => target.removeEventListener('keydown', handler)
}
