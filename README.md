# VimQuest

本物の Vim と同じ意味論で動くテキストバッファをゲーム盤にした、ブラウザで遊ぶ Vim 学習ゲーム。
移動コマンドから基本編集コマンドまでを全 18 ステージで段階的に習得する。

## 遊び方

```bash
npm install
npm run dev
```

表示された URL を開くとステージ一覧が出る。ステージをクリアすると次が解放される。
キーストロークが少ないほど星が増える（par 以内で ☆☆☆）。

## 開発

```bash
npm test          # ユニットテストとステージ検証
npm run build     # 型チェックと静的ファイルへのビルド
```

## 構成

```
src/core    DOM に依存しない Vim エンジン。applyKey(state, key) が中心
src/stages  ステージ定義（JSON）と検証
src/game    進行、ゴール判定、☆ 評価、localStorage への保存
src/ui      描画とキーボード入力
```

依存は `ui → game → stages → core` の一方向のみ。
`core` は純粋関数だけで構成され、ブラウザを起動せずに全ての意味論をテストできる。

ステージを足すときは `src/stages/stages.json` に追記する。
`npm test` が想定解で解けることと par の正しさを自動検証する。

## 設計

- 仕様: `docs/superpowers/specs/2026-08-18-vim-quest-design.md`
- 実装計画: `docs/superpowers/plans/2026-08-18-vim-quest.md`
