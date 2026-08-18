import { describe, expect, it } from 'vitest'
import { parseKeys } from '../../src/core/keys'
import { pressKey, startSession } from '../../src/game/session'
import type { Session } from '../../src/game/session'
import { bufferHtml, clearedHtml, escapeHtml, hudHtml } from '../../src/ui/render'
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
    expect(clearedHtml(play(startSession(stage), 'l'))).toContain('★★★')
  })

  it('par を超えたら星が減る', () => {
    // ターゲットを l/h が触れない行に置き、5 打鍵すべてが数えられる
    // ようにする（同じ行のターゲットだと 2 打鍵目で即クリアしてしまい
    // 残りの打鍵が数えられず par 超過を再現できない）
    const stage = makeStage({ goal: { type: 'collect', targets: [[1, 0]] }, solution: 'll' })
    const html = clearedHtml(play(startSession(stage), 'lllhl'))
    expect(html).toContain('★')
    expect(html).toContain('☆')
  })

  it('操作の案内を出す', () => {
    const stage = makeStage({ goal: { type: 'collect', targets: [[0, 1]] }, solution: 'l' })
    expect(clearedHtml(play(startSession(stage), 'l'))).toContain('リトライ')
  })
})
