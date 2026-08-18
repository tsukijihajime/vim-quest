import { applyKey, initialState } from '../../src/core/editor'
import { parseKeys } from '../../src/core/keys'
import type { EditorState } from '../../src/core/types'

/** キー表記を順に流し込んだ後の状態を返す */
export function run(
  lines: string[],
  cursor: [number, number],
  notation: string,
): EditorState {
  let state = initialState(lines, { row: cursor[0], col: cursor[1] })
  for (const key of parseKeys(notation)) {
    state = applyKey(state, key)
  }
  return state
}

/** カーソルを [row, col] のタプルで取り出す */
export function pos(state: EditorState): [number, number] {
  return [state.cursor.row, state.cursor.col]
}
