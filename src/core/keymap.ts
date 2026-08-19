import { clampCursor, firstNonBlankCol, insertLinewise } from './buffer'
import {
  changeWordEnd,
  charSearch,
  firstNonBlank,
  gotoFirstLine,
  gotoLastLine,
  gotoLine,
  lineEnd,
  lineStart,
  moveDown,
  moveLeft,
  moveRight,
  moveUp,
  paragraphBackward,
  paragraphForward,
  wordBackward,
  wordEnd,
  wordEndBackward,
  wordForward,
  wordForwardForOperator,
} from './motions'
import {
  applyCharwiseChange,
  applyCharwiseDelete,
  applyCharwiseYank,
  applyLinewiseChange,
  applyLinewiseDelete,
  applyLinewiseYank,
  applyPaste,
  applyReplace,
  applyUndo,
  deleteChars,
  pushUndo,
  rangeFor,
  reset,
} from './operators'
import type {
  CharSearchKind,
  Cursor,
  EditorState,
  MotionResult,
  OperatorName,
  Pending,
} from './types'

const DIGITS = '0123456789'

type MotionOutcome =
  | { type: 'motion'; result: MotionResult; keepDesiredCol: boolean }
  | { type: 'needsLiteral'; motion: CharSearchKind }
  | { type: 'needsG' }
  | { type: 'unknown' }
  /** モーションが失敗したのでコマンド全体を捨てる */
  | { type: 'abort' }

function motion(
  result: MotionResult,
  options: { keepDesiredCol?: boolean } = {},
): MotionOutcome {
  return {
    type: 'motion',
    result,
    keepDesiredCol: options.keepDesiredCol ?? false,
  }
}

function reverseSearch(kind: CharSearchKind): CharSearchKind {
  switch (kind) {
    case 'f':
      return 'F'
    case 'F':
      return 'f'
    case 't':
      return 'T'
    case 'T':
      return 't'
  }
}

function resolveMotion(
  state: EditorState,
  key: string,
  count: number,
  explicitCount: boolean,
): MotionOutcome {
  const { lines, cursor, desiredCol } = state
  switch (key) {
    case 'h':
      return motion(moveLeft(lines, cursor, count))
    case 'l':
      return motion(moveRight(lines, cursor, count))
    case 'j':
      return motion(moveDown(lines, cursor, count, desiredCol), { keepDesiredCol: true })
    case 'k':
      return motion(moveUp(lines, cursor, count, desiredCol), { keepDesiredCol: true })
    case '0':
      return motion(lineStart(cursor))
    case '^':
      return motion(firstNonBlank(lines, cursor))
    case '$':
      return motion(lineEnd(lines, cursor, count))
    case 'w':
      return motion(wordForward(lines, cursor, count, false))
    case 'W':
      return motion(wordForward(lines, cursor, count, true))
    case 'b':
      return motion(wordBackward(lines, cursor, count, false))
    case 'B':
      return motion(wordBackward(lines, cursor, count, true))
    case 'e':
      return motion(wordEnd(lines, cursor, count, false))
    case 'E':
      return motion(wordEnd(lines, cursor, count, true))
    case 'G':
      return motion(explicitCount ? gotoLine(lines, count - 1) : gotoLastLine(lines))
    case '{':
      return motion(paragraphBackward(lines, cursor, count))
    case '}':
      return motion(paragraphForward(lines, cursor, count))
    case 'f':
    case 'F':
    case 't':
    case 'T':
      return { type: 'needsLiteral', motion: key }
    case ';':
    case ',': {
      const last = state.lastCharSearch
      if (last === null) return { type: 'abort' }
      const kind = key === ';' ? last.kind : reverseSearch(last.kind)
      const result = charSearch(lines, cursor, kind, last.target, count, true)
      return result === null ? { type: 'abort' } : motion(result)
    }
    case 'g':
      return { type: 'needsG' }
    default:
      return { type: 'unknown' }
  }
}

function withCursor(
  state: EditorState,
  result: MotionResult,
  keepDesiredCol: boolean,
): EditorState {
  const cursor = clampCursor(state.lines, result.cursor, 'normal')
  return {
    ...reset(state),
    cursor,
    desiredCol: keepDesiredCol ? state.desiredCol : cursor.col,
  }
}

function applyOperator(
  state: EditorState,
  op: OperatorName,
  result: MotionResult,
): EditorState {
  const range = rangeFor(state.cursor, result)
  if (range.linewise) {
    if (op === 'd') return applyLinewiseDelete(state, range.startRow, range.endRow)
    if (op === 'c') return applyLinewiseChange(state, range.startRow, range.endRow)
    return applyLinewiseYank(state, range.startRow, range.endRow)
  }

  const end = range.end
  if (range.start.row === end.row && range.start.col === end.col) return reset(state)
  if (op === 'd') return applyCharwiseDelete(state, range.start, end)
  if (op === 'c') return applyCharwiseChange(state, range.start, end)
  return applyCharwiseYank(state, range.start, end)
}

function finishMotion(
  state: EditorState,
  op: OperatorName | null,
  result: MotionResult,
  keepDesiredCol: boolean,
): EditorState {
  if (op === null) return withCursor(state, result, keepDesiredCol)
  return applyOperator(state, op, result)
}

function resolveCharSearchPending(
  state: EditorState,
  pending: Extract<Pending, { kind: 'charSearch' }>,
  key: string,
): EditorState {
  if (key.length !== 1) return reset(state)
  const remembered: EditorState = {
    ...state,
    lastCharSearch: { kind: pending.motion, target: key },
  }
  const result = charSearch(
    state.lines,
    state.cursor,
    pending.motion,
    key,
    pending.count,
    false,
  )
  if (result === null) return reset(remembered)
  return finishMotion(remembered, pending.op, result, false)
}

function resolveGPending(
  state: EditorState,
  pending: Extract<Pending, { kind: 'g' }>,
  key: string,
): EditorState {
  if (key === 'g') {
    const result = pending.explicitCount
      ? gotoLine(state.lines, pending.count - 1)
      : gotoFirstLine(state.lines)
    return finishMotion(state, pending.op, result, false)
  }
  if (key === 'e') {
    const result = wordEndBackward(state.lines, state.cursor, pending.count)
    return finishMotion(state, pending.op, result, false)
  }
  return reset(state)
}

/**
 * 挿入モードへ入る。undo スナップショットはここで 1 回だけ積む。
 * lines を渡すと、その行配列に差し替えてから入る（o / O 用）。
 */
function enterInsert(state: EditorState, cursor: Cursor, lines?: string[]): EditorState {
  const pushed = pushUndo(state)
  const nextLines = lines ?? state.lines
  const clamped = clampCursor(nextLines, cursor, 'insert')
  return {
    ...reset(pushed),
    lines: nextLines,
    cursor: clamped,
    desiredCol: clamped.col,
    mode: 'insert',
  }
}

/** このタスクで解釈する単独コマンド。該当しなければ null */
function applySingleCommand(
  state: EditorState,
  key: string,
  count: number,
): EditorState | null {
  const { row, col } = state.cursor
  const line = state.lines[row]

  switch (key) {
    case 'x':
      return deleteChars(state, count)
    case 'i':
      return enterInsert(state, state.cursor)
    case 'a':
      return enterInsert(state, { row, col: col + 1 })
    case 'I':
      return enterInsert(state, { row, col: firstNonBlankCol(line) })
    case 'A':
      return enterInsert(state, { row, col: line.length })
    case 'o':
      return enterInsert(state, { row: row + 1, col: 0 }, insertLinewise(state.lines, row + 1, ['']))
    case 'O':
      return enterInsert(state, { row, col: 0 }, insertLinewise(state.lines, row, ['']))
    case 'p':
      return applyPaste(state, true, count)
    case 'P':
      return applyPaste(state, false, count)
    case 'r':
      return { ...state, count: null, pending: { kind: 'replace', count } }
    case 'u':
      return applyUndo(state)
    default:
      return null
  }
}

export function applyNormalKey(state: EditorState, key: string): EditorState {
  const pending = state.pending

  if (pending?.kind === 'charSearch') return resolveCharSearchPending(state, pending, key)
  if (pending?.kind === 'replace') {
    if (key.length !== 1) return reset(state)
    return applyReplace(state, key, pending.count)
  }
  if (pending?.kind === 'g') return resolveGPending(state, pending, key)

  // 数値プレフィックス。0 は回数入力中のときだけ数字になる
  if (DIGITS.includes(key) && !(key === '0' && state.count === null)) {
    return { ...state, count: (state.count ?? 0) * 10 + Number(key) }
  }

  const typedCount = state.count
  const count = typedCount ?? 1

  if (key === 'd' || key === 'c' || key === 'y') {
    if (pending?.kind === 'operator') {
      if (pending.op !== key) return reset(state)
      const rows = pending.opCount * count
      const endRow = Math.min(state.lines.length - 1, state.cursor.row + rows - 1)
      if (key === 'd') return applyLinewiseDelete(state, state.cursor.row, endRow)
      if (key === 'c') return applyLinewiseChange(state, state.cursor.row, endRow)
      return applyLinewiseYank(state, state.cursor.row, endRow)
    }
    return { ...state, count: null, pending: { kind: 'operator', op: key, opCount: count } }
  }

  if (pending?.kind !== 'operator') {
    const single = applySingleCommand(state, key, count)
    if (single !== null) return single
  }

  const op: OperatorName | null = pending?.kind === 'operator' ? pending.op : null
  const opCount = pending?.kind === 'operator' ? pending.opCount : 1
  const motionCount = opCount * count
  const explicitCount = typedCount !== null || opCount !== 1

  // cw / cW の特例: 非空白の上では「現在の単語の末尾まで」を対象にする。
  // 下の w / W 振り替えより前に置くこと。順序が逆だと cw が捕まらない。
  const onNonBlank = /\S/.test(state.lines[state.cursor.row][state.cursor.col] ?? '')
  if (op === 'c' && onNonBlank && (key === 'w' || key === 'W')) {
    const result = changeWordEnd(state.lines, state.cursor, motionCount, key === 'W')
    return finishMotion(state, op, result, false)
  }

  // オペレータが立っているときの w / W は最後の 1 歩だけを特別扱いする
  // 専用モーションへ振り替える（cw → ce と同じ位置）
  if (op !== null && (key === 'w' || key === 'W')) {
    const result = wordForwardForOperator(state.lines, state.cursor, motionCount, key === 'W')
    return finishMotion(state, op, result, false)
  }

  const outcome = resolveMotion(state, key, motionCount, explicitCount)
  switch (outcome.type) {
    case 'motion':
      return finishMotion(state, op, outcome.result, outcome.keepDesiredCol)
    case 'needsLiteral':
      return {
        ...state,
        count: null,
        pending: { kind: 'charSearch', motion: outcome.motion, count: motionCount, op },
      }
    case 'needsG':
      return {
        ...state,
        count: null,
        pending: { kind: 'g', count: motionCount, explicitCount, op },
      }
    case 'abort':
    case 'unknown':
      return reset(state)
  }
}
