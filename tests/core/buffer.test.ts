import { describe, expect, it } from 'vitest'
import {
  clampCursor,
  deleteCharwise,
  deleteLinewise,
  firstNonBlankCol,
  insertCharwise,
  insertLinewise,
  lastCol,
  normalizeLines,
  sliceCharwise,
  sliceLinewise,
  splitLine,
} from '../../src/core/buffer'

describe('normalizeLines', () => {
  it('空配列を空行 1 つにする', () => {
    expect(normalizeLines([])).toEqual([''])
  })

  it('空でない配列はそのまま返す', () => {
    expect(normalizeLines(['a'])).toEqual(['a'])
  })

  it('入力配列を変更しない', () => {
    const input = ['a', 'b']
    const original = ['a', 'b']
    const result = normalizeLines(input)
    expect(input).toEqual(original)
  })

  it('非空配列の場合、異なる参照を返す', () => {
    const input = ['a', 'b']
    const result = normalizeLines(input)
    expect(result).not.toBe(input)
  })
})

describe('lastCol', () => {
  it('ノーマルモードでは最終文字の位置', () => {
    expect(lastCol('abc', 'normal')).toBe(2)
  })

  it('挿入モードでは最終文字の次', () => {
    expect(lastCol('abc', 'insert')).toBe(3)
  })

  it('空行では 0', () => {
    expect(lastCol('', 'normal')).toBe(0)
    expect(lastCol('', 'insert')).toBe(0)
  })
})

describe('clampCursor', () => {
  it('行をはみ出した位置を丸める', () => {
    expect(clampCursor(['ab', 'c'], { row: 5, col: 9 }, 'normal')).toEqual({ row: 1, col: 0 })
  })

  it('負の値を 0 に丸める', () => {
    expect(clampCursor(['ab'], { row: -1, col: -3 }, 'normal')).toEqual({ row: 0, col: 0 })
  })
})

describe('firstNonBlankCol', () => {
  it('先頭の空白を飛ばした位置を返す', () => {
    expect(firstNonBlankCol('   xy')).toBe(3)
  })

  it('全部空白なら 0 を返す', () => {
    expect(firstNonBlankCol('   ')).toBe(0)
  })
})

describe('sliceCharwise', () => {
  it('同一行の範囲を切り出す', () => {
    expect(sliceCharwise(['abcdef'], { row: 0, col: 1 }, { row: 0, col: 4 })).toEqual(['bcd'])
  })

  it('複数行にまたがる範囲を切り出す', () => {
    expect(
      sliceCharwise(['abc', 'def', 'ghi'], { row: 0, col: 1 }, { row: 2, col: 2 }),
    ).toEqual(['bc', 'def', 'gh'])
  })

  it('入力配列を変更しない', () => {
    const input = ['abcdef']
    const original = ['abcdef']
    sliceCharwise(input, { row: 0, col: 1 }, { row: 0, col: 4 })
    expect(input).toEqual(original)
  })
})

describe('deleteCharwise', () => {
  it('同一行の範囲を削除する', () => {
    expect(deleteCharwise(['abcdef'], { row: 0, col: 1 }, { row: 0, col: 4 })).toEqual(['aef'])
  })

  it('複数行にまたがる範囲を削除して行を結合する', () => {
    expect(
      deleteCharwise(['abc', 'def', 'ghi'], { row: 0, col: 1 }, { row: 2, col: 2 }),
    ).toEqual(['ai'])
  })

  it('入力配列を変更しない', () => {
    const input = ['abcdef']
    const original = ['abcdef']
    deleteCharwise(input, { row: 0, col: 1 }, { row: 0, col: 4 })
    expect(input).toEqual(original)
  })
})

describe('sliceLinewise', () => {
  it('両端を含めて行を切り出す', () => {
    expect(sliceLinewise(['a', 'b', 'c'], 0, 1)).toEqual(['a', 'b'])
  })

  it('入力配列を変更しない', () => {
    const input = ['a', 'b', 'c']
    const original = ['a', 'b', 'c']
    sliceLinewise(input, 0, 1)
    expect(input).toEqual(original)
  })
})

describe('deleteLinewise', () => {
  it('両端を含めて行を削除する', () => {
    expect(deleteLinewise(['a', 'b', 'c'], 0, 1)).toEqual(['c'])
  })

  it('全行を削除したら空行 1 つを残す', () => {
    expect(deleteLinewise(['a', 'b'], 0, 1)).toEqual([''])
  })

  it('入力配列を変更しない', () => {
    const input = ['a', 'b', 'c']
    const original = ['a', 'b', 'c']
    deleteLinewise(input, 0, 1)
    expect(input).toEqual(original)
  })
})

describe('insertCharwise', () => {
  it('1 行のテキストを挿入しカーソルを末尾文字に置く', () => {
    expect(insertCharwise(['axz'], { row: 0, col: 1 }, ['bc'])).toEqual({
      lines: ['abcxz'],
      cursor: { row: 0, col: 2 },
    })
  })

  it('複数行のテキストを挿入する', () => {
    expect(insertCharwise(['axz'], { row: 0, col: 1 }, ['b', 'c'])).toEqual({
      lines: ['ab', 'cxz'],
      cursor: { row: 1, col: 0 },
    })
  })

  it('入力配列を変更しない', () => {
    const input = ['axz']
    const original = ['axz']
    insertCharwise(input, { row: 0, col: 1 }, ['bc'])
    expect(input).toEqual(original)
  })
})

describe('insertLinewise', () => {
  it('指定行の直前に行を挿入する', () => {
    expect(insertLinewise(['a', 'c'], 1, ['b'])).toEqual(['a', 'b', 'c'])
  })

  it('末尾に追加できる', () => {
    expect(insertLinewise(['a'], 1, ['b'])).toEqual(['a', 'b'])
  })

  it('入力配列を変更しない', () => {
    const input = ['a', 'c']
    const original = ['a', 'c']
    insertLinewise(input, 1, ['b'])
    expect(input).toEqual(original)
  })
})

describe('splitLine', () => {
  it('カーソル位置で行を 2 つに割る', () => {
    expect(splitLine(['abcd'], { row: 0, col: 2 })).toEqual(['ab', 'cd'])
  })

  it('入力配列を変更しない', () => {
    const input = ['abcd']
    const original = ['abcd']
    splitLine(input, { row: 0, col: 2 })
    expect(input).toEqual(original)
  })
})
