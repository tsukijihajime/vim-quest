import { describe, expect, it } from 'vitest'
import { pos, run } from './helpers'

describe('c + モーション', () => {
  it('cw は単語を置き換える', () => {
    expect(run(['var oldName = 1'], [0, 4], 'cwnewName<Esc>').lines).toEqual([
      'var newName = 1',
    ])
  })

  it('cw は現在の単語の末尾までを対象とし空白を残す', () => {
    expect(run(['alpha beta'], [0, 0], 'cwX<Esc>').lines).toEqual(['X beta'])
  })

  it('1 文字の単語の cw はその 1 文字だけを対象とする', () => {
    // ここが ce との違い。ce だと "x =" まで巻き込んでしまう
    expect(run(['  let x = 10'], [0, 6], 'cwsum<Esc>').lines).toEqual(['  let sum = 10'])
  })

  it('単語の末尾にいる cw もその 1 文字だけを対象とする', () => {
    expect(run(['alpha beta'], [0, 4], 'cwX<Esc>').lines).toEqual(['alphX beta'])
  })

  it('未知のキーが続けばオペレータは破棄される', () => {
    expect(run(['alpha beta'], [0, 0], 'cX<Esc>').lines).toEqual(['alpha beta'])
  })

  it('cw は空白の上では通常の w として振る舞う', () => {
    expect(run(['a  b'], [0, 1], 'cwX<Esc>').lines).toEqual(['aXb'])
  })

  it('cW は空白区切りで置き換える', () => {
    expect(run(['a.b.c d'], [0, 0], 'cWX<Esc>').lines).toEqual(['X d'])
  })

  it('c$ は行末までを置き換える', () => {
    expect(run(['var junk stuff here'], [0, 4], 'c$done<Esc>').lines).toEqual(['var done'])
  })

  it('cf は対象文字を含めて置き換える', () => {
    expect(run(['a:b:c'], [0, 0], 'cf:X<Esc>').lines).toEqual(['Xb:c'])
  })

  it('置き換えた内容がレジスタに入る', () => {
    expect(run(['alpha beta'], [0, 0], 'cwX<Esc>').register).toEqual({
      text: ['alpha'],
      linewise: false,
    })
  })

  it('挿入モードに入る', () => {
    expect(run(['alpha beta'], [0, 0], 'cw').mode).toBe('insert')
  })
})

describe('cc', () => {
  it('行の内容を空にして行は残す', () => {
    expect(run(['a', 'bbb', 'c'], [1, 1], 'ccX<Esc>').lines).toEqual(['a', 'X', 'c'])
  })

  it('count の分だけ行をまとめて置き換える', () => {
    expect(run(['a', 'b', 'c', 'd'], [0, 0], '3ccX<Esc>').lines).toEqual(['X', 'd'])
  })

  it('カーソルは列 0 から始まる', () => {
    expect(pos(run(['   abc'], [0, 4], 'cc'))).toEqual([0, 0])
  })

  it('linewise としてレジスタに入る', () => {
    expect(run(['a', 'b'], [0, 0], 'ccX<Esc>').register).toEqual({
      text: ['a'],
      linewise: true,
    })
  })
})

describe('アンドゥの単位', () => {
  it('c は削除と挿入を合わせて 1 スナップショットにする', () => {
    expect(run(['alpha beta'], [0, 0], 'cwX<Esc>').undoStack).toHaveLength(1)
  })
})

describe('仕様のシナリオ: ステージ 12 の想定解', () => {
  it('4 行のバッファを目標の形に変える', () => {
    const state = run(
      ['var oldName = 1', 'var junk stuff here', 'replace me entirely', 'keep me'],
      [0, 0],
      'wcwnewName<Esc>j0wc$done<Esc>jccgone<Esc>',
    )
    expect(state.lines).toEqual(['var newName = 1', 'var done', 'gone', 'keep me'])
  })
})
