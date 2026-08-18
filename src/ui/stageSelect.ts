import { isUnlocked } from '../game/progress'
import type { Progress } from '../game/progress'
import type { LoadedStage } from '../stages/types'
import { escapeHtml } from './render'

function cardHtml(stage: LoadedStage, unlocked: boolean, progress: Progress): string {
  const record = progress.cleared[stage.id]
  const stars =
    record === undefined ? '' : '★'.repeat(record.stars) + '☆'.repeat(3 - record.stars)
  const best =
    record === undefined ? '' : `<div class="card-best">最短 ${record.bestKeystrokes} キー</div>`

  return [
    `<button class="card ${unlocked ? 'unlocked' : 'locked'}" type="button"`,
    unlocked ? ` data-stage-id="${escapeHtml(stage.id)}">` : ' disabled>',
    `<div class="card-title">${escapeHtml(stage.title)}</div>`,
    `<div class="card-stars">${unlocked ? stars : '🔒'}</div>`,
    best,
    '</button>',
  ].join('')
}

export function stageSelectHtml(stages: LoadedStage[], progress: Progress): string {
  const cards = stages
    .map((stage, index) => cardHtml(stage, isUnlocked(progress, stages, index), progress))
    .join('')

  return [
    '<div class="select">',
    '<h1 class="select-title">VimQuest</h1>',
    '<p class="select-lead">',
    'テキストバッファの上で Vim の操作を身につける。上から順に解放される。',
    '</p>',
    `<div class="card-grid">${cards}</div>`,
    '</div>',
  ].join('')
}

export function renderStageSelect(
  container: HTMLElement,
  stages: LoadedStage[],
  progress: Progress,
  onPick: (stage: LoadedStage) => void,
): void {
  container.innerHTML = stageSelectHtml(stages, progress)
  container.querySelectorAll<HTMLButtonElement>('.card.unlocked').forEach((button) => {
    button.addEventListener('click', () => {
      const stage = stages.find((item) => item.id === button.dataset.stageId)
      if (stage !== undefined) onPick(stage)
    })
  })
}
