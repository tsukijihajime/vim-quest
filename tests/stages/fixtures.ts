import { loadStages } from '../../src/stages/loader'
import type { LoadedStage, Stage } from '../../src/stages/types'

/** テスト用に 1 件だけ LoadedStage を作る。検証を通らなければ例外にする */
export function makeStage(overrides: Partial<Stage> = {}): LoadedStage {
  const base: Stage = {
    id: 's1',
    title: 'テスト',
    lesson: 'テスト用',
    allowedKeys: 'hjkl',
    buffer: ['abc', 'def'],
    cursor: [0, 0],
    goal: { type: 'collect', targets: [[1, 2]] },
    solution: 'jll',
    ...overrides,
  }
  const { stages, invalid } = loadStages([base])
  if (stages.length !== 1) {
    throw new Error(`テスト用ステージが不正である: ${invalid[0]?.reason ?? '理由不明'}`)
  }
  return stages[0]
}
