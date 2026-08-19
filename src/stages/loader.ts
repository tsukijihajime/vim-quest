import { parseKeys } from '../core/keys'
import type { Goal, InvalidStage, LoadedStage, Stage } from './types'

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isCoord(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    Number.isInteger(value[0]) &&
    Number.isInteger(value[1])
  )
}

function inBounds(buffer: string[], coord: [number, number]): boolean {
  const [row, col] = coord
  if (row < 0 || row >= buffer.length) return false
  return col >= 0 && col <= Math.max(0, buffer[row].length - 1)
}

/** parseKeys を呼び、失敗時はどのフィールドが原因かを理由に前置する */
function parseKeysField(fieldName: string, notation: string): string[] | string {
  try {
    return parseKeys(notation)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'キー表記を解析できない'
    return `${fieldName}: ${message}`
  }
}

function validateGoal(raw: unknown, buffer: string[], cursor: [number, number]): Goal | string {
  if (typeof raw !== 'object' || raw === null) return 'goal がオブジェクトでない'
  const goal = raw as Record<string, unknown>

  if (goal.type === 'collect') {
    const targets = goal.targets
    if (!Array.isArray(targets) || targets.length === 0) {
      return 'goal.targets が空である'
    }
    for (const target of targets) {
      if (!isCoord(target)) return 'goal.targets に座標でない要素がある'
      if (!inBounds(buffer, target)) return `goal.targets が範囲外である: ${String(target)}`
      if (target[0] === cursor[0] && target[1] === cursor[1]) {
        return 'goal.targets が初期カーソル位置と重なっている'
      }
    }
    return { type: 'collect', targets: targets as [number, number][] }
  }

  if (goal.type === 'transform') {
    if (!isStringArray(goal.expected) || goal.expected.length === 0) {
      return 'goal.expected が空である'
    }
    return { type: 'transform', expected: goal.expected }
  }

  return 'goal.type が collect でも transform でもない'
}

function validateStage(raw: unknown): LoadedStage | string {
  if (typeof raw !== 'object' || raw === null) return 'ステージがオブジェクトでない'
  const s = raw as Record<string, unknown>

  for (const field of ['id', 'title', 'lesson', 'allowedKeys', 'solution']) {
    if (typeof s[field] !== 'string') return `${field} が文字列でない`
  }
  if (!isStringArray(s.buffer) || s.buffer.length === 0) return 'buffer が空である'
  if (!isCoord(s.cursor)) return 'cursor が座標でない'

  const buffer = s.buffer
  const cursor = s.cursor
  if (!inBounds(buffer, cursor)) return 'cursor が範囲外である'

  const goal = validateGoal(s.goal, buffer, cursor)
  if (typeof goal === 'string') return goal

  const allowedKeysResult = parseKeysField('allowedKeys', s.allowedKeys as string)
  if (typeof allowedKeysResult === 'string') return allowedKeysResult
  const allowed = new Set(allowedKeysResult)

  const solutionResult = parseKeysField('solution', s.solution as string)
  if (typeof solutionResult === 'string') return solutionResult
  const solutionKeys = solutionResult
  if (solutionKeys.length === 0) return 'solution が空である'

  const stage: Stage = {
    id: s.id as string,
    title: s.title as string,
    lesson: s.lesson as string,
    allowedKeys: s.allowedKeys as string,
    buffer,
    cursor,
    goal,
    solution: s.solution as string,
  }
  return { ...stage, par: solutionKeys.length, allowed, solutionKeys }
}

export function loadStages(raw: unknown): {
  stages: LoadedStage[]
  invalid: InvalidStage[]
} {
  if (!Array.isArray(raw)) {
    return { stages: [], invalid: [{ id: '(root)', reason: 'ステージ一覧が配列でない' }] }
  }

  const stages: LoadedStage[] = []
  const invalid: InvalidStage[] = []
  const seenIds = new Set<string>()
  raw.forEach((item, index) => {
    const result = validateStage(item)
    if (typeof result === 'string') {
      const id =
        typeof item === 'object' && item !== null && typeof (item as { id?: unknown }).id === 'string'
          ? (item as { id: string }).id
          : `(index ${index})`
      invalid.push({ id, reason: result })
      return
    }
    if (seenIds.has(result.id)) {
      invalid.push({ id: result.id, reason: `id が重複している: ${result.id}` })
      return
    }
    seenIds.add(result.id)
    stages.push(result)
  })
  return { stages, invalid }
}
