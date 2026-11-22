import { OPERATIONS } from '../data/prototype';
import type { GameState, Station, Worker } from './types';

export const OP_INDEX: Record<string, number> = Object.fromEntries(OPERATIONS.map((o, i) => [o.id, i]));
export const OP_BY_ID = Object.fromEntries(OPERATIONS.map((o) => [o.id, o]));
export const TOTAL_SMV = OPERATIONS.reduce((a, o) => a + o.smv, 0);

/** The bench sits beside the middle of the line, for walking distances. */
export const BENCH_POS = 3;

export function posOf(station: number | null): number {
  return station === null ? BENCH_POS : station;
}

export function walkMinutes(s: GameState, from: number, to: number): number {
  return Math.max(1, Math.round(Math.abs(from - to) * s.tuning.walkPerStation));
}

export function workerById(s: GameState, id: string | null): Worker | undefined {
  return id === null ? undefined : s.workers.find((w) => w.id === id);
}

export function isLunch(s: GameState): boolean {
  return s.minute >= s.tuning.lunchStart && s.minute < s.tuning.lunchEnd;
}

/** Efficiency (0..1) of the station's worker on its current operation, ignoring walking and breakdowns. */
export function stationEfficiency(s: GameState, st: Station): number {
  const w = workerById(s, st.workerId);
  if (!w || st.opId === null) return 0;
  return w.skill[st.machine] * (w.learn[st.opId] ?? s.tuning.learnStart);
}

/** Pieces per hour this station can make right now (0 if broken, empty or walking). */
export function stationRate(s: GameState, st: Station): number {
  if (st.broken || st.opId === null) return 0;
  const w = workerById(s, st.workerId);
  if (!w || w.arriveAt > s.minute) return 0;
  return (60 * stationEfficiency(s, st)) / OP_BY_ID[st.opId]!.smv;
}

export function isWorking(s: GameState, st: Station): boolean {
  return !isLunch(s) && !s.ended && st.current !== null && stationRate(s, st) > 0;
}

/** Capacity per operation (pieces/hour), summing every station assigned to it. */
export function opCapacities(s: GameState): Record<string, number> {
  const cap: Record<string, number> = {};
  for (const op of OPERATIONS) cap[op.id] = 0;
  for (const st of s.stations) if (st.opId !== null) cap[st.opId]! += stationRate(s, st);
  return cap;
}

/** The operation with the lowest capacity: it sets the speed of the whole line. */
export function bottleneck(s: GameState): string {
  const cap = opCapacities(s);
  let best = OPERATIONS[0]!.id;
  for (const op of OPERATIONS) if (cap[op.id]! < cap[best]!) best = op.id;
  return best;
}

export function waitingBundles(st: Station): number {
  return st.pile.length;
}

export function stars(s: GameState): number {
  return s.tuning.stars.filter((t) => s.finished >= t).length;
}

/** Earned minutes / available minutes for the people on the line. */
export function lineEfficiency(s: GameState): number {
  const worked = Math.min(s.minute, s.tuning.shiftEnd) - s.tuning.shiftStart;
  const lunch = Math.max(0, Math.min(s.minute, s.tuning.lunchEnd) - s.tuning.lunchStart);
  const minutes = Math.max(1, worked - lunch) * s.workers.length;
  let earned = 0;
  for (const st of s.stations) if (st.opId) earned += st.output * OP_BY_ID[st.opId]!.smv;
  return earned / minutes;
}

/** Simple projection: pieces finished by shift end at the current line rate. */
export function projection(s: GameState): number {
  const cap = opCapacities(s);
  const rate = Math.min(...Object.values(cap)) / 60;
  let left = s.tuning.shiftEnd - s.minute;
  if (s.minute < s.tuning.lunchStart) left -= s.tuning.lunchEnd - s.tuning.lunchStart;
  else if (s.minute < s.tuning.lunchEnd) left -= s.tuning.lunchEnd - s.minute;
  return Math.round(s.finished + Math.max(0, left) * rate);
}

export function clockLabel(minute: number): string {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
