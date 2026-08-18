import { describe, expect, it } from 'vitest'
import { normalizeKeyEvent } from '../../src/ui/input'

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
})
