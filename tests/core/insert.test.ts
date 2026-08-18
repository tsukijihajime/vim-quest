import { describe, expect, it } from 'vitest'
import { pos, run } from './helpers'

describe('挿入モードへの入り方', () => {
  it('i はカーソル位置から挿入する', () => {
    expect(run(['ame'], [0, 0], 'in<Esc>').lines).toEqual(['name'])
  })

  it('a はカーソルの次の位置から挿入する', () => {
    expect(run(['nme'], [0, 0], 'aa<Esc>').lines).toEqual(['name'])
  })

  it('I は行の最初の非空白から挿入する', () => {
    expect(run(['   abc'], [0, 4], 'IX<Esc>').lines).toEqual(['   Xabc'])
  })

  it('A は行末から挿入する', () => {
    expect(run(['name'], [0, 0], 'A!<Esc>').lines).toEqual(['name!'])
  })

  it('o は下に行を作って挿入する', () => {
    expect(run(['a', 'b'], [0, 0], 'oX<Esc>').lines).toEqual(['a', 'X', 'b'])
  })

  it('O は上に行を作って挿入する', () => {
    expect(run(['a', 'b'], [1, 0], 'OX<Esc>').lines).toEqual(['a', 'X', 'b'])
  })

  it('挿入モードに入ると mode が insert になる', () => {
    expect(run(['abc'], [0, 0], 'i').mode).toBe('insert')
  })
})

describe('挿入モード中の入力', () => {
  it('複数文字を順に挿入する', () => {
    expect(run(['ac'], [0, 1], 'ib<Esc>').lines).toEqual(['abc'])
    expect(run([''], [0, 0], 'ihello<Esc>').lines).toEqual(['hello'])
  })

  it('Enter で行を分割する', () => {
    expect(run(['abcd'], [0, 2], 'i<CR><Esc>').lines).toEqual(['ab', 'cd'])
  })

  it('Backspace で直前の 1 文字を消す', () => {
    expect(run(['abcd'], [0, 2], 'i<BS><Esc>').lines).toEqual(['acd'])
  })

  it('行頭の Backspace は前の行と結合する', () => {
    expect(run(['ab', 'cd'], [1, 0], 'i<BS><Esc>').lines).toEqual(['abcd'])
  })

  it('バッファ先頭の Backspace は何も起こさない', () => {
    expect(run(['ab'], [0, 0], 'i<BS><Esc>').lines).toEqual(['ab'])
  })

  it('挿入モードでは行末の次までカーソルを置ける', () => {
    expect(pos(run(['ab'], [0, 0], 'A'))).toEqual([0, 2])
  })
})

describe('Escape', () => {
  it('ノーマルモードへ戻る', () => {
    expect(run(['abc'], [0, 0], 'i<Esc>').mode).toBe('normal')
  })

  it('カーソルを 1 つ左へ動かす', () => {
    expect(pos(run(['name'], [0, 0], 'A!<Esc>'))).toEqual([0, 4])
  })

  it('行頭ではカーソルを動かさない', () => {
    expect(pos(run(['abc'], [0, 0], 'i<Esc>'))).toEqual([0, 0])
  })
})

describe('挿入モードとアンドゥの単位', () => {
  it('挿入モードの 1 回分でスナップショットが 1 つだけ積まれる', () => {
    expect(run(['ac'], [0, 1], 'ib<Esc>').undoStack).toHaveLength(1)
  })

  it('入るたびにスナップショットが増える', () => {
    expect(run(['ac'], [0, 1], 'ib<Esc>A!<Esc>').undoStack).toHaveLength(2)
  })
})

describe('仕様のシナリオ: ステージ 11 の想定解', () => {
  it('nme を top / "  name!" / end に変える', () => {
    const state = run(['nme'], [0, 0], 'aa<Esc>A!<Esc>I<Space><Space><Esc>oend<Esc>ggOtop<Esc>')
    expect(state.lines).toEqual(['top', '  name!', 'end'])
  })
})
