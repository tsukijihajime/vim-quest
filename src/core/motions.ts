import { firstNonBlankCol, lastCol } from './buffer'
import type { Cursor, MotionResult } from './types'

export function moveLeft(lines: string[], cursor: Cursor, count: number): MotionResult {
  void lines
  return {
    cursor: { row: cursor.row, col: Math.max(0, cursor.col - count) },
    kind: 'exclusive',
  }
}

export function moveRight(lines: string[], cursor: Cursor, count: number): MotionResult {
  const max = lastCol(lines[cursor.row], 'normal')
  return {
    cursor: { row: cursor.row, col: Math.min(max, cursor.col + count) },
    kind: 'exclusive',
  }
}

export function moveDown(
  lines: string[],
  cursor: Cursor,
  count: number,
  desiredCol: number,
): MotionResult {
  const row = Math.min(lines.length - 1, cursor.row + count)
  return {
    cursor: { row, col: Math.min(desiredCol, lastCol(lines[row], 'normal')) },
    kind: 'linewise',
  }
}

export function moveUp(
  lines: string[],
  cursor: Cursor,
  count: number,
  desiredCol: number,
): MotionResult {
  const row = Math.max(0, cursor.row - count)
  return {
    cursor: { row, col: Math.min(desiredCol, lastCol(lines[row], 'normal')) },
    kind: 'linewise',
  }
}

export function lineStart(cursor: Cursor): MotionResult {
  return { cursor: { row: cursor.row, col: 0 }, kind: 'exclusive' }
}

export function firstNonBlank(lines: string[], cursor: Cursor): MotionResult {
  return {
    cursor: { row: cursor.row, col: firstNonBlankCol(lines[cursor.row]) },
    kind: 'exclusive',
  }
}

export function lineEnd(lines: string[], cursor: Cursor, count: number): MotionResult {
  const row = Math.min(lines.length - 1, cursor.row + count - 1)
  return {
    cursor: { row, col: lastCol(lines[row], 'normal') },
    kind: 'inclusive',
  }
}
