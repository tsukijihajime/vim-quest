export function normalizeKeyEvent(event: KeyboardEvent): string | null {
  // 修飾キー付きの入力はブラウザのショートカットを潰さないよう透過させる
  if (event.ctrlKey || event.altKey || event.metaKey) return null
  if (event.key === 'Escape') return 'Escape'
  if (event.key === 'Enter') return 'Enter'
  if (event.key === 'Backspace') return 'Backspace'
  // Tab はどのステージの allowedKeys にも solution にも現れない予約キー。
  // セッション中は「一覧へ戻る」に割り当てる（main.ts 側で解釈する）
  if (event.key === 'Tab') return 'Tab'
  if (event.key.length === 1) return event.key
  return null
}

/**
 * キーボードを購読する。戻り値を呼ぶと購読を解除する。
 *
 * セッション（ステージ内プレイ）が動いていないときは、キーを解釈せず
 * ブラウザの既定動作をそのまま通す。ステージ選択画面のカードに対する
 * Enter / Space での活性化や、Tab によるフォーカス移動を壊さないためである。
 * セッションが動いているあいだだけ Vim 意味論のためにキーを奪う。
 */
export function attachKeyboard(
  target: Window,
  onKey: (key: string) => void,
  isSessionActive: () => boolean,
): () => void {
  const handler = (event: KeyboardEvent): void => {
    const key = normalizeKeyEvent(event)
    if (key === null) return
    if (!isSessionActive()) return
    event.preventDefault()
    onKey(key)
  }
  target.addEventListener('keydown', handler)
  return () => target.removeEventListener('keydown', handler)
}
