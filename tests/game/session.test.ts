import { describe, expect, it } from 'vitest'
import { parseKeys } from '../../src/core/keys'
import { pressKey, startSession } from '../../src/game/session'
import type { Session } from '../../src/game/session'
import { makeStage } from '../stages/fixtures'

function play(session: Session, notation: string): Session {
  let current = session
  for (const key of parseKeys(notation)) current = pressKey(current, key)
  return current
}

describe('startSession', () => {
  it('ステージの初期バッファとカーソルで始まる', () => {
    const session = startSession(makeStage())
    expect(session.editor.lines).toEqual(['abc', 'def'])
    expect(session.editor.cursor).toEqual({ row: 0, col: 0 })
    expect(session.status).toBe('playing')
    expect(session.keystrokes).toBe(0)
  })

  it('collect のターゲット数だけ未踏破のフラグを持つ', () => {
    const stage = makeStage({ goal: { type: 'collect', targets: [[1, 0], [1, 2]] } })
    expect(startSession(stage).collected).toEqual([false, false])
  })
})

describe('allowedKeys の検査', () => {
  it('許されたキーはキーストロークに数える', () => {
    const session = play(startSession(makeStage()), 'jl')
    expect(session.keystrokes).toBe(2)
    expect(session.rejectedCount).toBe(0)
  })

  it('許されないキーは弾いてキーストロークに数えない', () => {
    const session = play(startSession(makeStage()), 'jwl')
    expect(session.keystrokes).toBe(2)
    expect(session.rejectedCount).toBe(1)
  })

  it('弾いたキーを rejected に残す', () => {
    expect(play(startSession(makeStage()), 'w').rejected).toBe('w')
  })

  it('次に有効なキーを押すと rejected が消える', () => {
    expect(play(startSession(makeStage()), 'wj').rejected).toBeNull()
  })

  it('挿入モード中は任意の文字を許す', () => {
    const stage = makeStage({
      allowedKeys: 'i<Esc>',
      buffer: ['ac'],
      cursor: [0, 1],
      goal: { type: 'transform', expected: ['abc'] },
      solution: 'ib<Esc>',
    })
    const session = play(startSession(stage), 'ib<Esc>')
    expect(session.rejectedCount).toBe(0)
    expect(session.editor.lines).toEqual(['abc'])
  })

  it('f の対象文字は allowedKeys の検査を受けない', () => {
    const stage = makeStage({
      allowedKeys: 'f',
      buffer: ['a:b'],
      cursor: [0, 0],
      goal: { type: 'collect', targets: [[0, 1]] },
      solution: 'f:',
    })
    const session = play(startSession(stage), 'f:')
    expect(session.rejectedCount).toBe(0)
    expect(session.status).toBe('cleared')
  })
})

describe('collect のゴール判定', () => {
  it('全ターゲットを踏んだらクリアになる', () => {
    const stage = makeStage({ goal: { type: 'collect', targets: [[0, 1], [1, 1]] } })
    const session = play(startSession(stage), 'lj')
    expect(session.collected).toEqual([true, true])
    expect(session.status).toBe('cleared')
  })

  it('順番は問わない', () => {
    const stage = makeStage({ goal: { type: 'collect', targets: [[1, 1], [0, 1]] } })
    expect(play(startSession(stage), 'lj').status).toBe('cleared')
  })

  it('一部だけならクリアにならない', () => {
    const stage = makeStage({ goal: { type: 'collect', targets: [[0, 1], [1, 1]] } })
    expect(play(startSession(stage), 'l').status).toBe('playing')
  })

  it('踏んだ記録は離れても消えない', () => {
    const stage = makeStage({ goal: { type: 'collect', targets: [[0, 1], [1, 1]] } })
    expect(play(startSession(stage), 'lh').collected).toEqual([true, false])
  })
})

describe('transform のゴール判定', () => {
  const stage = makeStage({
    allowedKeys: 'x',
    buffer: ['heXllo'],
    cursor: [0, 2],
    goal: { type: 'transform', expected: ['hello'] },
    solution: 'x',
  })

  it('バッファが一致したらクリアになる', () => {
    expect(play(startSession(stage), 'x').status).toBe('cleared')
  })

  it('一致するまではクリアにならない', () => {
    expect(startSession(stage).status).toBe('playing')
  })

  it('行数が違えばクリアにならない', () => {
    const multi = makeStage({
      allowedKeys: 'x',
      buffer: ['hello', 'x'],
      cursor: [0, 0],
      goal: { type: 'transform', expected: ['hello'] },
      solution: 'x',
    })
    expect(play(startSession(multi), 'x').status).toBe('playing')
  })
})

describe('クリア後', () => {
  it('それ以上キーを受け付けない', () => {
    const stage = makeStage({ goal: { type: 'collect', targets: [[0, 1]] } })
    const cleared = play(startSession(stage), 'l')
    const after = play(cleared, 'jjj')
    expect(after.keystrokes).toBe(cleared.keystrokes)
    expect(after.editor.cursor).toEqual(cleared.editor.cursor)
  })
})

describe('キーログ', () => {
  it('押したキーを順に残す', () => {
    expect(play(startSession(makeStage()), 'jl').keyLog).toEqual(['j', 'l'])
  })

  it('弾かれたキーは残さない', () => {
    expect(play(startSession(makeStage()), 'jwl').keyLog).toEqual(['j', 'l'])
  })
})
