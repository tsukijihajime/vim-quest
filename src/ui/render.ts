import { formatKey } from '../core/keys'
import { starsFor } from '../game/scoring'
import type { Session } from '../game/session'

const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, (ch) => ENTITIES[ch] ?? ch)
}

export function bufferHtml(session: Session): string {
  const { editor, stage, collected } = session
  const targets = stage.goal.type === 'collect' ? stage.goal.targets : []

  return editor.lines
    .map((line, row) => {
      // 挿入モードでは行末の次にカーソルが立つので 1 セル余分に描く
      const needsTail =
        editor.mode === 'insert' && editor.cursor.row === row && editor.cursor.col >= line.length
      const width = Math.max(line.length + (needsTail ? 1 : 0), 1)

      const cells: string[] = []
      for (let col = 0; col < width; col += 1) {
        const classes = ['cell']
        const target = targets.findIndex((t) => t[0] === row && t[1] === col)
        if (target !== -1 && !collected[target]) classes.push('target')
        if (row === editor.cursor.row && col === editor.cursor.col) {
          classes.push(editor.mode === 'insert' ? 'cursor-insert' : 'cursor-normal')
        }
        cells.push(`<span class="${classes.join(' ')}">${escapeHtml(line[col] ?? ' ')}</span>`)
      }
      return `<div class="line">${cells.join('')}</div>`
    })
    .join('')
}

export function hudHtml(session: Session): string {
  const { editor, stage, keystrokes, keyLog, rejected } = session
  const label = editor.mode === 'insert' ? 'INSERT' : 'NORMAL'
  const log = escapeHtml(keyLog.map(formatKey).join(''))
  const flash =
    rejected === null
      ? ''
      : `<span class="flash">このステージでは ${escapeHtml(formatKey(rejected))} はまだ使わない</span>`

  return [
    `<span class="mode mode-${editor.mode}">${label}</span>`,
    `<span class="keystrokes">${keystrokes} / ${stage.par}</span>`,
    `<span class="keylog">${log}</span>`,
    flash,
  ].join('')
}

export function clearedHtml(session: Session): string {
  const stars = starsFor(session.keystrokes, session.stage.par)
  const marks = '★'.repeat(stars) + '☆'.repeat(3 - stars)
  return [
    '<div class="cleared">',
    `<div class="stars">${marks}</div>`,
    `<div class="score">${session.keystrokes} キー（par ${session.stage.par}）</div>`,
    '<div class="hint">Enter で次へ / R でリトライ</div>',
    '<div class="actions">',
    '<button class="action next" type="button">次のステージへ</button>',
    '<button class="action retry" type="button">リトライ</button>',
    '</div>',
    '</div>',
  ].join('')
}

export type PlayHandlers = {
  onBack: () => void
  onRetry: () => void
  /** 次のステージがなければ null */
  onNext: (() => void) | null
}

export function renderPlay(
  container: HTMLElement,
  session: Session,
  handlers: PlayHandlers,
): void {
  const { stage } = session
  container.innerHTML = [
    '<div class="game">',
    '<header class="hud-top">',
    '<button class="back" type="button">← 一覧へ</button>',
    `<div class="stage-title">${escapeHtml(stage.title)}</div>`,
    `<div class="lesson">${escapeHtml(stage.lesson)}</div>`,
    '</header>',
    `<div class="buffer">${bufferHtml(session)}</div>`,
    `<footer class="hud-bottom">${hudHtml(session)}</footer>`,
    session.status === 'cleared' ? clearedHtml(session) : '',
    '</div>',
  ].join('')

  container.querySelector('.back')?.addEventListener('click', handlers.onBack)
  container.querySelector('.retry')?.addEventListener('click', handlers.onRetry)

  const next = container.querySelector<HTMLButtonElement>('.next')
  if (next !== null) {
    if (handlers.onNext === null) next.disabled = true
    else next.addEventListener('click', handlers.onNext)
  }
}
