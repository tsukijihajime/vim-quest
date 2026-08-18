import type { Stars } from './scoring'
import type { LoadedStage } from '../stages/types'

export const STORAGE_KEY = 'vimquest:progress'

export type ClearRecord = { stars: Stars; bestKeystrokes: number }

function isStars(value: unknown): value is Stars {
  return value === 1 || value === 2 || value === 3
}

function maxStars(a: Stars, b: Stars): Stars {
  return (a >= b ? a : b) as Stars
}

export type Progress = { version: 1; cleared: Record<string, ClearRecord> }

export function emptyProgress(): Progress {
  return { version: 1, cleared: {} }
}

export function parseProgress(raw: string | null): Progress {
  if (raw === null) return emptyProgress()
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return emptyProgress()
  }
  if (typeof parsed !== 'object' || parsed === null) return emptyProgress()

  const root = parsed as Record<string, unknown>
  if (root.version !== 1) return emptyProgress()
  if (typeof root.cleared !== 'object' || root.cleared === null) return emptyProgress()

  const cleared: Record<string, ClearRecord> = {}
  for (const [id, value] of Object.entries(root.cleared as Record<string, unknown>)) {
    if (typeof value !== 'object' || value === null) continue
    const record = value as Record<string, unknown>
    // stars は 1〜3 の整数でなければならない。改ざんされた値（例: 4）を
    // 通すと `'☆'.repeat(3 - stars)` が負数で RangeError を投げ、
    // 選択画面全体が白紙になる（信頼境界での範囲検証）
    if (!isStars(record.stars) || typeof record.bestKeystrokes !== 'number') continue
    cleared[id] = { stars: record.stars, bestKeystrokes: record.bestKeystrokes }
  }
  return { version: 1, cleared }
}

export function recordClear(
  progress: Progress,
  stageId: string,
  stars: Stars,
  keystrokes: number,
): Progress {
  const existing = progress.cleared[stageId]
  const next: ClearRecord =
    existing === undefined
      ? { stars, bestKeystrokes: keystrokes }
      : {
          stars: maxStars(existing.stars, stars),
          bestKeystrokes: Math.min(existing.bestKeystrokes, keystrokes),
        }
  return { version: 1, cleared: { ...progress.cleared, [stageId]: next } }
}

export function isUnlocked(
  progress: Progress,
  stages: LoadedStage[],
  index: number,
): boolean {
  if (index <= 0) return true
  const previous = stages[index - 1]
  return previous !== undefined && progress.cleared[previous.id] !== undefined
}

function defaultStorage(): Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage
  } catch {
    return undefined
  }
}

export function loadProgress(storage: Storage | undefined = defaultStorage()): Progress {
  if (storage === undefined) return emptyProgress()
  try {
    return parseProgress(storage.getItem(STORAGE_KEY))
  } catch {
    return emptyProgress()
  }
}

export function saveProgress(
  progress: Progress,
  storage: Storage | undefined = defaultStorage(),
): void {
  if (storage === undefined) return
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(progress))
  } catch {
    // 保存できなくてもゲームは続行する
  }
}
