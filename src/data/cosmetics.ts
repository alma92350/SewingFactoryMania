/**
 * Cosmetics (PRD §12, §16): stars unlock looks only, never power. Caps for the seamstresses,
 * a collar for the factory cat, the supplier's wall calendar, and songs for the radio.
 */
export type CosmeticSlot = 'cap' | 'collar' | 'calendar' | 'radio';

export interface CosmeticDef {
  id: string;
  name: string;
  /** Total stars needed. */
  stars: number;
  colour?: string;
}

export const COSMETICS: Record<CosmeticSlot, CosmeticDef[]> = {
  cap: [
    { id: 'white', name: 'White caps', stars: 0, colour: 'rgba(255,255,255,0.85)' },
    { id: 'blue', name: 'Blue caps', stars: 5, colour: '#64b5f6' },
    { id: 'pink', name: 'Pink caps', stars: 10, colour: '#f48fb1' },
    { id: 'green', name: 'Jade caps', stars: 15, colour: '#81c784' },
  ],
  collar: [
    { id: 'red', name: 'Red collar', stars: 0, colour: '#d32f2f' },
    { id: 'blue', name: 'Blue collar', stars: 8, colour: '#1976d2' },
    { id: 'bell', name: 'Golden bell', stars: 14, colour: '#f9a825' },
  ],
  calendar: [
    { id: 'formosa', name: 'Formosa Threadworks calendar', stars: 0, colour: '#00897b' },
    { id: 'sakuraya', name: 'Sakura-ya cherry blossoms', stars: 7, colour: '#c2185b' },
    { id: 'hanil', name: 'Hanil Apparel mountains', stars: 12, colour: '#1565c0' },
  ],
  radio: [
    { id: 'off', name: 'Radio off', stars: 0 },
    { id: 'riverside', name: 'Riverside Morning', stars: 0 },
    { id: 'bicycle', name: 'Bicycle Bell Bolero', stars: 6 },
    { id: 'monsoon', name: 'Monsoon Waltz', stars: 12 },
    { id: 'peach', name: 'Peach Blossom Swing', stars: 18 },
  ],
};

export type Cosmetics = Record<CosmeticSlot, string>;

export const DEFAULT_COSMETICS: Cosmetics = { cap: 'white', collar: 'red', calendar: 'formosa', radio: 'riverside' };

export function cosmetic(slot: CosmeticSlot, id: string | undefined): CosmeticDef {
  return COSMETICS[slot].find((c) => c.id === id) ?? COSMETICS[slot][0]!;
}

export function unlocked(c: CosmeticDef, totalStars: number): boolean {
  return totalStars >= c.stars;
}

/**
 * Radio songs: original melodies on a pentatonic scale (no licensed music, PRD §15).
 * Notes are semitones above the root; -1 is a rest. One note per eighth.
 */
export const SONGS: Record<string, { root: number; bpm: number; notes: number[]; bass: number[] }> = {
  riverside: { root: 392, bpm: 92, notes: [0, 2, 4, 7, 9, 7, 4, -1, 2, 4, 2, 0, -3, 0, -1, -1, 0, 2, 4, 9, 7, 9, 12, -1, 9, 7, 4, 2, 4, -1, 0, -1], bass: [0, -5, -3, -5] },
  bicycle: { root: 440, bpm: 120, notes: [7, -1, 7, 9, 7, 4, 2, -1, 4, -1, 4, 7, 4, 2, 0, -1, 2, 4, 7, 4, 2, 0, -3, -1, 0, 2, 0, -3, -5, -1, 0, -1], bass: [0, 0, -5, -5] },
  monsoon: { root: 349, bpm: 84, notes: [0, -1, 4, 7, -1, 4, 9, -1, 7, 4, -1, 2, 0, -1, -1, -1, 2, -1, 4, 9, -1, 7, 12, -1, 9, 7, -1, 4, 2, -1, -1, -1], bass: [0, -3, -5, -3] },
  peach: { root: 466, bpm: 132, notes: [0, 4, 7, 9, 12, 9, 7, 4, 2, 4, 7, 4, 2, 0, -3, 0, 0, 4, 7, 9, 12, 14, 12, 9, 7, 9, 7, 4, 2, 0, 0, -1], bass: [0, -5, -3, -7] },
};
