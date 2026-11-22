/** Local persistence. Every access is guarded: storage can be missing or blocked. */
import type { DifficultyId } from '../data/difficulty';
import type { GameState } from '../sim/types';

export interface Progress {
  stars: Record<string, number>;
  campaign: Record<string, string>;
  difficulty: DifficultyId;
  sound: boolean;
  seenTips: string[];
  /** Display mode chosen by the player (undefined = auto-detect). */
  eink?: boolean;
  /** Language chosen by the player (undefined = from the browser). */
  lang?: 'en' | 'vi';
  achievements?: string[];
  /** Best Daily Challenge score by daily id. */
  dailyBest?: Record<string, number>;
  /** Most days survived in the Sandbox. */
  sandboxBest?: number;
  /** Opt-in local play log. */
  log?: boolean;
}

const PROGRESS_KEY = 'sfm.progress.v1';
const SAVE_KEY = 'sfm.save.v3';

export function loadProgress(): Progress {
  const fallback: Progress = { stars: {}, campaign: {}, difficulty: 'seamstress', sound: true, seenTips: [] };
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    return raw ? { ...fallback, ...(JSON.parse(raw) as Partial<Progress>) } : fallback;
  } catch {
    return fallback;
  }
}

export function saveProgress(p: Progress): void {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable: progress lives for this session only */
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as GameState;
    return s.version === 2 ? s : null;
  } catch {
    return null;
  }
}

export function saveGame(s: GameState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

export function clearGame(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}
