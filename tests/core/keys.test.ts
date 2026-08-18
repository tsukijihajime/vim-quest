import { describe, expect, it } from 'vitest'
import { formatKey, parseKeys } from '../../src/core/keys'

describe('parseKeys', () => {
  it('印字可能文字を 1 文字ずつ分解する', () => {
    expect(parseKeys('wdw')).toEqual(['w', 'd', 'w'])
  })

  it('名前付きトークンを展開する', () => {
    expect(parseKeys('i<Esc>')).toEqual(['i', 'Escape'])
    expect(parseKeys('o<CR>x')).toEqual(['o', 'Enter', 'x'])
    expect(parseKeys('<BS>')).toEqual(['Backspace'])
    expect(parseKeys('f<Space>')).toEqual(['f', ' '])
    expect(parseKeys('<lt>')).toEqual(['<'])
  })

  it('トークンと通常文字を混ぜられる', () => {
    expect(parseKeys('aa<Esc>A!<Esc>')).toEqual([
      'a', 'a', 'Escape', 'A', '!', 'Escape',
    ])
  })

  it('未知のトークンは例外にする', () => {
    expect(() => parseKeys('<Nope>')).toThrow(/未知のキートークン/)
  })

  it('閉じていない山括弧は例外にする', () => {
    expect(() => parseKeys('<Esc')).toThrow(/閉じていない/)
  })

  it('空文字列は空配列になる', () => {
    expect(parseKeys('')).toEqual([])
  })
})

describe('formatKey', () => {
  it('特殊キーをトークンに戻す', () => {
    expect(formatKey('Escape')).toBe('<Esc>')
    expect(formatKey(' ')).toBe('<Space>')
    expect(formatKey('w')).toBe('w')
  })
})
