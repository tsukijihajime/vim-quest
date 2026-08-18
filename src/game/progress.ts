import type { LoadedStage } from '../stages/types'

export const STORAGE_KEY = 'vimquest:progress'

export type ClearRecord = { stars: number; bestKeystrokes: number }

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
    if (typeof record.stars !== 'number' || typeof record.bestKeystrokes !== 'number') continue
    cleared[id] = { stars: record.stars, bestKeystrokes: record.bestKeystrokes }
  }
  return { version: 1, cleared }
}

export function recordClear(
  progress: Progress,
  stageId: string,
  stars: number,
  keystrokes: number,
): Progress {
  const existing = progress.cleared[stageId]
  const next: ClearRecord =
    existing === undefined
      ? { stars, bestKeystrokes: keystrokes }
      : {
          stars: Math.max(existing.stars, stars),
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
