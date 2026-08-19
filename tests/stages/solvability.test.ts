import { describe, expect, it } from 'vitest'
import { pressKey, startSession } from '../../src/game/session'
import { loadStages } from '../../src/stages/loader'
import stagesJson from '../../src/stages/stages.json'

const { stages, invalid } = loadStages(stagesJson)

describe('stages.json 全体', () => {
  it('不正なステージがない', () => {
    expect(invalid).toEqual([])
  })

  it('18 ステージある', () => {
    expect(stages).toHaveLength(18)
  })

  it('id が重複していない', () => {
    expect(new Set(stages.map((stage) => stage.id)).size).toBe(stages.length)
  })

  it('allowedKeys が累積で増えていく', () => {
    for (let i = 1; i < stages.length; i += 1) {
      const previous = stages[i - 1].allowed
      const current = stages[i].allowed
      const lost = [...previous].filter((key) => !current.has(key))
      expect(lost, `${stages[i].id} で ${lost.join(',')} が失われている`).toEqual([])
    }
  })
})

describe.each(stages.map((stage) => [stage.id, stage] as const))('%s', (_id, stage) => {
  const played = stage.solutionKeys.reduce(pressKey, startSession(stage))

  it('想定解でクリアできる', () => {
    expect(played.status).toBe('cleared')
  })

  it('allowedKeys に弾かれたキーがない', () => {
    expect(played.rejectedCount).toBe(0)
  })

  it('消費キー数が par と一致する', () => {
    // 一致しないなら solution に無駄打ちがあるか、途中でクリアしている
    expect(played.keystrokes).toBe(stage.par)
  })
})
