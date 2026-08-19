import { describe, expect, it } from 'vitest'
import {
  firstNonBlank,
  lineEnd,
  lineStart,
  moveDown,
  moveLeft,
  moveRight,
  moveUp,
} from '../../src/core/motions'

const LINES = ['    function greet(name) {', '        return 1', '    }']

describe('moveLeft / moveRight', () => {
  it('count の分だけ動く', () => {
    expect(moveRight(['abcdef'], { row: 0, col: 0 }, 3).cursor).toEqual({ row: 0, col: 3 })
    expect(moveLeft(['abcdef'], { row: 0, col: 4 }, 2).cursor).toEqual({ row: 0, col: 2 })
  })

  it('行をまたがず端で止まる', () => {
    expect(moveRight(['abc', 'def'], { row: 0, col: 1 }, 99).cursor).toEqual({ row: 0, col: 2 })
    expect(moveLeft(['abc'], { row: 0, col: 1 }, 99).cursor).toEqual({ row: 0, col: 0 })
  })

  it('exclusive である', () => {
    expect(moveRight(['abc'], { row: 0, col: 0 }, 1).kind).toBe('exclusive')
  })
})

describe('moveDown / moveUp', () => {
  it('desiredCol を保ったまま行を移動する', () => {
    expect(moveDown(LINES, { row: 0, col: 8 }, 1, 8).cursor).toEqual({ row: 1, col: 8 })
  })

  it('短い行では行末に丸める', () => {
    expect(moveDown(LINES, { row: 1, col: 8 }, 1, 8).cursor).toEqual({ row: 2, col: 4 })
  })

  it('バッファの端で止まる', () => {
    expect(moveUp(LINES, { row: 0, col: 2 }, 5, 2).cursor).toEqual({ row: 0, col: 2 })
    expect(moveDown(LINES, { row: 0, col: 2 }, 9, 2).cursor).toEqual({ row: 2, col: 2 })
  })

  it('linewise である', () => {
    expect(moveDown(LINES, { row: 0, col: 0 }, 1, 0).kind).toBe('linewise')
  })
})

describe('lineStart / firstNonBlank / lineEnd', () => {
  it('0 は列 0 へ動く', () => {
    expect(lineStart({ row: 0, col: 9 }).cursor).toEqual({ row: 0, col: 0 })
    expect(lineStart({ row: 0, col: 9 }).kind).toBe('exclusive')
  })

  it('^ は最初の非空白へ動く', () => {
    expect(firstNonBlank(LINES, { row: 0, col: 20 }).cursor).toEqual({ row: 0, col: 4 })
    expect(firstNonBlank(LINES, { row: 0, col: 20 }).kind).toBe('exclusive')
  })

  it('$ は行末へ動き inclusive である', () => {
    const result = lineEnd(LINES, { row: 0, col: 0 }, 1)
    expect(result.cursor).toEqual({ row: 0, col: 25 })
    expect(result.kind).toBe('inclusive')
  })

  it('$ に count を付けると下の行の行末へ動く', () => {
    expect(lineEnd(LINES, { row: 0, col: 0 }, 3).cursor).toEqual({ row: 2, col: 4 })
  })

  it('空行の $ は列 0 になる', () => {
    expect(lineEnd([''], { row: 0, col: 0 }, 1).cursor).toEqual({ row: 0, col: 0 })
  })
})
