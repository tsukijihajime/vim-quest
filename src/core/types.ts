export type Cursor = { row: number; col: number }

export type Mode = 'normal' | 'insert'

export type MotionKind = 'exclusive' | 'inclusive' | 'linewise'

export type MotionResult = { cursor: Cursor; kind: MotionKind }

export type OperatorName = 'd' | 'c' | 'y'

export type Register = { text: string[]; linewise: boolean }

export type CharSearchKind = 'f' | 'F' | 't' | 'T'

export type LastCharSearch = { kind: CharSearchKind; target: string }

/**
 * リテラル文字や後続キーを待っている状態。
 * `count` はオペレータの回数とモーションの回数を掛け合わせた後の値を入れる
 * （`3dw` と `d3w` を同じ状態に落とすため）。
 */
export type Pending =
  | { kind: 'operator'; op: OperatorName; opCount: number }
  | { kind: 'charSearch'; motion: CharSearchKind; count: number; op: OperatorName | null }
  | { kind: 'replace'; count: number }
  | { kind: 'g'; count: number; explicitCount: boolean; op: OperatorName | null }

export type Snapshot = { lines: string[]; cursor: Cursor }

export type EditorState = {
  lines: string[]
  cursor: Cursor
  mode: Mode
  register: Register
  pending: Pending | null
  /** 入力途中の数値プレフィックス。未入力なら null */
  count: number | null
  /** j / k が保持する望ましい列 */
  desiredCol: number
  lastCharSearch: LastCharSearch | null
  undoStack: Snapshot[]
}
