import { clampCursor, normalizeLines } from './buffer'
import { applyNormalKey } from './keymap'
import type { Cursor, EditorState } from './types'

export { pushUndo } from './operators'

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

export function applyKey(state: EditorState, key: string): EditorState {
  return applyNormalKey(state, key)
}
