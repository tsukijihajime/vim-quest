import { describe, expect, it } from 'vitest'
import { pos, run } from './helpers'

describe('x', () => {
  it('カーソル位置の文字を消す', () => {
    expect(run(['heXllo'], [0, 2], 'x').lines).toEqual(['hello'])
  })

  it('count の分だけ消す', () => {
    expect(run(['abcdef'], [0, 1], '3x').lines).toEqual(['aef'])
  })

  it('行末を越えない', () => {
    expect(run(['abc', 'def'], [0, 1], '9x').lines).toEqual(['a', 'def'])
  })

  it('行末の文字を消したらカーソルが左へ丸まる', () => {
    expect(pos(run(['abc'], [0, 2], 'x'))).toEqual([0, 1])
  })

  it('空行では何も起きない', () => {
    expect(run([''], [0, 0], 'x').lines).toEqual([''])
  })

  it('レジスタに消した文字が入る', () => {
    expect(run(['abc'], [0, 0], 'x').register).toEqual({ text: ['a'], linewise: false })
  })
})

describe('d + モーション', () => {
  it('dw は次の単語の先頭までを消す', () => {
    expect(run(['keep this line'], [0, 5], 'dw').lines).toEqual(['keep line'])
  })

  it('dw は行末を越えず次の行と結合しない', () => {
    expect(run(['keep this', 'next line'], [0, 5], 'dw').lines).toEqual(['keep ', 'next line'])
  })

  it('dw はバッファ末尾でも最後の文字まで消す', () => {
    expect(run(['keep this'], [0, 5], 'dw').lines).toEqual(['keep '])
  })

  it('dw は最終行の末尾でも最後の文字まで消す', () => {
    expect(run(['aa bb', 'cc dd'], [1, 3], 'dw').lines).toEqual(['aa bb', 'cc '])
  })

  it('d3w は最後の 1 語だけ行末で止め、途中の行は結合する', () => {
    expect(run(['a b', 'c d', 'e f'], [0, 0], 'd3w').lines).toEqual(['d', 'e f'])
  })

  it('d$ は行末までを含めて消す', () => {
    expect(run(['tail junk here'], [0, 4], 'd$').lines).toEqual(['tail'])
  })

  it('d0 は行頭までを消す', () => {
    expect(run(['abcdef'], [0, 3], 'd0').lines).toEqual(['def'])
  })

  it('de は単語末を含めて消す', () => {
    expect(run(['alpha beta'], [0, 0], 'de').lines).toEqual([' beta'])
  })

  it('df は対象文字を含めて消す', () => {
    expect(run(['a:b:c'], [0, 0], 'df:').lines).toEqual(['b:c'])
  })

  it('dF は後方の対象文字から手前までを消す', () => {
    expect(run(['a:b:c'], [0, 4], 'dF:').lines).toEqual(['a:bc'])
  })

  it('db は前の単語の先頭までを消す', () => {
    expect(run(['alpha beta gamma'], [0, 11], 'db').lines).toEqual(['alpha gamma'])
  })

  it('dj は 2 行を linewise で消す', () => {
    expect(run(['a', 'b', 'c'], [0, 0], 'dj').lines).toEqual(['c'])
  })

  it('dG は最終行までを linewise で消す', () => {
    expect(run(['a', 'b', 'c'], [1, 0], 'dG').lines).toEqual(['a'])
  })

  it('回数はオペレータ側にもモーション側にも書ける', () => {
    const expected = ['one six']
    expect(run(['one two three four five six'], [0, 4], 'd4w').lines).toEqual(expected)
    expect(run(['one two three four five six'], [0, 4], '4dw').lines).toEqual(expected)
  })

  it('消した内容がレジスタに入る', () => {
    expect(run(['alpha beta'], [0, 0], 'dw').register).toEqual({
      text: ['alpha '],
      linewise: false,
    })
  })
})

describe('dd', () => {
  it('行ごと消す', () => {
    expect(run(['a', 'b', 'c'], [1, 0], 'dd').lines).toEqual(['a', 'c'])
  })

  it('count の分だけ行を消す', () => {
    expect(run(['a', 'b', 'c', 'd'], [0, 0], '3dd').lines).toEqual(['d'])
    expect(run(['a', 'b', 'c', 'd'], [0, 0], 'd3d').lines).toEqual(['d'])
  })

  it('全行を消したら空行 1 つが残る', () => {
    expect(run(['a', 'b'], [0, 0], '2dd').lines).toEqual([''])
  })

  it('カーソルは残った行の最初の非空白へ移る', () => {
    expect(pos(run(['a', '   bb', 'c'], [0, 0], 'dd'))).toEqual([0, 3])
  })

  it('最終行を消したらカーソルが 1 行上がる', () => {
    expect(pos(run(['a', 'b'], [1, 0], 'dd'))).toEqual([0, 0])
  })

  it('linewise としてレジスタに入る', () => {
    expect(run(['a', 'b'], [0, 0], 'dd').register).toEqual({ text: ['a'], linewise: true })
  })
})
