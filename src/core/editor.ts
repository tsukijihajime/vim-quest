import {
  clampCursor,
  deleteCharwise,
  insertCharwise,
  normalizeLines,
  splitLine,
} from './buffer'
import { applyNormalKey } from './keymap'
import type { Cursor, EditorState } from './types'

export function initialState(lines: string[], cursor: Cursor): EditorState {
  const normalized = normalizeLines([...lines])
  const clamped = clampCursor(normalized, cursor, 'normal')
  return {
    lines: normalized,
    cursor: clamped,
    mode: 'normal',
    register: { text: [''], linewise: false },
    pending: null,
    count: null,
    desiredCol: clamped.col,
    lastCharSearch: null,
    undoStack: [],
  }
}

/**
 * リテラル文字（f の対象文字、r の置換文字）を待っているか。
 * game 層が allowedKeys の検査を飛ばす判断に使う。
 */
export function isAwaitingLiteral(state: EditorState): boolean {
  return state.pending?.kind === 'charSearch' || state.pending?.kind === 'replace'
}

function applyInsertKey(state: EditorState, key: string): EditorState {
  if (key === 'Escape') {
    const cursor = clampCursor(
      state.lines,
      { row: state.cursor.row, col: Math.max(0, state.cursor.col - 1) },
      'normal',
    )
    return {
      ...state,
      mode: 'normal',
      cursor,
      desiredCol: cursor.col,
      pending: null,
      count: null,
    }
  }

  if (key === 'Enter') {
    const lines = splitLine(state.lines, state.cursor)
    const cursor = { row: state.cursor.row + 1, col: 0 }
    return { ...state, lines, cursor, desiredCol: 0 }
  }

  if (key === 'Backspace') {
    const { row, col } = state.cursor
    if (col > 0) {
      const lines = deleteCharwise(state.lines, { row, col: col - 1 }, { row, col })
      return { ...state, lines, cursor: { row, col: col - 1 }, desiredCol: col - 1 }
    }
    if (row === 0) return state
    const prevLen = state.lines[row - 1].length
    const lines = deleteCharwise(state.lines, { row: row - 1, col: prevLen }, { row, col: 0 })
    return { ...state, lines, cursor: { row: row - 1, col: prevLen }, desiredCol: prevLen }
  }

  // 印字可能文字以外（矢印キー等）は無視する
  if (key.length !== 1) return state

  const inserted = insertCharwise(state.lines, state.cursor, [key])
  const cursor = { row: inserted.cursor.row, col: inserted.cursor.col + 1 }
  return { ...state, lines: inserted.lines, cursor, desiredCol: cursor.col }
}

export function applyKey(state: EditorState, key: string): EditorState {
  if (state.mode === 'insert') return applyInsertKey(state, key)
  return applyNormalKey(state, key)
}
