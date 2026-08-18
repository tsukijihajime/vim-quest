import { describe, expect, it } from 'vitest'
import { starsFor } from '../../src/game/scoring'

describe('starsFor', () => {
  it('par 以内なら三つ星', () => {
    expect(starsFor(10, 10)).toBe(3)
    expect(starsFor(7, 10)).toBe(3)
  })

  it('par の 1.5 倍以内なら二つ星', () => {
    expect(starsFor(11, 10)).toBe(2)
    expect(starsFor(15, 10)).toBe(2)
  })

  it('それを超えたら一つ星', () => {
    expect(starsFor(16, 10)).toBe(1)
    expect(starsFor(999, 10)).toBe(1)
  })

  it('1.5 倍は切り上げで判定する', () => {
    // par 7 の 1.5 倍は 10.5 なので 11 で一つ星になる
    expect(starsFor(10, 7)).toBe(2)
    expect(starsFor(11, 7)).toBe(1)
  })
})
