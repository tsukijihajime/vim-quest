export type CollectGoal = { type: 'collect'; targets: [number, number][] }
export type TransformGoal = { type: 'transform'; expected: string[] }
export type Goal = CollectGoal | TransformGoal

export type Stage = {
  id: string
  title: string
  /** 教えるコマンドの説明文 */
  lesson: string
  /** ノーマルモードで許すキーのキー表記 */
  allowedKeys: string
  buffer: string[]
  cursor: [number, number]
  goal: Goal
  /** 想定解のキー表記。par の算出とテストに使う */
  solution: string
}

export type LoadedStage = Stage & {
  /** solution のキー数。☆☆☆ の基準 */
  par: number
  allowed: Set<string>
  solutionKeys: string[]
}

export type InvalidStage = { id: string; reason: string }
