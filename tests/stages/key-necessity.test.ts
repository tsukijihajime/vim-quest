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
 * 代わりに、仕様書（docs/superpowers/specs/2026-08-18-vim-quest-design.md）5.4 節
 * が定める 2 段の受け入れ基準に沿って、以下 3 種類の「安い」チェックだけを行う。
 *
 *   - 必須（違反は欠陥）: そのステージの solution が真の最短であること。
 *     Check 2 が該当する。「par 以内で勝てる経路が見つからない」ことを、実際に
 *     見つかった／疑われた代替経路について replay で確認する regression net で
 *     あって、証明ではない。後でさらに安い経路が見つかったらここに追加すれば
 *     テストが red になり、par を直すまで red のままになる。
 *   - 望ましい（達成できなければ記録する）: 教えるキーが唯一の最短経路であること。
 *     Check 3 が該当する。最も安い回避経路（教えるキー／組み合わせを使わない経路）
 *     を replay で確認し、その打鍵数を記録する。par と同数（タイ）なら 5.4 が
 *     明言する「許容される」ケースなので、テスト名もそう読めるようにする。
 *     par より安ければ Check 2 側の違反であり、そちらで検出される。
 *   - Check 1: 各ステージの想定解が、そのステージで新しく教えるキー
 *     （section 6 のカリキュラム表から機械的に転記した定数テーブルに基づく）
 *     を実際に使っているかの検査。allowedKeys の差分ではなく、カリキュラム表
 *     そのものを正とする。
 *
 * これらは exhaustive な証明ではない。反例テストは「この特定の代替手順は
 * par を下回れない」ことしか示さない。だが実際に発生した欠陥（想定解より
 * 安い経路が存在する / 教えたキーを一切使わずに ☆☆☆ が取れる）の再発は
 * 防げるし、全部合わせてもミリ秒オーダーで終わる。
 */

// ---------------------------------------------------------------------------
// Check 1: 各ステージの想定解が、新しく教えるキーを実際に使っているか
// ---------------------------------------------------------------------------

/**
 * 仕様書 5.3 節が明言する、原理的に要求できない 4 キー。
 *   - u  … undo は「それを使わずに到達できる状態」への巻き戻ししかできず、
 *          u を含む解から u を除いた解も必ずゴールに到達する。
 *   - ge … 2 打鍵のモーションで、k や gg+e 等 1 打鍵あたりの代替に
 *          打鍵数で絶対に勝てない。
 *   - ^  … gg / G / {n}G の着地列がそのまま「最初の非空白」なので、
 *          行ジャンプが ^ を意味的に含意してしまう。
 *   - gg … gg は常に 2 打鍵で 0 行目の最初の非空白に着地するが、1G も常に
 *          2 打鍵で同じ位置に着地する。カリキュラム 6 節はこの 2 つと
 *          {n}G を同一ステージ（05）で解放するので、どのバッファ・どの
 *          ターゲット配置でも gg を厳密に安くすることはできない。ただし
 *          1G は G と数字プレフィックスというそのステージ自身の教材で
 *          綴られているので、レッスンの回避にはなっていない（5.3 節末尾）。
 * これらはキー単体では u / g（ge / gg の g） / ^ として表れる。
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
 *     コマンドとして明記しているので、taught には 'g' を含めた上で
 *     仕様書 5.3 節末尾の理由により exempt にしている。それ以外の行は
 *     allowedKeys の差分とカリキュラム表の内容が一致しており、齟齬は
 *     見つからなかった。
 */
const CURRICULUM: Record<string, StageCurriculum> = {
  '01-hjkl': { taught: ['h', 'j', 'k', 'l'] },
  '02-word': { taught: ['w', 'b'] },
  // ge は仕様書 5.3 節により要求不能。taught には e と g（ge の一部）を挙げ、g を免除する。
  '03-word-end': { taught: ['e', 'g'], exempt: ['g'] },
  // ^ は仕様書 5.3 節により要求不能。
  '04-line-ends': { taught: ['0', '^', '$'], exempt: ['^'] },
  // gg は仕様書 5.3 節末尾により要求不能（根拠は上のコメント参照。ステージ固有の
  // 論拠ではなく仕様書そのものを根拠とする）。
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
// 共通ヘルパー
// ---------------------------------------------------------------------------

function play(id: string, notation: string): { stage: LoadedStage; played: Session } {
  const stage = find(id)
  const keys = parseKeys(notation)
  return { stage, played: keys.reduce(pressKey, startSession(stage)) }
}

/**
 * 必須基準（5.4 節）のためのアサーション: 経路が par を「下回って」いないこと。
 * par と同数（タイ）は許容する ── タイは望ましい基準（唯一の最短経路であること）の
 * 未達に過ぎず、必須基準の違反ではない。par 未満でクリアできてしまった場合のみ違反。
 */
function expectDoesNotBeatPar(stage: LoadedStage, played: Session): void {
  const beatsPar = played.status === 'cleared' && played.keystrokes < stage.par
  expect(
    beatsPar,
    `${stage.id}: 経路が par(${stage.par}) を下回ってクリアできてしまっている（実測 ${played.keystrokes} 手、status=${played.status}）`,
  ).toBe(false)
}

// ---------------------------------------------------------------------------
// Check 2: par 最小性の regression net（必須基準）
// ---------------------------------------------------------------------------
//
// fix round 4 で実際に見つかった 2 件の par 最小性違反（11-insert, 13-yank-paste）
// を修正した後、その修正が保つべき境界を replay で固定する。
// 「これより安い経路が絶対に存在しない」ことの証明にはならないが、実際に発生した
// 違反の再発は防げる。

describe('Check 2: par 最小性の regression net（証明ではない）', () => {
  it('11-insert: 想定解（25 手）がそのままクリアし、6 キーすべてを使っている', () => {
    // fix round 4 で発見された違反: 旧想定解は 26 手だったが、
    // "aa<Esc>A!<Esc>I<Space><Space><Esc>Otop<Esc>jjlao<Esc>oend" で 25 手クリアが
    // 存在した（Otop<Esc> を中央に動かし、末尾の oend が挿入モード中にゴール一致
    // するため trailing <Esc> が不要になる。また jj で desiredCol が 2 のまま
        // "buttn" 列 2 に着地し、l+a が e+i と同コストになる）。
    // 想定解はこの 25 手の経路のうち、l+a の代わりに e+i を使う等価な変種を採用
    // した。これにより教える 6 キー（i a I A o O）すべてが想定解に残る。
    const { stage, played } = play(
      '11-insert',
      'aa<Esc>A!<Esc>I<Space><Space><Esc>Otop<Esc>jjeio<Esc>oend',
    )
    expect(played.status).toBe('cleared')
    expect(played.keystrokes).toBe(25)
    expect(stage.par).toBe(25)
    expectDoesNotBeatPar(stage, played)
  })

  it('11-insert: l+a 版（i を使わない同コスト変種）は par を下回らない（タイ、5.4 節の許容ケース）', () => {
    // 発見時の経路そのもの。想定解を e+i 版に変えた後も、l+a 版は依然として
    // 存在し続ける（同じバッファ・ゴールなので当然）。この経路は i を一切
    // 使わないが、par(25) と同数でしか勝てない。「i を使わなくても ☆☆☆ が
    // 取れる」という 5.4 節の望ましい基準の未達（許容されるケース）であり、
        // par を下回る（必須基準の違反）ではないことをここで固定する。
    const { stage, played } = play(
      '11-insert',
      'aa<Esc>A!<Esc>I<Space><Space><Esc>Otop<Esc>jjlao<Esc>oend',
    )
    expect(played.status).toBe('cleared')
    expect(played.keystrokes).toBe(25) // par とタイ。24 以下なら新たな違反
    expectDoesNotBeatPar(stage, played)
  })

  it('13-yank-paste: 旧違反の再発経路（P を避けて打ち直す）はもう par を下回らない', () => {
    // fix round 4 で発見された違反: 旧バッファでは "yyGpkkitwo"（10 手）が
    // P を一切使わずに par(11) を下回ってクリアできた（3 文字ペイロードの
        // 打ち直しが i+two=4 手で、P を含む経路 y$ j P 側の 3 手より安かった）。
    // 対策としてペイロードを "two"（3 文字）から "apple"（5 文字）へ伸ばし、
    // 打ち直しコストを i+apple=6 手に増やした。yy/G/p/gg/w/y$/j/P という
    // 想定解の手順自体は変えていない（par は 11 のまま）。
    // この経路（同型: yyGp + kk + i + 新ペイロード）が par を下回らないことを
    // 固定する。
    const { stage, played } = play('13-yank-paste', 'yyGpkkiapple')
    expect(played.status).toBe('cleared')
    expect(played.keystrokes).toBe(12) // par(11) より 1 手高い。10 以下に戻ったら違反
    expectDoesNotBeatPar(stage, played)
  })
})

// ---------------------------------------------------------------------------
// Check 3: 教えるキー（または組み合わせ）の最も安い回避経路（望ましい基準・記録）
// ---------------------------------------------------------------------------
//
// 各回避経路は「そのステージが新しく教えるキー／組み合わせを使わず、
// 直前までに使えるキーだけで到達できる、手で考えられる最も安上がりな経路」
// であり、実際にエンジン（startSession / pressKey）に流し込んで検証する。
// 全探索ではないので「これより安い経路が絶対に存在しない」ことの証明には
// ならないが、見つけた中で最も安いものを使っている。
// par と同数（タイ）の場合は 5.4 節が明言する「許容されるケース」なので、
// テスト名を「回避しても ☆☆☆ が取れる（タイ）」のように必然性を含意しない
// 書き方にする。par を上回る場合は margin をコメントに明記する。

describe('Check 3: 教えるキーの最も安い回避経路（記録。par と同数なら 5.4 節の許容ケース）', () => {
  it('02-word: hjkl だけの回避経路は par(9) を上回る（margin 48）', () => {
    // 直前(01-hjkl)の許可キーは hjkl のみ。targets は 1 行上の col
    // {0,6,12,20,44}、開始 col31。1 次元の巡回として最短は「右端(44)まで
    // 13 歩、その後左端(0)まで 44 歩」で計 57 打。
    const { stage, played } = play('02-word', 'l'.repeat(13) + 'h'.repeat(44))
    expect(played.status).toBe('cleared')
    expect(played.keystrokes).toBe(57)
    expectDoesNotBeatPar(stage, played)
  })

  it('05-line-jump: hjkl だけの回避経路は par(7) を上回る（margin 9）', () => {
    // 直前(04-line-ends)の許可キーに G も数字もない。w/b/e/0/^/$ は行内移動
    // なので行ジャンプの役に立たない。targets は行 {11,0,3,8}、開始行5。
    // 「上端(0)まで5歩、その後下端(11)まで11歩」で計16打。
    const { stage, played } = play('05-line-jump', 'k'.repeat(5) + 'j'.repeat(11))
    expect(played.status).toBe('cleared')
    expect(played.keystrokes).toBe(16)
    expectDoesNotBeatPar(stage, played)
  })

  it('06-char-search: 直前ステージ(05)のキーだけの回避経路は par(11) を上回る（margin 10）', () => {
    // 直前(05-line-jump)の許可キーに f/F/t/T/;/, がない。バッファは 'x' の
    // 連続に p/q/r/s の 1 文字マーカーを埋め込んだもので、英数字は全て同じ
    // 単語クラスなので w/b/e はバッファの両端にしか着地できず（目的の列には
    // 届かない）実質使えない。残る手段は count 前置つき h/l のみ。
    // 7 ターゲットを左右にスイープすると 21 打。
    const { stage, played } = play(
      '06-char-search',
      '14h' + '16h' + '15h' + '14h' + '74l' + '15l' + '14l',
    )
    expect(played.status).toBe('cleared')
    expect(played.keystrokes).toBe(21)
    expectDoesNotBeatPar(stage, played)
  })

  it('07-paragraph: G + 数字だけの回避経路は par(3) を上回る（margin 3。3k6j6j に更新）', () => {
    // 旧反例 "6G12G18G"（8 手）は見つかっている中で最も安いものではなかった。
    // targets は行 {5,11,17}（0-indexed）、開始行8。G ではなく k / j の
    // 縦移動だけでも、desiredCol が 0 のまま保たれるので "3k6j6j"（6 手）で
    // 3 ターゲットすべてに着地できる。{ } を一切使わない経路としてはこちらが
    // 最も安い。
    const { stage, played } = play('07-paragraph', '3k6j6j')
    expect(played.status).toBe('cleared')
    expect(played.keystrokes).toBe(6)
    expectDoesNotBeatPar(stage, played)
  })

  it('08-move-review: 直前ステージ(07)のキーだけの回避経路は par(5) を上回る（margin 1。5h8l7l に更新）', () => {
    // 旧反例 "f;fe;Fb;"（8 手）は見つかっている中で最も安いものではなかった。
    // targets col{5,13,20}、開始col10。count 前置つき h/l だけで
    // "5h8l7l"（6 手）で 3 ターゲットすべてに着地できる。W/B/E は
    // おろか f/F/;（06 で使える）すら使わない、より安い回避経路。
    const { stage, played } = play('08-move-review', '5h8l7l')
    expect(played.status).toBe('cleared')
    expect(played.keystrokes).toBe(6)
    expectDoesNotBeatPar(stage, played)
  })

  it('11-insert: 直前ステージ(10)のキーには挿入モードへ入る手段が一切なく、回避経路自体が存在しない', () => {
    // 直前(10-operator)の許可キーは移動系と d/x のみで、i/a/I/A/o/O は
    // おろか Escape や挿入モードそのものが存在しない。削除だけでは
    // "top" "!" "end" のような新しい文字を作り出せないので、このゴール
    // （transform）は原理的に到達不可能である。何を何回押しても cleared に
    // ならないことを実測で確認する（回避経路の打鍵数を記録する以前に、
    // そもそも回避経路が存在しない）。
    const { stage, played } = play('11-insert', 'wdwbbbxxxx0$ggG')
    expect(played.status).not.toBe('cleared')
    expectDoesNotBeatPar(stage, played)
  })

  it('13-yank-paste: 直前ステージ(12)のキー（y/p/P なし）の回避経路は par(11) を大きく上回る（margin 8）', () => {
    // 直前(12-change)の許可キーに y/p/P はないが、挿入モード自体は 11 から
    // 使える。yank/paste の代わりに手で打ち直す最安の経路: j, i, "apple",
    // Esc（"A"→"appleA"）, j, o, "one apple"（新しい 4 行目、末尾は goal
    // 一致で即クリアなので Esc 不要）で 19 打。
    const { stage, played } = play('13-yank-paste', 'jiapple<Esc>joone apple')
    expect(played.status).toBe('cleared')
    expect(played.keystrokes).toBe(19)
    expectDoesNotBeatPar(stage, played)
  })

  it('14-undo-replace: r を使わず x + i/a 挿入だけの回避経路は par(14) を上回る（margin 7）', () => {
    // r 以外のキー（u を含む全て）を使ってよいが、u は「それを使わずに
    // 到達できる状態」への巻き戻ししかできず新しい文字を作り出せないので
    // （仕様書 5.3 節と同じ理屈）、この反例には登場しない。
    // 4 行それぞれの誤字 1 文字を x（削除）+ i または a（挿入して直後に
    // Escape）で直す。合計 21 打。
    const { stage, played } = play(
      '14-undo-replace',
      'xic<Esc>jlxio<Esc>jlxat<Esc>jhxio<Esc>',
    )
    expect(played.status).toBe('cleared')
    expect(played.keystrokes).toBe(21)
    expectDoesNotBeatPar(stage, played)
  })

  it('15-count: count 前置を使わない回避経路は par(8) を上回る（margin 2）', () => {
    // 3 行削除は dj+dd で 4 打（3dd の 3 打に対しマージン1）、4 行削除は
    // dj+dj で 4 打（4dd の 3 打に対しマージン1）。count を一切使わない
    // 最安の組み合わせは合計 10 打（j + dj+dd + j + dj+dj）。
    const { stage, played } = play('15-count', 'jdjddjdjdj')
    expect(played.status).toBe('cleared')
    expect(played.keystrokes).toBe(10)
    expectDoesNotBeatPar(stage, played)
  })

  it('16-review-rename: r を使わない回避経路は par(10) を上回る（margin 3）', () => {
    // "-" を "+" に直す最後の 1 手だけを r の代わりに f(探索)+x(削除)+i(挿入)+
    // Esc で行う。cw 部分は変えず、r の 1 打（cursor は既に "-" の位置にいる）
    // を f-,x,i,+,Esc の 5 打に置き換える形で計 13 打。
    const { stage, played } = play('16-review-rename', 'wcwsum<Esc>jf-xi+<Esc>')
    expect(played.status).toBe('cleared')
    expect(played.keystrokes).toBe(13)
    expectDoesNotBeatPar(stage, played)
  })

  it('17-review-duplicate: count 前置を使わない回避経路は par(7) とタイする（5.4 節の許容ケース、必然性はない）', () => {
    // 旧反例 "jjjjddyyp"（9 手）は「count 前置が必要」という誤った主張の
    // 根拠にされていたが、実際には "Gkddyyp"（7 手、数字なし）が par と
    // 同数でクリアできる。G（1 手）+ k（1 手）で 5G と同じ行に着地できる
    // ため。これは par を下回るものではないので必須基準の違反ではなく、
    // 「count 前置を使わなくても ☆☆☆ が取れる」という 5.4 節の望ましい
    // 基準の未達（許容されるケース）である。ここでは「par より短い経路が
    // ないこと」だけを主張し、count 前置の必要性は主張しない。
    const { stage, played } = play('17-review-duplicate', 'Gkddyyp')
    expect(played.status).toBe('cleared')
    expect(played.keystrokes).toBe(7) // par とタイ。6 以下なら新たな違反
    expectDoesNotBeatPar(stage, played)
  })

  it('18-review-sum: yy/P を使わない回避経路は par(14) を上回る（margin 1）', () => {
    // 新しい 1 行目を yy+P で複製して cw + r で書き換える代わりに、O で
    // 新しい空行を開いて全文字を打ち直す。15 打。
    const { stage, played } = play('18-review-sum', 'O  let sum = 30')
    expect(played.status).toBe('cleared')
    expect(played.keystrokes).toBe(15)
    expectDoesNotBeatPar(stage, played)
  })
})
