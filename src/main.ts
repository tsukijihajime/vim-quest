import './ui/styles.css'
import { pressKey, startSession } from './game/session'
import type { Session } from './game/session'
import { loadStages } from './stages/loader'
import stagesJson from './stages/stages.json'
import { attachKeyboard } from './ui/input'
import { renderPlay } from './ui/render'

const app = document.querySelector<HTMLElement>('#app')
if (app === null) throw new Error('#app が見つからない')

const { stages, invalid } = loadStages(stagesJson)
if (invalid.length > 0) {
  console.warn('読み込めないステージがある', invalid)
}
if (stages.length === 0) throw new Error('遊べるステージがない')

let session: Session = startSession(stages[0])
renderPlay(app, session)

attachKeyboard(window, (key) => {
  if (session.status === 'cleared') {
    if (key === 'r' || key === 'R') {
      session = startSession(session.stage)
      renderPlay(app, session)
    }
    return
  }
  session = pressKey(session, key)
  renderPlay(app, session)
})
