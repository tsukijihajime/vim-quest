import { describe, expect, it } from 'vitest'
import {
  charSearch,
  gotoFirstLine,
  gotoLastLine,
  gotoLine,
  paragraphBackward,
  paragraphForward,
} from '../../src/core/motions'

const EIGHT = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight']
const INDENTED = ['  a', '    b', 'c']
const COLONS = ['a:b:c:d:e:f']
const PARAS = ['p1 line1', 'p1 line2', '', 'p2 only', '', 'p3 line1', 'p3 line2']

describe('gotoLine / gotoFirstLine / gotoLastLine', () => {
  it('指定行の最初の非空白へ動く', () => {
    expect(gotoLine(INDENTED, 1).cursor).toEqual({ row: 1, col: 4 })
  })

  it('範囲外の行番号は端に丸める', () => {
    expect(gotoLine(EIGHT, 99).cursor).toEqual({ row: 7, col: 0 })
    expect(gotoLine(EIGHT, -5).cursor).toEqual({ row: 0, col: 0 })
  })

  it('gg は先頭行、G は最終行へ動く', () => {
    expect(gotoFirstLine(EIGHT).cursor).toEqual({ row: 0, col: 0 })
    expect(gotoLastLine(EIGHT).cursor).toEqual({ row: 7, col: 0 })
  })

  it('linewise である', () => {
    expect(gotoLastLine(EIGHT).kind).toBe('linewise')
  })
})

describe('charSearch', () => {
  it('f は対象文字の上へ動く', () => {
    expect(charSearch(COLONS, { row: 0, col: 0 }, 'f', ':', 1, false)?.cursor).toEqual({
      row: 0,
      col: 1,
    })
  })

  it('t は対象文字の手前へ動く', () => {
    expect(charSearch(COLONS, { row: 0, col: 5 }, 't', ':', 1, false)?.cursor).toEqual({
      row: 0,
      col: 6,
    })
  })

  it('F は後方の対象文字の上へ動く', () => {
    expect(charSearch(COLONS, { row: 0, col: 9 }, 'F', ':', 1, false)?.cursor).toEqual({
      row: 0,
      col: 7,
    })
  })

  it('T は後方の対象文字の次へ動く', () => {
    expect(charSearch(COLONS, { row: 0, col: 9 }, 'T', ':', 1, false)?.cursor).toEqual({
      row: 0,
      col: 8,
    })
  })

  it('count の分だけ進む', () => {
    expect(charSearch(COLONS, { row: 0, col: 0 }, 'f', ':', 3, false)?.cursor).toEqual({
      row: 0,
      col: 5,
    })
  })

  it('繰り返しの t は隣に留まらず次へ進む', () => {
    expect(charSearch(COLONS, { row: 0, col: 2 }, 't', ':', 1, true)?.cursor).toEqual({
      row: 0,
      col: 4,
    })
  })

  it('見つからなければ null を返す', () => {
    expect(charSearch(COLONS, { row: 0, col: 0 }, 'f', 'Z', 1, false)).toBeNull()
  })

  it('行をまたがない', () => {
    expect(charSearch(['ab', 'Zc'], { row: 0, col: 0 }, 'f', 'Z', 1, false)).toBeNull()
  })

  it('前方検索は inclusive、後方検索は exclusive である', () => {
    expect(charSearch(COLONS, { row: 0, col: 0 }, 'f', ':', 1, false)?.kind).toBe('inclusive')
    expect(charSearch(COLONS, { row: 0, col: 5 }, 't', ':', 1, false)?.kind).toBe('inclusive')
    expect(charSearch(COLONS, { row: 0, col: 9 }, 'F', ':', 1, false)?.kind).toBe('exclusive')
    expect(charSearch(COLONS, { row: 0, col: 9 }, 'T', ':', 1, false)?.kind).toBe('exclusive')
  })
})

describe('paragraphForward / paragraphBackward', () => {
  it('次の空行へ動く', () => {
    expect(paragraphForward(PARAS, { row: 1, col: 3 }, 1).cursor).toEqual({ row: 2, col: 0 })
    expect(paragraphForward(PARAS, { row: 2, col: 0 }, 1).cursor).toEqual({ row: 4, col: 0 })
  })

  it('空行がなければ最終行へ動く', () => {
    expect(paragraphForward(PARAS, { row: 4, col: 0 }, 1).cursor).toEqual({ row: 6, col: 0 })
  })

  it('前の空行へ動く', () => {
    expect(paragraphBackward(PARAS, { row: 5, col: 2 }, 1).cursor).toEqual({ row: 4, col: 0 })
  })

  it('空行がなければ先頭行へ動く', () => {
    expect(paragraphBackward(PARAS, { row: 2, col: 0 }, 1).cursor).toEqual({ row: 0, col: 0 })
  })

  it('count の分だけ進む', () => {
    expect(paragraphForward(PARAS, { row: 1, col: 3 }, 2).cursor).toEqual({ row: 4, col: 0 })
  })

  it('exclusive である', () => {
    expect(paragraphForward(PARAS, { row: 0, col: 0 }, 1).kind).toBe('exclusive')
  })
})
