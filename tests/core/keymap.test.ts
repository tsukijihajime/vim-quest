import { describe, expect, it } from 'vitest'
import { pos, run } from './helpers'

const SENTENCE = ['the quick brown fox jumps', 'over the lazy dog again']
const EIGHT = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight']
const COLONS = ['a:b:c:d:e:f', 'x-y-z-w-v-u']

describe('モーションのキー解釈', () => {
  it('hjkl でカーソルが動く', () => {
    expect(pos(run(['abc', 'def'], [0, 0], 'lljh'))).toEqual([1, 1])
  })

  it('数値プレフィックスがモーションに掛かる', () => {
    expect(pos(run(SENTENCE, [0, 0], '3w'))).toEqual([0, 16])
  })

  it('2 桁の数値プレフィックスを受け付ける', () => {
    expect(pos(run(['x'.repeat(30)], [0, 0], '12l'))).toEqual([0, 12])
  })

  it('0 は回数入力中でなければ行頭移動になる', () => {
    expect(pos(run(SENTENCE, [0, 10], '0'))).toEqual([0, 0])
  })

  it('0 は回数入力中なら数字として扱う', () => {
    expect(pos(run(EIGHT, [0, 0], '10G'))).toEqual([7, 0])
  })

  it('gg と G で行を飛ぶ', () => {
    expect(pos(run(EIGHT, [4, 0], 'G'))).toEqual([7, 0])
    expect(pos(run(EIGHT, [4, 0], 'gg'))).toEqual([0, 0])
    expect(pos(run(EIGHT, [4, 0], '4G'))).toEqual([3, 0])
  })

  it('ge で前の単語末へ戻る', () => {
    expect(pos(run(['alpha beta gamma'], [0, 11], 'ge'))).toEqual([0, 9])
  })

  it('f の後の文字はリテラルとして扱われ回数にならない', () => {
    expect(pos(run(['a1b1c'], [0, 0], 'f1'))).toEqual([0, 1])
  })

  it('; と , で文字検索を繰り返す', () => {
    expect(pos(run(COLONS, [0, 0], 'f:;;'))).toEqual([0, 5])
    expect(pos(run(COLONS, [0, 0], 'f:;;,'))).toEqual([0, 3])
  })

  it('見つからない文字検索は何も起こさない', () => {
    expect(pos(run(COLONS, [0, 4], 'fZ'))).toEqual([0, 4])
  })

  it('{ } で段落を移動する', () => {
    const paras = ['a', 'b', '', 'c', '', 'd']
    expect(pos(run(paras, [0, 0], '}}'))).toEqual([4, 0])
    expect(pos(run(paras, [5, 0], '{{'))).toEqual([2, 0])
  })
})

describe('desiredCol の保持', () => {
  it('j k は望ましい列を保つ', () => {
    expect(pos(run(['abcdef', 'ab', 'abcdef'], [0, 5], 'jj'))).toEqual([2, 5])
  })

  it('横移動すると望ましい列が更新される', () => {
    // j で [1,1] に丸められ、h で [1,0] へ。h は横移動なので desiredCol が 0 になり、
    // 続く j は元の列 5 に戻らず [2,0] へ行く。直前の 'jj' が [2,5] になるのとの対比。
    expect(pos(run(['abcdef', 'ab', 'abcdef'], [0, 5], 'jhj'))).toEqual([2, 0])
  })
})

describe('不正なキー列', () => {
  it('未知のキーは無視される', () => {
    expect(pos(run(['abc'], [0, 0], 'Zl'))).toEqual([0, 1])
  })

  it('未知のキーはペンディングを破棄する', () => {
    // dZ は d を捨てるので、続く w は単なる移動になる
    const state = run(SENTENCE, [0, 0], 'dZw')
    expect(state.lines).toEqual(SENTENCE)
    expect(pos(state)).toEqual([0, 4])
  })

  it('入力途中の回数も破棄される', () => {
    const state = run(SENTENCE, [0, 0], '3Zw')
    expect(pos(state)).toEqual([0, 4])
  })

  it('異なるオペレータの重ね押しは破棄される', () => {
    const state = run(SENTENCE, [0, 0], 'dyw')
    expect(state.lines).toEqual(SENTENCE)
  })
})
