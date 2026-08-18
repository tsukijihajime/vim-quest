import { describe, expect, it } from 'vitest'
import { parseKeys } from '../../src/core/keys'
import { pressKey, startSession } from '../../src/game/session'
import { loadStages } from '../../src/stages/loader'
import stagesJson from '../../src/stages/stages.json'
import type { LoadedStage } from '../../src/stages/types'
import type { Session } from '../../src/game/session'

const { stages } = loadStages(stagesJson)

function find(id: string): LoadedStage {
  const stage = stages.find((s) => s.id === id)
  if (stage === undefined) throw new Error(`stage not found: ${id}`)
  return stage
}

/**
 * このファイルは「全キー・全深さの exhaustive な BFS で解の非存在を証明する」
 * ことを諦めている。以前の実装（BFS + 状態正規化）は 8GB ヒープを要求した上に
 * それでも worker が OOM で異常終了しており、探索空間（~30 キーのアルファベット ×
 * count 前置 × pending オペレータ状態）が単体テストで全探索できる規模ではない。
 *
 * 代わりに、以下 3 種類の「安い」チェックだけを行う。
 *
 *   1. Check 1: 各ステージの想定解が、そのステージで新しく教えるキー
 *      （section 6 のカリキュラム表から機械的に転記した定数テーブルに基づく）
 *      を実際に使っているか。allowedKeys の差分ではなく、カリキュラム表そのものを
 *      正とする。これにより Escape / Backspace / Enter / 数字 が「新しく教える
 *      キー」として誤って要求されることがなくなる。
 *   2. Check 2: 「直前ステージまでに許可されたキーだけを使った、手で考えられる
 *      最も安上がりな経路」を実際にエンジンに流し込み、par 以内でクリア
 *      できない（またはそもそもクリアできない）ことを確認する。
 *   3. Check 3: 15〜18（[count] や オペレータ+モーションの「組み合わせ」を
 *      教える総合ステージ）について、その組み合わせを避けた反例を同様に検証する。
 *
 * これらは exhaustive な証明ではない。反例テストは「この特定の代替手順は
 * par 以内で勝てない」ことしか示さない。だが実際に発生した欠陥（意図した
 * キーを一切使わずに ☆☆☆ が取れる）の再発は防げるし、全部合わせてもミリ秒
 * オーダーで終わる。
 */

// ---------------------------------------------------------------------------
// Check 1: 各ステージの想定解が、新しく教えるキーを実際に使っているか
// ---------------------------------------------------------------------------

/**
 * 仕様書（docs/superpowers/specs/2026-08-18-vim-quest-design.md）5.3 節が
 * 明言する、原理的に要求できない 3 キー。
 *   - u  … undo は「それを使わずに到達できる状態」への巻き戻ししかできず、
 *          u を含む解から u を除いた解も必ずゴールに到達する。
 *   - ge … 2 打鍵のモーションで、k や gg+e 等 1 打鍵あたりの代替に
 *          打鍵数で絶対に勝てない。
 *   - ^  … gg / G / {n}G の着地列がそのまま「最初の非空白」なので、
 *          行ジャンプが ^ を意味的に含意してしまう。
 * これらはキー単体では u / g（ge の g） / ^ として表れる。
 */

type StageCurriculum = {
  /** このステージがカリキュラム表（6 節）で新しく教える個別キー */
  taught: string[]
  /** taught のうち、要求できないと判明している（根拠はコメント参照） */
  exempt?: string[]
  /** taught とは別に「count 前置（数字のいずれか）」が使われていることを求める */
  countPrefix?: boolean
}

/**
 * section 6 のカリキュラム表から転記した定数テーブル。
 * 15〜18（総合ステージ）は新規キーを持たないため、ここには載せず Check 3 で扱う。
 *
 * 仕様書の表と stages.json の allowedKeys を突き合わせて確認した結果:
 *   - 5 行目「gg G {n}G」: allowedKeys は G と数字を追加している。gg 自体は
 *     allowedKeys の差分には現れない（g はステージ 3 で既に allowedKeys に
 *     入っている）が、レッスン文・カリキュラム表ともに gg を新規に教える
 *     コマンドとして明記しているので、taught には 'g' を含めた上で下記の
 *     理由により exempt にしている。それ以外の行は allowedKeys の差分と
 *     カリキュラム表の内容が一致しており、齟齬は見つからなかった。
 */
const CURRICULUM: Record<string, StageCurriculum> = {
  '01-hjkl': { taught: ['h', 'j', 'k', 'l'] },
  '02-word': { taught: ['w', 'b'] },
  // ge は仕様書 5.3 節により要求不能。taught には e と g（ge の一部）を挙げ、g を免除する。
  '03-word-end': { taught: ['e', 'g'], exempt: ['g'] },
  // ^ は仕様書 5.3 節により要求不能。
  '04-line-ends': { taught: ['0', '^', '$'], exempt: ['^'] },
  // gg は追加の免除（仕様書 5.3 節の 3 キーには含まれない、本ラウンドで新たに
  // 発見した事実）。理由: 前ステージまでに行ジャンプの手段がなく、gg でしか
  // 先頭行へ飛べないように見えるが、count 前置は本ステージで初めて解放される
  // ため「1G」（count=1 の明示 + G）が gg と全く同じ 2 打鍵で先頭行に着地できる。
  // tests/stages/_probe.test.ts で実測済み（"Ggg4G9G" と "G1G4G9G" が
  // 同じ 7 打鍵で clear）。u / ge / ^ と異なり仕様書に明記された限界ではなく、
  // このステージのデータ固有の問題であり、報告のみに留め стages.json は
  // 変更していない（fix round 3 の割り当て外のため）。詳細はレポート参照。
  '05-line-jump': { taught: ['G', 'g'], exempt: ['g'], countPrefix: true },
  '06-char-search': { taught: ['f', 'F', 't', 'T', ';', ','] },
  '07-paragraph': { taught: ['{', '}'] },
  '08-move-review': { taught: ['W', 'B', 'E'] },
  '09-x': { taught: ['x'] },
  '10-operator': { taught: ['d'] },
  '11-insert': { taught: ['i', 'a', 'I', 'A', 'o', 'O'] },
  '12-change': { taught: ['c'] },
  '13-yank-paste': { taught: ['y', 'p', 'P'] },
  // u は仕様書 5.3 節により要求不能。
  '14-undo-replace': { taught: ['u', 'r'], exempt: ['u'] },
}

describe('Check 1: 各ステージの想定解が新しく教えるキーを実際に使っている', () => {
  for (const stage of stages) {
    const curriculum = CURRICULUM[stage.id]
    if (curriculum === undefined) continue // 15〜18: 総合ステージ、Check 3 で扱う

    it(`${stage.id}: taught=[${curriculum.taught.join(' ')}] を想定解が使っている`, () => {
      const solutionKeys = new Set(parseKeys(stage.solution))
      const exempt = new Set(curriculum.exempt ?? [])

      for (const key of curriculum.taught) {
        if (exempt.has(key)) continue // 免除理由は CURRICULUM のコメント参照
        expect(solutionKeys.has(key), `${stage.id}: キー "${key}" が想定解で使われていない`).toBe(
          true,
        )
      }

      if (curriculum.countPrefix === true) {
        const usesCount = [...solutionKeys].some((key) => /[1-9]/.test(key))
        expect(usesCount, `${stage.id}: count 前置（数字）が想定解で使われていない`).toBe(true)
      }
    })
  }
})

// ---------------------------------------------------------------------------
// Check 2 / Check 3 共通のヘルパー
// ---------------------------------------------------------------------------

function playWithout(id: string, notation: string): { stage: LoadedStage; played: Session } {
  const stage = find(id)
  const keys = parseKeys(notation)
  return { stage, played: keys.reduce(pressKey, startSession(stage)) }
}

/** 反例が「par 以内でクリアできてしまっていない」ことを確認する共通アサーション */
function expectCannotClearWithinPar(stage: LoadedStage, played: Session): void {
  const clearedWithinPar = played.status === 'cleared' && played.keystrokes <= stage.par
  expect(
    clearedWithinPar,
    `${stage.id}: 反例が par(${stage.par}) 以内にクリアできてしまっている（実測 ${played.keystrokes} 手、status=${played.status}）`,
  ).toBe(false)
}

// ---------------------------------------------------------------------------
// Check 2: 欠陥が見つかった／修正したステージの反例
// ---------------------------------------------------------------------------
//
// 各反例は「直前のステージまでに許可されたキーだけを使って、手で考えられる
// 最も安上がりな経路」であり、実際にエンジン（startSession / pressKey）に
// 流し込んで検証する。全探索ではないので「これより安い経路が絶対に存在
// しない」ことの証明にはならないが、見つけた中で最も安いものを使っている。
// 各テストのコメントに par との差（マージン）を明記する。

describe('Check 2: 直前ステージまでのキーだけを使った反例', () => {
  it('02-word: hjkl だけでは par(9) 以内にクリアできない', () => {
    // 直前(01-hjkl)の許可キーは hjkl のみ。targets は 1 行上の col
    // {0,6,12,20,44}、開始 col31。1 次元の巡回として最短は「右端(44)まで
    // 13 歩、その後左端(0)まで 44 歩」で計 57 打。マージン 48。
    const { stage, played } = playWithout('02-word', 'l'.repeat(13) + 'h'.repeat(44))
    expect(played.status).toBe('cleared')
    expect(played.keystrokes).toBe(57)
    expectCannotClearWithinPar(stage, played)
  })

  it('05-line-jump: hjkl だけでは par(7) 以内にクリアできない', () => {
    // 直前(04-line-ends)の許可キーに G も数字もない。w/b/e/0/^/$ は行内移動
    // なので行ジャンプの役に立たない。targets は行 {11,0,3,8}、開始行5。
    // 「上端(0)まで5歩、その後下端(11)まで11歩」で計16打。マージン9。
    const { stage, played } = playWithout('05-line-jump', 'k'.repeat(5) + 'j'.repeat(11))
    expect(played.status).toBe('cleared')
    expect(played.keystrokes).toBe(16)
    expectCannotClearWithinPar(stage, played)
  })

  it('06-char-search: 直前ステージ(05)のキーだけでは par(11) 以内にクリアできない', () => {
    // 直前(05-line-jump)の許可キーに f/F/t/T/;/, がない。バッファは 'x' の
    // 連続に p/q/r/s の 1 文字マーカーを埋め込んだもので、英数字は全て同じ
    // 単語クラスなので w/b/e はバッファの両端にしか着地できず（目的の列には
    // 届かない）実質使えない。残る手段は count 前置つき h/l のみ。
    // 7 ターゲットを左右にスイープすると 21 打（内訳は各 count+h/l の桁数+1）。
    // マージン 10。
    const { stage, played } = playWithout(
      '06-char-search',
      '14h' + '16h' + '15h' + '14h' + '74l' + '15l' + '14l',
    )
    expect(played.status).toBe('cleared')
    expect(played.keystrokes).toBe(21)
    expectCannotClearWithinPar(stage, played)
  })

  it('07-paragraph: { } を使わず G と数字だけでは par(3) 以内にクリアできない', () => {
    // 直前(06-char-search)の許可キーに { } はないが、G と数字(1-9)は
    // 05 から既に使える。targets は 1-indexed で 6,12,18 行目なので
    // "6G12G18G" の 8 打で到達できる。マージン5。
    const { stage, played } = playWithout('07-paragraph', '6G12G18G')
    expect(played.status).toBe('cleared')
    expect(played.keystrokes).toBe(8)
    expectCannotClearWithinPar(stage, played)
  })

  it('08-move-review: 直前ステージ(07)のキーだけでは par(5) 以内にクリアできない', () => {
    // 直前(07-paragraph)の許可キーに W B E はないが f/F/t/T/;/, は 06 から
    // 使える。targets col{5,13,20}、開始col10、buffer="a=1; b=2; c=b; d=e; e=5;"。
    // f;（col13 に直行）→ f + 'e' 探索（col17。d=e; の e で足止め）→
    // ; で col20 → F + 'b' 探索（col12。c=b; の b で足止め）→ ; で col5、
    // という f/F/;（W/B/E を一切使わない）だけの経路で 8 打。マージン3。
    const { stage, played } = playWithout('08-move-review', 'f;fe;Fb;')
    expect(played.status).toBe('cleared')
    expect(played.keystrokes).toBe(8)
    expectCannotClearWithinPar(stage, played)
  })

  it('11-insert: 直前ステージ(10)のキーには挿入モードへ入る手段が一切ない', () => {
    // 直前(10-operator)の許可キーは移動系と d/x のみで、i/a/I/A/o/O は
    // おろか Escape や挿入モードそのものが存在しない。削除だけでは
    // "top" "!" "end" のような新しい文字を作り出せないので、このゴール
    // （transform）は原理的に到達不可能である。何を何回押しても cleared に
        // ならないことを実測で確認する（par 以内どころか、そもそも解なし）。
    const { stage, played } = playWithout('11-insert', 'wdwbbbxxxx0$ggG')
    expect(played.status).not.toBe('cleared')
    expectCannotClearWithinPar(stage, played)
  })

  it('13-yank-paste: 直前ステージ(12)のキー（y/p/P なし）では par(11) 以内にクリアできない', () => {
    // 直前(12-change)の許可キーに y/p/P はないが、挿入モード自体は 11 から
    // 使える。yank/paste の代わりに手で打ち直す最安の経路: j, i, "two",
    // Esc（"A"→"twoA"）, j, o, "one two"（新しい 4 行目、末尾は goal 一致で
    // 即クリアなので Esc 不要）で 15 打。マージン4。
    const { stage, played } = playWithout('13-yank-paste', 'jitwo<Esc>joone two')
    expect(played.status).toBe('cleared')
    expect(played.keystrokes).toBe(15)
    expectCannotClearWithinPar(stage, played)
  })

  it('14-undo-replace: r を使わず x + i/a 挿入だけでは par(14) 以内にクリアできない', () => {
    // r 以外のキー（u を含む全て）を使ってよいが、u は「それを使わずに
    // 到達できる状態」への巻き戻ししかできず新しい文字を作り出せないので
    // （仕様書 5.3 節と同じ理屈）、この反例には登場しない。
    // 4 行それぞれの誤字 1 文字を x（削除）+ i または a（挿入して直後に
    // Escape）で直す。合計 21 打。マージン7。
    const { stage, played } = playWithout(
      '14-undo-replace',
      'xic<Esc>jlxio<Esc>jlxat<Esc>jhxio<Esc>',
    )
    expect(played.status).toBe('cleared')
    expect(played.keystrokes).toBe(21)
    expectCannotClearWithinPar(stage, played)
  })
})

// ---------------------------------------------------------------------------
// Check 3: 15〜18（組み合わせを教える総合ステージ）の反例
// ---------------------------------------------------------------------------
//
// これらのステージは新規キーを持たず、[count] やオペレータ+モーションの
// 「効率の良い組み合わせ」そのものを教える。そのため Check 1 の対象外だが、
// 「その組み合わせを使わない最安の代替」が par を超えることを個別に検証する。

describe('Check 3: 組み合わせを教える総合ステージ（15〜18）の反例', () => {
  it('15-count: count 前置を使わず dj/dd の組み合わせだけでは par(8) 以内にクリアできない', () => {
    // 3 行削除は dj+dd で 4 打（3dd の 3 打に対しマージン1）、4 行削除は
        // dj+dj で 4 打（4dd の 3 打に対しマージン1）。count を一切使わない
    // 最安の組み合わせは合計 10 打（j + dj+dd + j + dj+dj）。マージン2。
    const { stage, played } = playWithout('15-count', 'jdjddjdjdj')
    expect(played.status).toBe('cleared')
    expect(played.keystrokes).toBe(10)
    expectCannotClearWithinPar(stage, played)
  })

  it('16-review-rename: r を使わず x + i だけでは par(10) 以内にクリアできない', () => {
    // "-" を "+" に直す最後の 1 手だけを r の代わりに f(探索)+x(削除)+i(挿入)+
    // Esc で行う。cw 部分は変えず、r の 1 打（cursor は既に "-" の位置にいる）
    // を f-,x,i,+,Esc の 5 打に置き換える形で計 13 打。マージン3。
    const { stage, played } = playWithout('16-review-rename', 'wcwsum<Esc>jf-xi+<Esc>')
    expect(played.status).toBe('cleared')
    expect(played.keystrokes).toBe(13)
    expectCannotClearWithinPar(stage, played)
  })

  it('17-review-duplicate: count 前置を使わず j 連打では par(7) 以内にクリアできない', () => {
    // 5G（2 打）の代わりに j を 4 回（4 打）で同じ行に着地する。マージン2。
    const { stage, played } = playWithout('17-review-duplicate', 'jjjjddyyp')
    expect(played.status).toBe('cleared')
    expect(played.keystrokes).toBe(9)
    expectCannotClearWithinPar(stage, played)
  })

  it('18-review-sum: yy/P を使わず手で打ち直すだけでは par(14) 以内にクリアできない', () => {
    // 新しい 1 行目を yy+P で複製して cw + r で書き換える代わりに、O で
    // 新しい空行を開いて全文字を打ち直す。15 打。マージン1（僅差だが上回る）。
    const { stage, played } = playWithout('18-review-sum', 'O  let sum = 30')
    expect(played.status).toBe('cleared')
    expect(played.keystrokes).toBe(15)
    expectCannotClearWithinPar(stage, played)
  })
})
