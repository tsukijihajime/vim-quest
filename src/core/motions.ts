import { firstNonBlankCol, lastCol } from './buffer'
import type { CharSearchKind, Cursor, MotionResult } from './types'

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

type CharClass = 'blank' | 'word' | 'punct'

function classOf(ch: string, big: boolean): CharClass {
  if (ch === '' || ch === ' ' || ch === '\t') return 'blank'
  if (big) return 'word'
  return /[A-Za-z0-9_]/.test(ch) ? 'word' : 'punct'
}

function charAt(lines: string[], p: Cursor): string {
  const line = lines[p.row]
  return p.col < line.length ? line[p.col] : ''
}

/** 空行も列 0 の 1 マスとして数えて次の位置へ進む */
function nextPos(lines: string[], p: Cursor): Cursor | null {
  const width = Math.max(lines[p.row].length, 1)
  if (p.col + 1 < width) return { row: p.row, col: p.col + 1 }
  if (p.row + 1 < lines.length) return { row: p.row + 1, col: 0 }
  return null
}

function prevPos(lines: string[], p: Cursor): Cursor | null {
  if (p.col > 0) return { row: p.row, col: p.col - 1 }
  if (p.row > 0) return { row: p.row - 1, col: Math.max(lines[p.row - 1].length, 1) - 1 }
  return null
}

function isEmptyLine(lines: string[], row: number): boolean {
  return lines[row].length === 0
}

function lastPosition(lines: string[]): Cursor {
  const row = lines.length - 1
  return { row, col: Math.max(0, lines[row].length - 1) }
}

export function wordForward(
  lines: string[],
  cursor: Cursor,
  count: number,
  big: boolean,
): MotionResult {
  let p = cursor
  for (let i = 0; i < count; i += 1) {
    const startClass = classOf(charAt(lines, p), big)
    let q = nextPos(lines, p)
    if (q === null) return { cursor: lastPosition(lines), kind: 'exclusive' }

    // 今いる単語の残りを飛ばす。改行を越えたら単語境界なので止まる
    if (startClass !== 'blank') {
      while (q !== null && q.col !== 0 && classOf(charAt(lines, q), big) === startClass) {
        q = nextPos(lines, q)
      }
    }
    // 空白を飛ばす。ただし空行は 1 単語とみなして止まる
    while (q !== null && classOf(charAt(lines, q), big) === 'blank' && !isEmptyLine(lines, q.row)) {
      q = nextPos(lines, q)
    }
    if (q === null) return { cursor: lastPosition(lines), kind: 'exclusive' }
    p = q
  }
  return { cursor: p, kind: 'exclusive' }
}

export function wordBackward(
  lines: string[],
  cursor: Cursor,
  count: number,
  big: boolean,
): MotionResult {
  let p = cursor
  for (let i = 0; i < count; i += 1) {
    let q = prevPos(lines, p)
    if (q === null) return { cursor: { row: 0, col: 0 }, kind: 'exclusive' }

    while (q !== null && classOf(charAt(lines, q), big) === 'blank' && !isEmptyLine(lines, q.row)) {
      q = prevPos(lines, q)
    }
    if (q === null) return { cursor: { row: 0, col: 0 }, kind: 'exclusive' }
    if (isEmptyLine(lines, q.row)) {
      p = q
      continue
    }

    // その単語の先頭まで戻る。行をまたいだら止まる
    const cls = classOf(charAt(lines, q), big)
    for (;;) {
      const n = prevPos(lines, q)
      if (n === null || n.row !== q.row) break
      if (classOf(charAt(lines, n), big) !== cls) break
      q = n
    }
    p = q
  }
  return { cursor: p, kind: 'exclusive' }
}

export function wordEnd(
  lines: string[],
  cursor: Cursor,
  count: number,
  big: boolean,
): MotionResult {
  let p = cursor
  for (let i = 0; i < count; i += 1) {
    let q = nextPos(lines, p)
    while (q !== null && classOf(charAt(lines, q), big) === 'blank') {
      q = nextPos(lines, q)
    }
    if (q === null) break

    const cls = classOf(charAt(lines, q), big)
    for (;;) {
      const n = nextPos(lines, q)
      if (n === null || n.row !== q.row) break
      if (classOf(charAt(lines, n), big) !== cls) break
      q = n
    }
    p = q
  }
  return { cursor: p, kind: 'inclusive' }
}

export function wordEndBackward(lines: string[], cursor: Cursor, count: number): MotionResult {
  let p = cursor
  for (let i = 0; i < count; i += 1) {
    let q = prevPos(lines, p)
    if (q === null) break

    // 今いる単語を先頭側へ抜ける
    const startClass = classOf(charAt(lines, p), false)
    if (startClass !== 'blank') {
      while (q !== null && q.row === p.row && classOf(charAt(lines, q), false) === startClass) {
        q = prevPos(lines, q)
      }
    }
    while (q !== null && classOf(charAt(lines, q), false) === 'blank') {
      q = prevPos(lines, q)
    }
    if (q === null) break
    p = q
  }
  return { cursor: p, kind: 'inclusive' }
}

export function gotoLine(lines: string[], row: number): MotionResult {
  const clamped = Math.min(Math.max(row, 0), lines.length - 1)
  return {
    cursor: { row: clamped, col: firstNonBlankCol(lines[clamped]) },
    kind: 'linewise',
  }
}

export function gotoFirstLine(lines: string[]): MotionResult {
  return gotoLine(lines, 0)
}

export function gotoLastLine(lines: string[]): MotionResult {
  return gotoLine(lines, lines.length - 1)
}

export function charSearch(
  lines: string[],
  cursor: Cursor,
  kind: CharSearchKind,
  target: string,
  count: number,
  repeat: boolean,
): MotionResult | null {
  const line = lines[cursor.row]
  const forward = kind === 'f' || kind === 't'
  const till = kind === 't' || kind === 'T'
  let col = cursor.col

  for (let i = 0; i < count; i += 1) {
    // t / T の繰り返しは隣接位置に留まってしまうので 1 つ余分にずらす
    const skip = till && (repeat || i > 0) ? 2 : 1
    if (forward) {
      const idx = line.indexOf(target, col + skip)
      if (idx === -1) return null
      col = till ? idx - 1 : idx
    } else {
      const idx = line.lastIndexOf(target, col - skip)
      if (idx === -1) return null
      col = till ? idx + 1 : idx
    }
  }
  // Vim では f と t が inclusive、F と T は exclusive である
  return { cursor: { row: cursor.row, col }, kind: forward ? 'inclusive' : 'exclusive' }
}

export function paragraphForward(
  lines: string[],
  cursor: Cursor,
  count: number,
): MotionResult {
  let row = cursor.row
  for (let i = 0; i < count; i += 1) {
    let r = row + 1
    while (r < lines.length && lines[r].length !== 0) r += 1
    row = Math.min(r, lines.length - 1)
  }
  return { cursor: { row, col: 0 }, kind: 'exclusive' }
}

export function paragraphBackward(
  lines: string[],
  cursor: Cursor,
  count: number,
): MotionResult {
  let row = cursor.row
  for (let i = 0; i < count; i += 1) {
    let r = row - 1
    while (r > 0 && lines[r].length !== 0) r -= 1
    row = Math.max(r, 0)
  }
  return { cursor: { row, col: 0 }, kind: 'exclusive' }
}
