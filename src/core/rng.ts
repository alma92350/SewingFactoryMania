/**
 * Seeded, serializable PRNG (mulberry32). The state lives in a plain object so it
 * can be stored inside the game state and survive save/load and replays.
 */
export interface RngState {
  s: number;
}

export function createRng(seed: number): RngState {
  return { s: seed >>> 0 };
}

export function rand(r: RngState): number {
  r.s = (r.s + 0x6d2b79f5) >>> 0;
  let t = r.s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Inclusive integer in [min, max]. */
export function randInt(r: RngState, min: number, max: number): number {
  return min + Math.floor(rand(r) * (max - min + 1));
}

export function pick<T>(r: RngState, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick from empty list');
  return items[Math.floor(rand(r) * items.length)] as T;
}

export function chance(r: RngState, p: number): boolean {
  if (p <= 0) return false;
  if (p >= 1) return true;
  return rand(r) < p;
}
