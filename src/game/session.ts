import { applyKey, initialState, isAwaitingLiteral } from '../core/editor'
import type { EditorState } from '../core/types'
import { starsFor } from './scoring'
import type { Stars } from './scoring'
import type { LoadedStage } from '../stages/types'

/** 画面下部に出すキー履歴の保持件数 */
export const KEY_LOG_LIMIT = 40

export type Session = {
  stage: LoadedStage
  editor: EditorState
  keystrokes: number
  keyLog: string[]
  /** collect の各ターゲットを踏んだか。transform では空配列 */
  collected: boolean[]
  status: 'playing' | 'cleared'
  /** 直近に弾かれたキー。UI のフラッシュ表示に使う */
  rejected: string | null
  /** 弾かれた回数の累計。ステージ検証で使う */
  rejectedCount: number
  /**
   * クリアした瞬間に一度だけ算出される☆評価。playing の間は null。
   * 表示用と永続化用の両方がここを読むことで、両者の乖離を構造的に防ぐ
   */
  stars: Stars | null
}

export function startSession(stage: LoadedStage): Session {
  return {
    stage,
    editor: initialState(stage.buffer, { row: stage.cursor[0], col: stage.cursor[1] }),
    keystrokes: 0,
    keyLog: [],
    collected: stage.goal.type === 'collect' ? stage.goal.targets.map(() => false) : [],
    status: 'playing',
    rejected: null,
    rejectedCount: 0,
    stars: null,
  }
}

/**
 * cleared なセッションの☆評価を取り出す。
 * pressKey がクリアと同時に必ず算出するため、cleared なら非 null が保証される
 */
export function clearedStars(session: Session): Stars {
  if (session.stars === null) {
    throw new Error('cleared していないセッションから stars を取得しようとした')
  }
  return session.stars
}

/**
 * allowedKeys の検査は、ノーマルモードかつリテラル文字待ちでないときだけ行う。
 * そうしないと挿入モードで文字が打てず、f の対象文字も指定できない。
 */
function isKeyAllowed(session: Session, key: string): boolean {
  if (session.editor.mode === 'insert') return true
  if (isAwaitingLiteral(session.editor)) return true
  return session.stage.allowed.has(key)
}

function markCollected(session: Session, editor: EditorState): boolean[] {
  const { goal } = session.stage
  if (goal.type !== 'collect') return session.collected
  return goal.targets.map((target, index) => {
    if (session.collected[index]) return true
    return target[0] === editor.cursor.row && target[1] === editor.cursor.col
  })
}

function isGoalMet(session: Session): boolean {
  const { goal } = session.stage
  if (goal.type === 'collect') return session.collected.every(Boolean)
  const { lines } = session.editor
  return (
    lines.length === goal.expected.length &&
    lines.every((line, index) => line === goal.expected[index])
  )
}

export function pressKey(session: Session, key: string): Session {
  if (session.status === 'cleared') return session

  if (!isKeyAllowed(session, key)) {
    return { ...session, rejected: key, rejectedCount: session.rejectedCount + 1 }
  }

  const editor = applyKey(session.editor, key)
  const advanced: Session = {
    ...session,
    editor,
    keystrokes: session.keystrokes + 1,
    keyLog: [...session.keyLog, key].slice(-KEY_LOG_LIMIT),
    collected: markCollected(session, editor),
    rejected: null,
  }
  const cleared = isGoalMet(advanced)
  return {
    ...advanced,
    status: cleared ? 'cleared' : 'playing',
    stars: cleared ? starsFor(advanced.keystrokes, advanced.stage.par) : advanced.stars,
  }
}
