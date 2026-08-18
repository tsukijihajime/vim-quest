import { describe, expect, it } from 'vitest'
import {
  wordBackward,
  wordEnd,
  wordEndBackward,
  wordForward,
} from '../../src/core/motions'

const SENTENCE = ['the quick brown fox jumps', 'over the lazy dog again']
const GREEK = ['alpha beta gamma', 'delta epsilon zeta']
const CODE = ['const url = "https://ex.com/a/b";']

describe('wordForward (w)', () => {
  it('次の単語の先頭へ動く', () => {
    expect(wordForward(SENTENCE, { row: 0, col: 0 }, 1, false).cursor).toEqual({ row: 0, col: 4 })
    expect(wordForward(SENTENCE, { row: 0, col: 4 }, 1, false).cursor).toEqual({ row: 0, col: 10 })
  })

  it('count の分だけ進む', () => {
    expect(wordForward(SENTENCE, { row: 0, col: 0 }, 4, false).cursor).toEqual({ row: 0, col: 20 })
  })

  it('行末を越えて次の行の先頭へ動く', () => {
    expect(wordForward(SENTENCE, { row: 0, col: 20 }, 1, false).cursor).toEqual({ row: 1, col: 0 })
  })

  it('記号の連なりを 1 単語として扱う', () => {
    // "const url = " のあとは `"https` の `"` で止まる
    expect(wordForward(CODE, { row: 0, col: 10 }, 1, false).cursor).toEqual({ row: 0, col: 12 })
    // 記号の塊 `"` を抜けたら英数字の塊が次の単語になる
    expect(wordForward(CODE, { row: 0, col: 12 }, 1, false).cursor).toEqual({ row: 0, col: 13 })
  })

  it('W は空白区切りで飛ばす', () => {
    expect(wordForward(CODE, { row: 0, col: 10 }, 1, true).cursor).toEqual({ row: 0, col: 12 })
    expect(wordForward(CODE, { row: 0, col: 12 }, 1, true).cursor).toEqual({ row: 0, col: 32 })
  })

  it('空行で止まる', () => {
    expect(wordForward(['ab', '', 'cd'], { row: 0, col: 0 }, 1, false).cursor).toEqual({
      row: 1,
      col: 0,
    })
  })

  it('exclusive である', () => {
    expect(wordForward(SENTENCE, { row: 0, col: 0 }, 1, false).kind).toBe('exclusive')
  })
})

describe('wordBackward (b)', () => {
  it('前の単語の先頭へ動く', () => {
    expect(wordBackward(SENTENCE, { row: 1, col: 14 }, 1, false).cursor).toEqual({ row: 1, col: 9 })
  })

  it('単語の途中からはその単語の先頭へ動く', () => {
    expect(wordBackward(SENTENCE, { row: 0, col: 6 }, 1, false).cursor).toEqual({ row: 0, col: 4 })
  })

  it('行頭を越えて前の行の最後の単語へ動く', () => {
    expect(wordBackward(SENTENCE, { row: 1, col: 0 }, 1, false).cursor).toEqual({ row: 0, col: 20 })
  })

  it('count の分だけ戻る', () => {
    expect(wordBackward(SENTENCE, { row: 1, col: 14 }, 5, false).cursor).toEqual({
      row: 0,
      col: 16,
    })
  })

  it('バッファ先頭で止まる', () => {
    expect(wordBackward(SENTENCE, { row: 0, col: 2 }, 9, false).cursor).toEqual({ row: 0, col: 0 })
  })

  it('exclusive である', () => {
    expect(wordBackward(SENTENCE, { row: 1, col: 14 }, 1, false).kind).toBe('exclusive')
  })

  it('空行で止まる', () => {
    // b は空行を 1 つの単語とみなす（w と対称）ため、
    // "cd" の 'c' から戻ると空行 (row 1) でいったん止まる
    expect(wordBackward(['ab', '', 'cd'], { row: 2, col: 0 }, 1, false).cursor).toEqual({
      row: 1,
      col: 0,
    })
  })
})

describe('wordEnd (e)', () => {
  it('単語の末尾へ動く', () => {
    expect(wordEnd(GREEK, { row: 0, col: 0 }, 1, false).cursor).toEqual({ row: 0, col: 4 })
    expect(wordEnd(GREEK, { row: 0, col: 4 }, 1, false).cursor).toEqual({ row: 0, col: 9 })
  })

  it('行末を越えて次の行の単語末へ動く', () => {
    expect(wordEnd(GREEK, { row: 0, col: 15 }, 1, false).cursor).toEqual({ row: 1, col: 4 })
  })

  it('count の分だけ進む', () => {
    expect(wordEnd(GREEK, { row: 0, col: 0 }, 6, false).cursor).toEqual({ row: 1, col: 17 })
  })

  it('inclusive である', () => {
    expect(wordEnd(GREEK, { row: 0, col: 0 }, 1, false).kind).toBe('inclusive')
  })

  it('空行を飛ばす', () => {
    // e は空行を単語とみなさない（w/b と非対称）ため、
    // "ab" の末尾から進むと空行 (row 1) では止まらず "cd" の末尾まで届く
    expect(wordEnd(['ab', '', 'cd'], { row: 0, col: 1 }, 1, false).cursor).toEqual({
      row: 2,
      col: 1,
    })
  })
})

describe('wordEndBackward (ge)', () => {
  it('前の単語の末尾へ動く', () => {
    expect(wordEndBackward(GREEK, { row: 1, col: 12 }, 1).cursor).toEqual({ row: 1, col: 4 })
  })

  it('行頭を越えて前の行の単語末へ動く', () => {
    expect(wordEndBackward(GREEK, { row: 1, col: 4 }, 1).cursor).toEqual({ row: 0, col: 15 })
  })

  it('count の分だけ戻る', () => {
    expect(wordEndBackward(GREEK, { row: 1, col: 17 }, 4).cursor).toEqual({ row: 0, col: 9 })
  })

  it('inclusive である', () => {
    expect(wordEndBackward(GREEK, { row: 1, col: 12 }, 1).kind).toBe('inclusive')
  })

  it('空行を飛ばす', () => {
    // ge も e と同じく空行を単語とみなさないため、
    // "cd" の先頭から戻ると空行 (row 1) では止まらず "ab" の末尾まで届く
    expect(wordEndBackward(['ab', '', 'cd'], { row: 2, col: 0 }, 1).cursor).toEqual({
      row: 0,
      col: 1,
    })
  })
})
