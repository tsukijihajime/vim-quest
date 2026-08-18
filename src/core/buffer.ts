import type { Cursor, Mode } from './types'

/** 行配列が空にならないことを保証する */
export function normalizeLines(lines: string[]): string[] {
  return lines.length === 0 ? [''] : lines
}

/** その行で許されるカーソル列の上限 */
export function lastCol(line: string, mode: Mode): number {
  if (mode === 'insert') return line.length
  return Math.max(0, line.length - 1)
}

export function clampCursor(lines: string[], cursor: Cursor, mode: Mode): Cursor {
  const row = Math.min(Math.max(cursor.row, 0), lines.length - 1)
  const col = Math.min(Math.max(cursor.col, 0), lastCol(lines[row], mode))
  return { row, col }
}

export function firstNonBlankCol(line: string): number {
  const idx = line.search(/\S/)
  return idx === -1 ? 0 : idx
}

/** [start, end) を charwise で切り出す */
export function sliceCharwise(lines: string[], start: Cursor, end: Cursor): string[] {
  if (start.row === end.row) {
    return [lines[start.row].slice(start.col, end.col)]
  }
  const out = [lines[start.row].slice(start.col)]
  for (let row = start.row + 1; row < end.row; row += 1) out.push(lines[row])
  out.push(lines[end.row].slice(0, end.col))
  return out
}

/** [start, end) を charwise で削除する */
export function deleteCharwise(lines: string[], start: Cursor, end: Cursor): string[] {
  const head = lines[start.row].slice(0, start.col)
  const tail = lines[end.row].slice(end.col)
  return normalizeLines([
    ...lines.slice(0, start.row),
    head + tail,
    ...lines.slice(end.row + 1),
  ])
}

/** 両端を含めて行を切り出す */
export function sliceLinewise(lines: string[], startRow: number, endRow: number): string[] {
  return lines.slice(startRow, endRow + 1)
}

/** 両端を含めて行を削除する */
export function deleteLinewise(lines: string[], startRow: number, endRow: number): string[] {
  return normalizeLines([...lines.slice(0, startRow), ...lines.slice(endRow + 1)])
}

/** at の位置に charwise でテキストを挿入する。cursor は挿入した最後の文字の位置 */
export function insertCharwise(
  lines: string[],
  at: Cursor,
  text: string[],
): { lines: string[]; cursor: Cursor } {
  const line = lines[at.row]
  const head = line.slice(0, at.col)
  const tail = line.slice(at.col)

  if (text.length === 1) {
    const next = [...lines]
    next[at.row] = head + text[0] + tail
    return {
      lines: next,
      cursor: { row: at.row, col: Math.max(0, at.col + text[0].length - 1) },
    }
  }

  const last = text[text.length - 1]
  const next = [
    ...lines.slice(0, at.row),
    head + text[0],
    ...text.slice(1, -1),
    last + tail,
    ...lines.slice(at.row + 1),
  ]
  return {
    lines: next,
    cursor: { row: at.row + text.length - 1, col: Math.max(0, last.length - 1) },
  }
}

/** atRow の直前に行を挿入する */
export function insertLinewise(lines: string[], atRow: number, text: string[]): string[] {
  return [...lines.slice(0, atRow), ...text, ...lines.slice(atRow)]
}

/** カーソル位置で行を 2 つに割る */
export function splitLine(lines: string[], at: Cursor): string[] {
  const line = lines[at.row]
  return [
    ...lines.slice(0, at.row),
    line.slice(0, at.col),
    line.slice(at.col),
    ...lines.slice(at.row + 1),
  ]
}
