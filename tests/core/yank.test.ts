import { describe, expect, it } from 'vitest'
import { pos, run } from './helpers'

describe('y + モーション', () => {
  it('yw で単語をレジスタに入れる', () => {
    expect(run(['alpha beta'], [0, 0], 'yw').register).toEqual({
      text: ['alpha '],
      linewise: false,
    })
  })

  it('y$ で行末までをレジスタに入れる', () => {
    expect(run(['one two'], [0, 4], 'y$').register).toEqual({
      text: ['two'],
      linewise: false,
    })
  })

  it('バッファを変えない', () => {
    expect(run(['alpha beta'], [0, 0], 'yw').lines).toEqual(['alpha beta'])
  })

  it('アンドゥスタックを積まない', () => {
    expect(run(['alpha beta'], [0, 0], 'yw').undoStack).toHaveLength(0)
  })

  it('後方へのヤンクはカーソルを範囲の先頭へ移す', () => {
    expect(pos(run(['alpha beta'], [0, 6], 'yb'))).toEqual([0, 0])
  })
})

describe('yy', () => {
  it('行を linewise でレジスタに入れる', () => {
    expect(run(['a', 'b'], [0, 0], 'yy').register).toEqual({ text: ['a'], linewise: true })
  })

  it('count の分だけ行をレジスタに入れる', () => {
    expect(run(['a', 'b', 'c'], [0, 0], '2yy').register).toEqual({
      text: ['a', 'b'],
      linewise: true,
    })
  })
})

describe('p / P (charwise)', () => {
  it('p はカーソルの次の位置へ貼る', () => {
    expect(run(['one two', 'X'], [0, 4], 'y$jp').lines).toEqual(['one two', 'Xtwo'])
  })

  it('P はカーソル位置へ貼る', () => {
    expect(run(['one two', 'X'], [0, 4], 'y$jP').lines).toEqual(['one two', 'twoX'])
  })

  it('カーソルは貼った最後の文字に来る', () => {
    expect(pos(run(['one two', 'X'], [0, 4], 'y$jp'))).toEqual([1, 3])
  })

  it('count の分だけ繰り返す', () => {
    expect(run(['ab'], [0, 0], 'yl$2p').lines).toEqual(['abaa'])
  })
})

describe('p / P (linewise)', () => {
  it('p は次の行へ貼る', () => {
    expect(run(['a', 'b'], [0, 0], 'yyp').lines).toEqual(['a', 'a', 'b'])
  })

  it('P は前の行へ貼る', () => {
    expect(run(['a', 'b'], [1, 0], 'yyP').lines).toEqual(['a', 'b', 'b'])
  })

  it('カーソルは貼った先頭行の最初の非空白へ来る', () => {
    expect(pos(run(['  ab', 'c'], [0, 3], 'yyp'))).toEqual([1, 2])
  })

  it('count の分だけ行を繰り返す', () => {
    expect(run(['a', 'b'], [0, 0], '2yy2p').lines).toEqual(['a', 'a', 'b', 'a', 'b', 'b'])
  })
})

describe('アンドゥの単位', () => {
  it('ペーストは 1 スナップショットを積む', () => {
    expect(run(['a', 'b'], [0, 0], 'yyp').undoStack).toHaveLength(1)
  })
})

describe('仕様のシナリオ: ステージ 13 の想定解', () => {
  it('one two / X を 3 行に組み替える', () => {
    const state = run(['one two', 'X'], [0, 0], 'wy$jpggyyjP')
    expect(state.lines).toEqual(['one two', 'one two', 'Xtwo'])
  })
})
