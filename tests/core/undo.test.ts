import { describe, expect, it } from 'vitest'
import { pos, run } from './helpers'

describe('r', () => {
  it('カーソル位置の文字を置き換える', () => {
    expect(run(['cat'], [0, 2], 'rr').lines).toEqual(['car'])
  })

  it('count の分だけ置き換える', () => {
    expect(run(['abcdef'], [0, 1], '3rX').lines).toEqual(['aXXXef'])
  })

  it('行末を越える場合は何もしない', () => {
    expect(run(['abc'], [0, 1], '9rX').lines).toEqual(['abc'])
  })

  it('カーソルは置き換えた最後の文字に来る', () => {
    expect(pos(run(['abcdef'], [0, 1], '3rX'))).toEqual([0, 3])
  })

  it('置換文字は回数として解釈されない', () => {
    expect(run(['abc'], [0, 0], 'r3').lines).toEqual(['3bc'])
  })

  it('Escape で置換を中断する', () => {
    const state = run(['abc'], [0, 0], 'r<Esc>')
    expect(state.lines).toEqual(['abc'])
    expect(state.pending).toBeNull()
  })
})

describe('u', () => {
  it('直前の削除を取り消す', () => {
    expect(run(['a', 'b'], [0, 0], 'ddu').lines).toEqual(['a', 'b'])
  })

  it('カーソル位置も戻す', () => {
    expect(pos(run(['abc'], [0, 2], 'xu'))).toEqual([0, 2])
  })

  it('挿入モードの 1 回分をまとめて取り消す', () => {
    expect(run(['ac'], [0, 1], 'ibbb<Esc>u').lines).toEqual(['ac'])
  })

  it('複数回戻せる', () => {
    expect(run(['abcd'], [0, 0], 'xxxuu').lines).toEqual(['bcd'])
  })

  it('スタックが空なら何も起きない', () => {
    expect(run(['abc'], [0, 0], 'u').lines).toEqual(['abc'])
  })

  it('ヤンクは取り消しの対象にならない', () => {
    expect(run(['a', 'b'], [0, 0], 'ddyyu').lines).toEqual(['a', 'b'])
  })

  it('ペーストも取り消せる', () => {
    expect(run(['a'], [0, 0], 'yypu').lines).toEqual(['a'])
  })
})

describe('仕様のシナリオ: ステージ 14 の想定解', () => {
  it('dd で消してから u で戻し r で直す', () => {
    const state = run(['cat', 'dog'], [0, 0], 'ddu$rr')
    expect(state.lines).toEqual(['car', 'dog'])
  })
})
