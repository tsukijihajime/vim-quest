import {
  clampCursor,
  deleteCharwise,
  deleteLinewise,
  firstNonBlankCol,
  insertCharwise,
  insertLinewise,
  sliceCharwise,
  sliceLinewise,
} from './buffer'
import type { Cursor, EditorState, MotionResult, Register } from './types'

export const UNDO_LIMIT = 200

export type OperatorRange =
  | { linewise: true; startRow: number; endRow: number }
  | { linewise: false; start: Cursor; end: Cursor }

function comparePos(a: Cursor, b: Cursor): number {
  if (a.row !== b.row) return a.row - b.row
  return a.col - b.col
}

/** ペンディングを解いた素の状態を返す */
export function reset(state: EditorState): EditorState {
  return { ...state, pending: null, count: null }
}

export function pushUndo(state: EditorState): EditorState {
  const stack = [...state.undoStack, { lines: state.lines, cursor: state.cursor }]
  return { ...state, undoStack: stack.slice(-UNDO_LIMIT) }
}

/**
 * カーソルとモーションからオペレータの対象範囲を求める。
 * charwise の範囲は [start, end) の半開区間。
 * 後方への inclusive モーションは exclusive と同じに扱う（仕様 4.2 参照）。
 */
export function rangeFor(cursor: Cursor, motion: MotionResult): OperatorRange {
  if (motion.kind === 'linewise') {
    return {
      linewise: true,
      startRow: Math.min(cursor.row, motion.cursor.row),
      endRow: Math.max(cursor.row, motion.cursor.row),
    }
  }
  const forward = comparePos(cursor, motion.cursor) <= 0
  const start = forward ? cursor : motion.cursor
  const end = forward ? motion.cursor : cursor
  if (motion.kind === 'inclusive' && forward) {
    return { linewise: false, start, end: { row: end.row, col: end.col + 1 } }
  }
  return { linewise: false, start, end }
}

export function applyCharwiseDelete(
  state: EditorState,
  start: Cursor,
  end: Cursor,
): EditorState {
  const pushed = pushUndo(state)
  const removed = sliceCharwise(state.lines, start, end)
  const lines = deleteCharwise(state.lines, start, end)
  const cursor = clampCursor(lines, start, 'normal')
  return {
    ...reset(pushed),
    lines,
    cursor,
    desiredCol: cursor.col,
    register: { text: removed, linewise: false },
  }
}

export function applyLinewiseDelete(
  state: EditorState,
  startRow: number,
  endRow: number,
): EditorState {
  const pushed = pushUndo(state)
  const removed = sliceLinewise(state.lines, startRow, endRow)
  const lines = deleteLinewise(state.lines, startRow, endRow)
  const row = Math.min(startRow, lines.length - 1)
  const cursor = { row, col: firstNonBlankCol(lines[row]) }
  return {
    ...reset(pushed),
    lines,
    cursor,
    desiredCol: cursor.col,
    register: { text: removed, linewise: true },
  }
}

/** x : カーソル位置から count 文字を消す。行末を越えない */
export function deleteChars(state: EditorState, count: number): EditorState {
  const line = state.lines[state.cursor.row]
  if (line.length === 0) return reset(state)
  const endCol = Math.min(line.length, state.cursor.col + count)
  return applyCharwiseDelete(state, state.cursor, { row: state.cursor.row, col: endCol })
}

export function applyCharwiseChange(
  state: EditorState,
  start: Cursor,
  end: Cursor,
): EditorState {
  const deleted = applyCharwiseDelete(state, start, end)
  const cursor = clampCursor(deleted.lines, start, 'insert')
  return { ...deleted, cursor, desiredCol: cursor.col, mode: 'insert' }
}

/** cc : 対象行の内容を空にするが、行そのものは 1 行残す */
export function applyLinewiseChange(
  state: EditorState,
  startRow: number,
  endRow: number,
): EditorState {
  const pushed = pushUndo(state)
  const removed = sliceLinewise(state.lines, startRow, endRow)
  const lines = [...state.lines.slice(0, startRow), '', ...state.lines.slice(endRow + 1)]
  return {
    ...reset(pushed),
    lines,
    cursor: { row: startRow, col: 0 },
    desiredCol: 0,
    mode: 'insert',
    register: { text: removed, linewise: true },
  }
}

export function applyCharwiseYank(
  state: EditorState,
  start: Cursor,
  end: Cursor,
): EditorState {
  const cursor = clampCursor(state.lines, start, 'normal')
  return {
    ...reset(state),
    cursor,
    desiredCol: cursor.col,
    register: { text: sliceCharwise(state.lines, start, end), linewise: false },
  }
}

export function applyLinewiseYank(
  state: EditorState,
  startRow: number,
  endRow: number,
): EditorState {
  const cursor = clampCursor(state.lines, { row: startRow, col: state.cursor.col }, 'normal')
  return {
    ...reset(state),
    cursor,
    desiredCol: cursor.col,
    register: { text: sliceLinewise(state.lines, startRow, endRow), linewise: true },
  }
}

/** レジスタの内容を count 回ぶんに引き伸ばす */
function repeatRegister(register: Register, count: number): string[] {
  if (count <= 1) return register.text
  if (register.linewise) {
    const out: string[] = []
    for (let i = 0; i < count; i += 1) out.push(...register.text)
    return out
  }
  if (register.text.length === 1) return [register.text[0].repeat(count)]
  const out: string[] = [...register.text]
  for (let i = 1; i < count; i += 1) {
    const tail = out.pop() ?? ''
    out.push(tail + register.text[0], ...register.text.slice(1))
  }
  return out
}

export function applyPaste(state: EditorState, after: boolean, count: number): EditorState {
  const text = repeatRegister(state.register, count)
  const pushed = pushUndo(state)

  if (state.register.linewise) {
    const atRow = after ? state.cursor.row + 1 : state.cursor.row
    const lines = insertLinewise(state.lines, atRow, text)
    const cursor = { row: atRow, col: firstNonBlankCol(lines[atRow]) }
    return { ...reset(pushed), lines, cursor, desiredCol: cursor.col }
  }

  const line = state.lines[state.cursor.row]
  const col = after ? Math.min(line.length, state.cursor.col + 1) : state.cursor.col
  const inserted = insertCharwise(state.lines, { row: state.cursor.row, col }, text)
  const cursor = clampCursor(inserted.lines, inserted.cursor, 'normal')
  return { ...reset(pushed), lines: inserted.lines, cursor, desiredCol: cursor.col }
}
