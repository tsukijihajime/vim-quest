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

  it('allowedKeys の解析エラーに allowedKeys: を前置する', () => {
    expect(() => loadStages([stage({ allowedKeys: '<Nope>' })])).not.toThrow()
    const { invalid } = loadStages([stage({ allowedKeys: '<Nope>' })])
    expect(invalid[0].reason).toMatch(/^allowedKeys: /)
    expect(invalid[0].reason).toMatch(/キートークン/)
  })

  it('solution の解析エラーに solution: を前置する', () => {
    expect(() => loadStages([stage({ solution: '<Nope>' })])).not.toThrow()
    const { invalid } = loadStages([stage({ solution: '<Nope>' })])
    expect(invalid[0].reason).toMatch(/^solution: /)
    expect(invalid[0].reason).toMatch(/キートークン/)
  })

  it('allowedKeys の閉じていない山括弧を例外を投げずに弾く', () => {
    expect(() => loadStages([stage({ allowedKeys: '<Esc' })])).not.toThrow()
    const { invalid } = loadStages([stage({ allowedKeys: '<Esc' })])
    expect(invalid[0].reason).toMatch(/allowedKeys/)
    expect(invalid[0].reason).toMatch(/山括弧/)
  })

  it('solution の閉じていない山括弧を例外を投げずに弾く', () => {
    expect(() => loadStages([stage({ solution: '<Esc' })])).not.toThrow()
    const { invalid } = loadStages([stage({ solution: '<Esc' })])
    expect(invalid[0].reason).toMatch(/solution/)
    expect(invalid[0].reason).toMatch(/山括弧/)
  })

  it('ルートが null でも例外を投げず invalid を返す', () => {
    expect(() => loadStages(null)).not.toThrow()
    const { stages, invalid } = loadStages(null)
    expect(stages).toEqual([])
    expect(invalid).toHaveLength(1)
  })

  it('ルートが文字列でも例外を投げず invalid を返す', () => {
    expect(() => loadStages('not an array')).not.toThrow()
    const { stages, invalid } = loadStages('not an array')
    expect(stages).toEqual([])
    expect(invalid).toHaveLength(1)
  })

  it('buffer が配列でなくても例外を投げず buffer を指す理由を返す', () => {
    const broken = { ...stage(), buffer: 'not-an-array' } as Record<string, unknown>
    expect(() => loadStages([broken])).not.toThrow()
    const { invalid } = loadStages([broken])
    expect(invalid[0].reason).toMatch(/buffer/)
  })

  it('cursor の要素数が 2 でなくても例外を投げず cursor を指す理由を返す', () => {
    const broken = { ...stage(), cursor: [0, 0, 0] } as Record<string, unknown>
    expect(() => loadStages([broken])).not.toThrow()
    const { invalid } = loadStages([broken])
    expect(invalid[0].reason).toMatch(/cursor/)
  })

  it('targets の要素の座標の要素数が 2 でなくても例外を投げず targets を指す理由を返す', () => {
    const broken = {
      ...stage(),
      goal: { type: 'collect', targets: [[0, 0, 0]] },
    } as Record<string, unknown>
    expect(() => loadStages([broken])).not.toThrow()
    const { invalid } = loadStages([broken])
    expect(invalid[0].reason).toMatch(/targets/)
  })

  it('未知の goal.type でも例外を投げず goal を指す理由を返す', () => {
    const broken = { ...stage(), goal: { type: 'nope' } } as Record<string, unknown>
    expect(() => loadStages([broken])).not.toThrow()
    const { invalid } = loadStages([broken])
    expect(invalid[0].reason).toMatch(/goal/)
  })

  it('重複した id を 2 件目以降 invalid に回す', () => {
    const { stages, invalid } = loadStages([stage(), stage({ title: '別タイトル' })])
    expect(stages).toHaveLength(1)
    expect(invalid).toHaveLength(1)
    expect(invalid[0].reason).toMatch(/重複/)
    expect(invalid[0].reason).toMatch(/s1/)
  })
})
