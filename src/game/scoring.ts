export type Stars = 1 | 2 | 3

export function starsFor(keystrokes: number, par: number): Stars {
  if (keystrokes <= par) return 3
  if (keystrokes <= Math.floor(par * 1.5)) return 2
  return 1
}
