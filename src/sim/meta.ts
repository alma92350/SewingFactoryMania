/**
 * Meta progression (PRD §16): Daily Challenge calibration, achievements, career titles.
 * Everything here is pure and deterministic; the UI stores the results in local progress.
 */
import { CHAPTER_BY_ID, CHAPTERS } from '../data/chapters';
import { dailyDef, dailyNumber } from '../data/generated';
import { makeBot } from './autopilot';
import { stars } from './objectives';
import { runChapter } from './sim';
import { createChapter } from './state';
import type { GameState } from './types';

/** Build today's Daily Challenge and set its star goals from a bot run on the same seed. */
export function prepareDaily(dateKey: number) {
  const def = dailyDef(dateKey);
  CHAPTER_BY_ID[def.id] = def;
  if (!def.scoreStars) {
    const s = createChapter(def.id, dateKey);
    runChapter(s, makeBot());
    const p = s.orders.reduce((a, o) => a + o.finished, 0);
    const r = (v: number) => Math.max(10, Math.round(v / 10) * 10);
    def.scoreStars = [r(p * 0.8), r(p * 1.02), r(p * 1.15)];
    def.starText = def.scoreStars.map((n) => `Pack ${n} pieces`) as [string, string, string];
  }
  return def;
}

export function shareLine(s: GameState): string {
  const ch = CHAPTER_BY_ID[s.chapterId]!;
  const n = stars(s);
  const pieces = s.orders.reduce((a, o) => a + o.finished, 0);
  const key = Number(s.chapterId.slice(6));
  return `SewingFactoryMania #${dailyNumber(key)} ${'★'.repeat(n)}${'☆'.repeat(3 - n)} ${pieces} pieces 🧵 ${ch.modifier?.emoji ?? ''}`.trim();
}

export interface AchievementDef {
  id: string;
  name: string;
  text: string;
  check: (s: GameState) => boolean;
}

const avgMorale = (s: GameState) => s.workers.reduce((a, w) => a + w.morale, 0) / Math.max(1, s.workers.length);

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'doors', name: 'Doors Open', text: 'Finish Chapter 0.', check: (s) => s.chapterId === 'ch0' && stars(s) >= 1 },
  { id: 'balance', name: 'Perfect Balance', text: 'A day with line efficiency of 85% or more.', check: (s) => s.history.some((h) => h.efficiency >= 0.85) },
  {
    id: 'watanabe',
    name: 'Watanabe Smiled',
    text: 'Pass a strict inspection on the first try.',
    check: (s) => s.orders.some((o) => o.buyer === 'sakuraya' && o.inspections[0]?.passed === true),
  },
  { id: 'sharp', name: 'Sharp Eyes', text: 'Find all three differences in a sample check.', check: (s) => s.stats.perfectSample },
  { id: 'marker', name: 'Marker Master', text: 'Lay a marker of 90% or more.', check: (s) => s.stats.bestMarker >= 0.9 },
  {
    id: 'home',
    name: 'Home by 16:30',
    text: 'Finish a chapter with orders and no overtime, with at least one star.',
    check: (s) => s.systems.includes('orders') && s.stats.overtimeDays === 0 && stars(s) >= 1 && !CHAPTER_BY_ID[s.chapterId]?.generator,
  },
  { id: 'monsoon', name: 'Monsoon Proof', text: 'Finish Chapter 4 with under 30 minutes lost to power cuts.', check: (s) => s.chapterId === 'ch4' && (s.power?.minutesLost ?? 99) < 30 && stars(s) >= 1 },
  { id: 'back', name: 'Everyone Came Back', text: 'Everyone returns after Tết.', check: (s) => !!s.tet && s.tet.returned > 0 && s.tet.left.length === 0 },
  {
    id: 'fair',
    name: 'Fair Boss',
    text: 'Finish Chapter 5 or 6 with average morale of 90% or more and nobody quitting.',
    check: (s) => (s.chapterId === 'ch5' || s.chapterId === 'ch6') && avgMorale(s) >= 0.9 && s.stats.quits === 0,
  },
  { id: 'neighbour', name: 'Good Neighbour', text: 'Close the factory to help in the flood.', check: (s) => s.campaign['ch4.flood'] === 'help' },
  { id: 'legend', name: 'Legend', text: 'Earn ★★★ in any chapter.', check: (s) => stars(s) === 3 && !CHAPTER_BY_ID[s.chapterId]?.generator },
  { id: 'zone', name: 'Export Zone', text: 'Finish Chapter 6 with at least one star.', check: (s) => s.chapterId === 'ch6' && stars(s) >= 1 },
  { id: 'daily', name: 'Daily Seamstress', text: 'Finish a Daily Challenge with at least one star.', check: (s) => s.chapterId.startsWith('daily-') && stars(s) >= 1 },
  { id: 'tendays', name: 'Ten Days', text: 'Survive ten days in the Sandbox.', check: (s) => s.chapterId.startsWith('sandbox-') && s.history.length >= 10 },
  { id: 'storm', name: 'After the Storm', text: 'Finish Chapter 7 with at least one star.', check: (s) => s.chapterId === 'ch7' && stars(s) >= 1 },
  { id: 'nobody', name: 'Nobody Left Behind', text: 'Finish Chapter 7 without letting anyone go.', check: (s) => s.chapterId === 'ch7' && stars(s) >= 1 && (s.stats.layoffs ?? 0) === 0 },
  { id: 'cat', name: 'The Cat Stays', text: 'Finish Chapter 7 with the factory cat.', check: (s) => s.chapterId === 'ch7' && stars(s) >= 1 && s.campaign.cat === 'adopt' },
  { id: 'thursday', name: 'The Ship Leaves Thursday', text: 'Earn a star on the hardest difficulty.', check: (s) => s.difficulty === 'thursday' && stars(s) >= 1 && !CHAPTER_BY_ID[s.chapterId]?.generator },
];

export function newAchievements(s: GameState, have: string[]): string[] {
  return ACHIEVEMENTS.filter((a) => !have.includes(a.id) && a.check(s)).map((a) => a.id);
}

export const CAREER = [
  { min: 0, title: 'Apprentice' },
  { min: 3, title: 'Line Leader' },
  { min: 8, title: 'Factory Manager' },
  { min: 13, title: 'Director' },
  { min: 18, title: 'Garment Tycoon' },
];

export function careerTitle(starsByChapter: Record<string, number>): { title: string; total: number; next: number | null } {
  const total = CHAPTERS.reduce((a, c) => a + (starsByChapter[c.id] ?? 0), 0);
  let title = CAREER[0]!.title;
  let next: number | null = null;
  for (const c of CAREER) {
    if (total >= c.min) title = c.title;
    else {
      next = c.min;
      break;
    }
  }
  return { title, total, next };
}
