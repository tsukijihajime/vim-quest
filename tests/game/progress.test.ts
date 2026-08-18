import { beforeEach, describe, expect, it } from 'vitest'
import {
  emptyProgress,
  isUnlocked,
  loadProgress,
  parseProgress,
  recordClear,
  saveProgress,
  STORAGE_KEY,
} from '../../src/game/progress'
import { makeStage } from '../stages/fixtures'

/** テスト用のメモリ上の Storage */
function memoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => void map.delete(key),
    setItem: (key: string, value: string) => void map.set(key, value),
  }
}

/** setItem が必ず失敗する Storage */
function brokenStorage(): Storage {
  const base = memoryStorage()
  return {
    ...base,
    getItem: () => {
      throw new Error('読めない')
    },
    setItem: () => {
      throw new Error('書けない')
    },
  }
}

let storage: Storage

beforeEach(() => {
  storage = memoryStorage()
})

describe('parseProgress', () => {
  it('null なら空の進行を返す', () => {
    expect(parseProgress(null)).toEqual(emptyProgress())
  })

  it('壊れた JSON なら空の進行を返す', () => {
    expect(parseProgress('{{{')).toEqual(emptyProgress())
  })

  it('version が違えば空の進行を返す', () => {
    expect(parseProgress(JSON.stringify({ version: 99, cleared: {} }))).toEqual(emptyProgress())
  })

  it('型の合わない記録は捨てる', () => {
    const raw = JSON.stringify({ version: 1, cleared: { s1: { stars: 'x' }, s2: { stars: 3, bestKeystrokes: 7 } } })
    expect(parseProgress(raw).cleared).toEqual({ s2: { stars: 3, bestKeystrokes: 7 } })
  })
})

describe('recordClear', () => {
  it('初回のクリアを記録する', () => {
    const progress = recordClear(emptyProgress(), 's1', 2, 15)
    expect(progress.cleared.s1).toEqual({ stars: 2, bestKeystrokes: 15 })
  })

  it('星は高い方、キー数は少ない方を残す', () => {
    const first = recordClear(emptyProgress(), 's1', 2, 15)
    const second = recordClear(first, 's1', 3, 10)
    expect(second.cleared.s1).toEqual({ stars: 3, bestKeystrokes: 10 })
  })

  it('悪い記録では上書きしない', () => {
    const first = recordClear(emptyProgress(), 's1', 3, 10)
    const second = recordClear(first, 's1', 1, 30)
    expect(second.cleared.s1).toEqual({ stars: 3, bestKeystrokes: 10 })
  })

  it('元の進行を破壊しない', () => {
    const first = emptyProgress()
    recordClear(first, 's1', 3, 10)
    expect(first.cleared).toEqual({})
  })
})

describe('isUnlocked', () => {
  const stages = [makeStage({ id: 'a' }), makeStage({ id: 'b' }), makeStage({ id: 'c' })]

  it('最初のステージは常に解放されている', () => {
    expect(isUnlocked(emptyProgress(), stages, 0)).toBe(true)
  })

  it('前をクリアしていなければ解放されない', () => {
    expect(isUnlocked(emptyProgress(), stages, 1)).toBe(false)
  })

  it('前をクリアしていれば解放される', () => {
    const progress = recordClear(emptyProgress(), 'a', 3, 3)
    expect(isUnlocked(progress, stages, 1)).toBe(true)
    expect(isUnlocked(progress, stages, 2)).toBe(false)
  })
})

describe('loadProgress / saveProgress', () => {
  it('保存した内容を読み戻せる', () => {
    const progress = recordClear(emptyProgress(), 's1', 3, 5)
    saveProgress(progress, storage)
    expect(storage.getItem(STORAGE_KEY)).not.toBeNull()
    expect(loadProgress(storage)).toEqual(progress)
  })

  it('storage が使えなくても例外を投げない', () => {
    const broken = brokenStorage()
    expect(() => saveProgress(emptyProgress(), broken)).not.toThrow()
    expect(loadProgress(broken)).toEqual(emptyProgress())
  })
})
