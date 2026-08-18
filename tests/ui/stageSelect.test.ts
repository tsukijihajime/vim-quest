// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { emptyProgress, parseProgress, recordClear } from '../../src/game/progress'
import { renderStageSelect, stageSelectHtml } from '../../src/ui/stageSelect'
import { makeStage } from '../stages/fixtures'

const stages = [
  makeStage({ id: 'a', title: '1. 最初' }),
  makeStage({ id: 'b', title: '2. 次' }),
  makeStage({ id: 'c', title: '3. その次' }),
]

describe('stageSelectHtml', () => {
  it('全ステージのタイトルを出す', () => {
    const html = stageSelectHtml(stages, emptyProgress())
    expect(html).toContain('1. 最初')
    expect(html).toContain('2. 次')
    expect(html).toContain('3. その次')
  })

  it('最初のステージだけ解放されている', () => {
    const html = stageSelectHtml(stages, emptyProgress())
    expect(html.match(/class="card unlocked"/g)).toHaveLength(1)
    expect(html.match(/class="card locked"/g)).toHaveLength(2)
  })

  it('クリアすると次が解放される', () => {
    const html = stageSelectHtml(stages, recordClear(emptyProgress(), 'a', 3, 3))
    expect(html.match(/class="card unlocked"/g)).toHaveLength(2)
  })

  it('解放済みのステージに data-stage-id を付ける', () => {
    expect(stageSelectHtml(stages, emptyProgress())).toContain('data-stage-id="a"')
  })

  it('未解放のステージには data-stage-id を付けない', () => {
    expect(stageSelectHtml(stages, emptyProgress())).not.toContain('data-stage-id="b"')
  })

  it('クリア済みのステージに星と最短キー数を出す', () => {
    const html = stageSelectHtml(stages, recordClear(emptyProgress(), 'a', 2, 7))
    expect(html).toContain('★★☆')
    expect(html).toContain('最短 7 キー')
  })

  it('未クリアのステージには星を出さない', () => {
    expect(stageSelectHtml(stages, emptyProgress())).not.toContain('★')
  })

  it('改ざんされた stars（範囲外）の localStorage 値を経由しても描画が落ちない', () => {
    // localStorage を直接書き換えて stars: 4 を仕込んだシナリオの再現。
    // parseProgress が信頼境界で弾くので、ここに来る時点で不正値は
    // 既に取り除かれており '☆'.repeat(負数) の RangeError は起きない
    const tampered = parseProgress(
      JSON.stringify({ version: 1, cleared: { a: { stars: 4, bestKeystrokes: 1 } } }),
    )
    expect(() => stageSelectHtml(stages, tampered)).not.toThrow()
  })

  it('タイトルの HTML 特殊文字を escape する', () => {
    const html = stageSelectHtml([makeStage({ id: 'x', title: '<b>' })], emptyProgress())
    expect(html).toContain('&lt;b&gt;')
    expect(html).not.toContain('<b>')
  })
})

describe('renderStageSelect', () => {
  it('解放済みのカードをクリックすると onPick が呼ばれる', () => {
    const container = document.createElement('div')
    const onPick = vi.fn()
    renderStageSelect(container, stages, emptyProgress(), onPick)

    const card = container.querySelector<HTMLButtonElement>('[data-stage-id="a"]')
    expect(card).not.toBeNull()
    card?.click()

    expect(onPick).toHaveBeenCalledWith(stages[0])
  })

  it('未解放のカードは disabled でクリックしても何も起きない', () => {
    const container = document.createElement('div')
    const onPick = vi.fn()
    renderStageSelect(container, stages, emptyProgress(), onPick)

    const locked = container.querySelectorAll<HTMLButtonElement>('.card.locked')
    expect(locked).toHaveLength(2)
    locked.forEach((button) => expect(button.disabled).toBe(true))
  })
})
