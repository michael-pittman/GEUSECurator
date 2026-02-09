/**
 * Seeded shuffle using a simple mulberry32 PRNG.
 * Same seed produces the same shuffled order (deterministic).
 * Use YYYY-MM-DD as seed for daily-varying order.
 */
export function shuffleWithSeed<T>(items: T[], seed: number): T[] {
  const arr = [...items]
  let state = seed

  const next = () => {
    state = (state + 0x6d2b79f5) | 0 // mulberry32
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32
  }

  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/** Date string (YYYY-MM-DD) as numeric seed for shuffleWithSeed */
export function getDateSeed(): number {
  const now = new Date()
  const str = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}`
  return [...str].reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) | 0, 0)
}
