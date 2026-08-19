// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { attachKeyboard, normalizeKeyEvent } from '../../src/ui/input'

function event(init: Partial<KeyboardEvent>): KeyboardEvent {
  return { ctrlKey: false, altKey: false, metaKey: false, key: '', ...init } as KeyboardEvent
}

describe('normalizeKeyEvent', () => {
  it('印字可能文字をそのまま返す', () => {
    expect(normalizeKeyEvent(event({ key: 'w' }))).toBe('w')
    expect(normalizeKeyEvent(event({ key: '$' }))).toBe('$')
    expect(normalizeKeyEvent(event({ key: ' ' }))).toBe(' ')
  })

  it('特殊キーを正規化する', () => {
    expect(normalizeKeyEvent(event({ key: 'Escape' }))).toBe('Escape')
    expect(normalizeKeyEvent(event({ key: 'Enter' }))).toBe('Enter')
    expect(normalizeKeyEvent(event({ key: 'Backspace' }))).toBe('Backspace')
  })

  it('修飾キー付きの入力はブラウザに渡すため null を返す', () => {
    expect(normalizeKeyEvent(event({ key: 'r', ctrlKey: true }))).toBeNull()
    expect(normalizeKeyEvent(event({ key: 'l', metaKey: true }))).toBeNull()
    expect(normalizeKeyEvent(event({ key: 'w', altKey: true }))).toBeNull()
  })

  it('扱わないキーは null を返す', () => {
    expect(normalizeKeyEvent(event({ key: 'ArrowLeft' }))).toBeNull()
    expect(normalizeKeyEvent(event({ key: 'Shift' }))).toBeNull()
    expect(normalizeKeyEvent(event({ key: 'F5' }))).toBeNull()
  })

  it('Tab は「一覧へ戻る」用の予約キーとして認識する', () => {
    expect(normalizeKeyEvent(event({ key: 'Tab' }))).toBe('Tab')
  })
})

describe('attachKeyboard', () => {
  it('セッションが有効なときはキーを解釈し、既定動作を抑止する', () => {
    const onKey = vi.fn()
    const detach = attachKeyboard(window, onKey, () => true)
    const evt = new KeyboardEvent('keydown', { key: 'j', cancelable: true })
    window.dispatchEvent(evt)

    expect(onKey).toHaveBeenCalledWith('j')
    expect(evt.defaultPrevented).toBe(true)
    detach()
  })

  it('セッションが無効なときは何もせず、ブラウザの既定動作（ボタンの Enter/Space 活性化など）を通す', () => {
    // ステージ選択画面（セッション無し）で、フォーカスしたカードの
    // Enter/Space が握りつぶされてしまっていた不具合の再現テスト
    const onKey = vi.fn()
    const detach = attachKeyboard(window, onKey, () => false)
    const evt = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true })
    window.dispatchEvent(evt)

    expect(onKey).not.toHaveBeenCalled()
    expect(evt.defaultPrevented).toBe(false)
    detach()
  })

  it('セッション中でも Ctrl / Alt / Meta 付きの入力はブラウザへ透過する', () => {
    const onKey = vi.fn()
    const detach = attachKeyboard(window, onKey, () => true)
    const evt = new KeyboardEvent('keydown', { key: 's', ctrlKey: true, cancelable: true })
    window.dispatchEvent(evt)

    expect(onKey).not.toHaveBeenCalled()
    expect(evt.defaultPrevented).toBe(false)
    detach()
  })

  it('購読解除後はイベントを受け取らない', () => {
    const onKey = vi.fn()
    const detach = attachKeyboard(window, onKey, () => true)
    detach()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', cancelable: true }))

    expect(onKey).not.toHaveBeenCalled()
  })
})
