import { describe, expect, it } from 'vitest'
import { loadStages } from '../../src/stages/loader'
import type { Stage } from '../../src/stages/types'

function stage(overrides: Partial<Stage> = {}): Stage {
  return {
    id: 's1',
    title: '基本移動',
    lesson: 'hjkl で動く',
    allowedKeys: 'hjkl',
    buffer: ['...', '...'],
    cursor: [0, 0],
    goal: { type: 'collect', targets: [[1, 2]] },
    solution: 'jll',
    ...overrides,
  }
}

describe('loadStages', () => {
  it('正しいステージを読み込む', () => {
    const { stages, invalid } = loadStages([stage()])
    expect(invalid).toEqual([])
    expect(stages).toHaveLength(1)
    expect(stages[0].id).toBe('s1')
  })

  it('par を solution のキー数から導出する', () => {
    const { stages } = loadStages([stage({ solution: 'aa<Esc>A!<Esc>' })])
    expect(stages[0].par).toBe(6)
  })

  it('allowedKeys を Set に展開する', () => {
    const { stages } = loadStages([stage({ allowedKeys: 'hj<Esc>' })])
    expect(stages[0].allowed).toEqual(new Set(['h', 'j', 'Escape']))
  })

  it('solutionKeys を配列に展開する', () => {
    const { stages } = loadStages([stage({ solution: 'j<Space>' })])
    expect(stages[0].solutionKeys).toEqual(['j', ' '])
  })

  it('配列でない入力は invalid ひとつにまとめる', () => {
    const { stages, invalid } = loadStages({ nope: true })
    expect(stages).toEqual([])
    expect(invalid).toHaveLength(1)
  })

  it('必須フィールドの欠落を弾く', () => {
    const broken = { ...stage() } as Record<string, unknown>
    delete broken.title
    const { stages, invalid } = loadStages([broken])
    expect(stages).toEqual([])
    expect(invalid[0].reason).toMatch(/title/)
  })

  it('空の buffer を弾く', () => {
    const { invalid } = loadStages([stage({ buffer: [] })])
    expect(invalid[0].reason).toMatch(/buffer/)
  })

  it('範囲外の cursor を弾く', () => {
    const { invalid } = loadStages([stage({ cursor: [5, 0] })])
    expect(invalid[0].reason).toMatch(/cursor/)
  })

  it('範囲外の target を弾く', () => {
    const { invalid } = loadStages([
      stage({ goal: { type: 'collect', targets: [[9, 0]] } }),
    ])
    expect(invalid[0].reason).toMatch(/targets/)
  })

  it('初期カーソルと重なる target を弾く', () => {
    const { invalid } = loadStages([
      stage({ cursor: [0, 1], goal: { type: 'collect', targets: [[0, 1]] } }),
    ])
    expect(invalid[0].reason).toMatch(/初期カーソル/)
  })

  it('空の targets を弾く', () => {
    const { invalid } = loadStages([stage({ goal: { type: 'collect', targets: [] } })])
    expect(invalid[0].reason).toMatch(/targets/)
  })

  it('空の expected を弾く', () => {
    const { invalid } = loadStages([stage({ goal: { type: 'transform', expected: [] } })])
    expect(invalid[0].reason).toMatch(/expected/)
  })

  it('空の solution を弾く', () => {
    const { invalid } = loadStages([stage({ solution: '' })])
    expect(invalid[0].reason).toMatch(/solution/)
  })

  it('解析できないキー表記を弾く', () => {
    const { invalid } = loadStages([stage({ solution: '<Nope>' })])
    expect(invalid[0].reason).toMatch(/キートークン/)
  })

  it('正しいステージと不正なステージを混ぜても正しい方は読める', () => {
    const { stages, invalid } = loadStages([stage(), stage({ id: 's2', buffer: [] })])
    expect(stages).toHaveLength(1)
    expect(invalid).toHaveLength(1)
    expect(invalid[0].id).toBe('s2')
  })
})
