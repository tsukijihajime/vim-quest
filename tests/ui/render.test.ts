// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { parseKeys } from '../../src/core/keys'
import { pressKey, startSession } from '../../src/game/session'
import type { Session } from '../../src/game/session'
import { bufferHtml, clearedHtml, escapeHtml, hudHtml, renderPlay } from '../../src/ui/render'
import { makeStage } from '../stages/fixtures'

function play(session: Session, notation: string): Session {
  let current = session
  for (const key of parseKeys(notation)) current = pressKey(current, key)
  return current
}

describe('escapeHtml', () => {
  it('HTML 特殊文字を実体参照にする', () => {
    expect(escapeHtml('<a & "b">')).toBe('&lt;a &amp; &quot;b&quot;&gt;')
  })
})

describe('bufferHtml', () => {
  it('1 文字ごとにセルを作る', () => {
    const html = bufferHtml(
      startSession(
        makeStage({ buffer: ['ab'], cursor: [0, 0], goal: { type: 'collect', targets: [[0, 1]] } }),
      ),
    )
    expect(html.match(/class="cell/g)).toHaveLength(2)
  })

  it('カーソル位置にノーマルモードの印を付ける', () => {
    const html = bufferHtml(
      startSession(
        makeStage({ buffer: ['ab'], cursor: [0, 1], goal: { type: 'collect', targets: [[0, 0]] } }),
      ),
    )
    expect(html).toContain('cursor-normal')
    expect(html).not.toContain('cursor-insert')
  })

  it('挿入モードでは印が変わる', () => {
    const stage = makeStage({
      allowedKeys: 'i',
      buffer: ['ab'],
      cursor: [0, 0],
      goal: { type: 'transform', expected: ['xab'] },
      solution: 'ix',
    })
    expect(bufferHtml(play(startSession(stage), 'i'))).toContain('cursor-insert')
  })

  it('挿入モードで行末の次にいてもカーソルを描ける', () => {
    const stage = makeStage({
      allowedKeys: 'A',
      buffer: ['ab'],
      cursor: [0, 0],
      goal: { type: 'transform', expected: ['abx'] },
      solution: 'Ax',
    })
    const html = bufferHtml(play(startSession(stage), 'A'))
    expect(html.match(/class="cell/g)).toHaveLength(3)
    expect(html).toContain('cursor-insert')
  })

  it('未踏破のターゲットに印を付ける', () => {
    const stage = makeStage({ buffer: ['ab'], cursor: [0, 0], goal: { type: 'collect', targets: [[0, 1]] } })
    expect(bufferHtml(startSession(stage))).toContain('target')
  })

  it('踏破したターゲットの印は消える', () => {
    const stage = makeStage({ buffer: ['abc'], cursor: [0, 0], goal: { type: 'collect', targets: [[0, 1], [0, 2]] } })
    expect(bufferHtml(play(startSession(stage), 'l'))).toContain('target')
    expect(bufferHtml(play(startSession(stage), 'll'))).not.toContain('target')
  })

  it('空行も 1 セル分の高さを持つ', () => {
    const stage = makeStage({ buffer: ['', 'a'], cursor: [1, 0], goal: { type: 'collect', targets: [[0, 0]] } })
    expect(bufferHtml(startSession(stage)).match(/class="line"/g)).toHaveLength(2)
  })

  it('バッファの HTML 特殊文字を escape する', () => {
    const stage = makeStage({ buffer: ['<x>'], cursor: [0, 0], goal: { type: 'collect', targets: [[0, 1]] } })
    const html = bufferHtml(startSession(stage))
    expect(html).toContain('&lt;')
    expect(html).not.toContain('<x>')
  })
})

describe('hudHtml', () => {
  it('モードとキーストローク数を出す', () => {
    const session = play(startSession(makeStage()), 'j')
    const html = hudHtml(session)
    expect(html).toContain('NORMAL')
    expect(html).toContain(`1 / ${session.stage.par}`)
  })

  it('押したキーの履歴を出す', () => {
    expect(hudHtml(play(startSession(makeStage()), 'jl'))).toContain('jl')
  })

  it('特殊キーはトークン表記で出す', () => {
    // goal を transform にすると xa 挿入直後にクリア済みとなり Escape が
    // 記録される前にキー入力が止まってしまうため、挿入中の移動が絶対に
    // 踏まない位置の collect ターゲットにして最後まで打鍵させる
    const stage = makeStage({
      allowedKeys: 'i<Esc>',
      buffer: ['a', 'z'],
      cursor: [0, 0],
      goal: { type: 'collect', targets: [[1, 0]] },
      solution: 'ix<Esc>',
    })
    expect(hudHtml(play(startSession(stage), 'ix<Esc>'))).toContain('&lt;Esc&gt;')
  })

  it('弾かれたキーを知らせる', () => {
    const html = hudHtml(play(startSession(makeStage()), 'w'))
    expect(html).toContain('flash')
    expect(html).toContain('まだ使わない')
  })

  it('弾かれていなければ知らせない', () => {
    expect(hudHtml(startSession(makeStage()))).not.toContain('flash')
  })
})

describe('clearedHtml', () => {
  it('par 以内なら三つ星を出す', () => {
    const stage = makeStage({ goal: { type: 'collect', targets: [[0, 1]] }, solution: 'l' })
    expect(clearedHtml(play(startSession(stage), 'l'), true)).toContain('★★★')
  })

  it('par を超えたら星が減る', () => {
    // ターゲット [1,0] へ寄り道してから辿り着く経路にし、5 打鍵すべてが
    // 数えられてからクリアになるようにする（最短で踏んでしまうと
    // par 超過を再現できない）。l,l,h,h で (0,0) に戻り、最後の j で
    // ちょうど 5 打鍵目にターゲットへ到達してクリアする
    const stage = makeStage({ goal: { type: 'collect', targets: [[1, 0]] }, solution: 'll' })
    const played = play(startSession(stage), 'llhhj')
    expect(played.status).toBe('cleared')
    const html = clearedHtml(played, true)
    expect(html).toContain('★')
    expect(html).toContain('☆')
  })

  it('操作の案内を出す', () => {
    const stage = makeStage({ goal: { type: 'collect', targets: [[0, 1]] }, solution: 'l' })
    expect(clearedHtml(play(startSession(stage), 'l'), true)).toContain('リトライ')
  })

  it('次のステージがあれば Enter での進行を案内する', () => {
    const stage = makeStage({ goal: { type: 'collect', targets: [[0, 1]] }, solution: 'l' })
    const html = clearedHtml(play(startSession(stage), 'l'), true)
    expect(html).toContain('Enter で次へ')
  })

  it('最後のステージでは Enter を案内しない', () => {
    const stage = makeStage({ goal: { type: 'collect', targets: [[0, 1]] }, solution: 'l' })
    const html = clearedHtml(play(startSession(stage), 'l'), false)
    expect(html).not.toContain('Enter で次へ')
    expect(html).toContain('最後')
  })
})

describe('renderPlay', () => {
  it('ステージのタイトルとバッファを描く', () => {
    const container = document.createElement('div')
    const session = startSession(makeStage({ title: 'テストの間' }))
    renderPlay(container, session, { onBack: vi.fn(), onRetry: vi.fn(), onNext: vi.fn() })

    expect(container.querySelector('.stage-title')?.textContent).toBe('テストの間')
    expect(container.querySelectorAll('.cell')).toHaveLength(6)
    expect(container.querySelector('.cleared')).toBeNull()
  })

  it('一覧へボタンで onBack を呼ぶ', () => {
    const container = document.createElement('div')
    const onBack = vi.fn()
    renderPlay(container, startSession(makeStage()), {
      onBack,
      onRetry: vi.fn(),
      onNext: vi.fn(),
    })

    container.querySelector<HTMLButtonElement>('.back')?.click()
    expect(onBack).toHaveBeenCalledOnce()
  })

  it('クリア後、リトライボタンで onRetry を呼ぶ', () => {
    const container = document.createElement('div')
    const stage = makeStage({ goal: { type: 'collect', targets: [[0, 1]] }, solution: 'l' })
    const onRetry = vi.fn()
    renderPlay(container, play(startSession(stage), 'l'), {
      onBack: vi.fn(),
      onRetry,
      onNext: vi.fn(),
    })

    container.querySelector<HTMLButtonElement>('.retry')?.click()
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('クリア後、次へボタンで onNext を呼ぶ', () => {
    const container = document.createElement('div')
    const stage = makeStage({ goal: { type: 'collect', targets: [[0, 1]] }, solution: 'l' })
    const onNext = vi.fn()
    renderPlay(container, play(startSession(stage), 'l'), {
      onBack: vi.fn(),
      onRetry: vi.fn(),
      onNext,
    })

    container.querySelector<HTMLButtonElement>('.next')?.click()
    expect(onNext).toHaveBeenCalledOnce()
  })

  it('次のステージがなければ次へボタンを無効化し、案内も Enter を出さない', () => {
    const container = document.createElement('div')
    const stage = makeStage({ goal: { type: 'collect', targets: [[0, 1]] }, solution: 'l' })
    renderPlay(container, play(startSession(stage), 'l'), {
      onBack: vi.fn(),
      onRetry: vi.fn(),
      onNext: null,
    })

    expect(container.querySelector<HTMLButtonElement>('.next')?.disabled).toBe(true)
    expect(container.querySelector('.hint')?.textContent).not.toContain('Enter')
  })

  it('クリア前は次へ／リトライボタンを描かない', () => {
    const container = document.createElement('div')
    renderPlay(container, startSession(makeStage()), {
      onBack: vi.fn(),
      onRetry: vi.fn(),
      onNext: vi.fn(),
    })

    expect(container.querySelector('.next')).toBeNull()
    expect(container.querySelector('.retry')).toBeNull()
  })
})
