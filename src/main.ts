import './ui/styles.css'
import { loadProgress, recordClear, saveProgress } from './game/progress'
import type { Progress } from './game/progress'
import { clearedStars, pressKey, startSession } from './game/session'
import type { Session } from './game/session'
import { loadStages } from './stages/loader'
import stagesJson from './stages/stages.json'
import type { LoadedStage } from './stages/types'
import { attachKeyboard } from './ui/input'
import { renderPlay } from './ui/render'
import { renderStageSelect } from './ui/stageSelect'

/** 起動できない状態でも白紙のまま落とさず、目に見える形で知らせる */
function showFatalError(target: HTMLElement, message: string): void {
  target.innerHTML = `<div class="fatal-error">${message}</div>`
}

function main(): void {
  const appElement = document.querySelector<HTMLElement>('#app')
  if (appElement === null) {
    console.error('#app が見つからない')
    showFatalError(
      document.body,
      '画面を表示できない（#app が見つからない）。ページを再読み込みしてほしい。',
    )
    return
  }
  // ネストした関数の中でも非 null であることが分かるよう、別の const に控える
  const app: HTMLElement = appElement

  const { stages, invalid } = loadStages(stagesJson)
  if (invalid.length > 0) {
    console.warn('読み込めないステージがある', invalid)
  }
  if (stages.length === 0) {
    showFatalError(app, '遊べるステージがない。開発者に連絡してほしい。')
    return
  }

  let progress: Progress = loadProgress()
  let session: Session | null = null
  /** 同じクリアを二重に記録しないための旗 */
  let recorded = false

  function nextStageOf(stage: LoadedStage): LoadedStage | null {
    const index = stages.findIndex((item) => item.id === stage.id)
    return stages[index + 1] ?? null
  }

  function showSelect(): void {
    session = null
    renderStageSelect(app, stages, progress, startStage)
  }

  function draw(): void {
    const current = session
    if (current === null) return
    const next = nextStageOf(current.stage)
    renderPlay(app, current, {
      onBack: showSelect,
      onRetry: () => startStage(current.stage),
      onNext: next === null ? null : () => startStage(next),
    })
  }

  function startStage(stage: LoadedStage): void {
    session = startSession(stage)
    recorded = false
    draw()
  }

  function handleKey(key: string): void {
    const current = session
    if (current === null) return

    // Tab はどのステージのキーとも衝突しない予約キー。プレイ画面から
    // 一覧へ戻るキーボード操作をここで保証する（Esc はステージが正規に
    // 使うため予約できない）
    if (key === 'Tab') {
      showSelect()
      return
    }

    if (current.status === 'cleared') {
      if (key === 'r' || key === 'R') {
        startStage(current.stage)
        return
      }
      if (key === 'Enter') {
        const next = nextStageOf(current.stage)
        if (next === null) showSelect()
        else startStage(next)
      }
      return
    }

    const advanced = pressKey(current, key)
    session = advanced
    if (advanced.status === 'cleared' && !recorded) {
      recorded = true
      const stars = clearedStars(advanced)
      progress = recordClear(progress, advanced.stage.id, stars, advanced.keystrokes)
      saveProgress(progress)
    }
    draw()
  }

  attachKeyboard(window, handleKey, () => session !== null)
  showSelect()
}

main()
