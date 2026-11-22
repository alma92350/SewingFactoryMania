import { BUYERS } from '../data/buyers';
import { CHAPTER_BY_ID, type SystemId } from '../data/chapters';
import { TRAITS } from '../data/people';
import { ALL_OPS, PRODUCTS, type OperationDef } from '../data/products';
import type { GameState, Order, Station, Worker } from './types';
import { powerStops } from './power';

/** The bench sits beside the middle of the line, for walking distances. */
export function benchPos(s: GameState): number {
  return Math.floor(s.stations.length / 2);
}

export function posOf(s: GameState, station: number | null): number {
  return station === null ? benchPos(s) : station;
}

export function walkMinutes(s: GameState, from: number, to: number): number {
  return Math.max(1, Math.round(Math.abs(from - to) * s.tuning.walkPerStation));
}

export function has(s: GameState, sys: SystemId): boolean {
  return s.systems.includes(sys);
}

export function chapterOf(s: GameState) {
  return CHAPTER_BY_ID[s.chapterId]!;
}

export function opDef(id: string): OperationDef {
  return ALL_OPS[id]!;
}

export function workerById(s: GameState, id: string | null): Worker | undefined {
  return id === null ? undefined : s.workers.find((w) => w.id === id);
}

export function activeOrder(s: GameState, line = 0): Order | undefined {
  const id = s.lines[line]?.activeOrderId;
  return id === null || id === undefined ? undefined : s.orders.find((o) => o.id === id);
}

export function orderById(s: GameState, id: number): Order | undefined {
  return s.orders.find((o) => o.id === id);
}

export function isLunch(s: GameState): boolean {
  return s.minute >= s.tuning.lunchStart && s.minute < s.tuning.lunchEnd;
}

export function shiftEndMinute(s: GameState): number {
  return s.overtime ? s.tuning.overtimeEnd : s.tuning.shiftEnd;
}

export function hasBlockingDecision(s: GameState): boolean {
  return s.decisions.length > 0;
}

function traitProduct(w: Worker, key: 'speed' | 'defects' | 'learning' | 'fatigue'): number {
  return w.traits.reduce((a, t) => a * TRAITS[t][key], 1);
}

export function traitSpeed(w: Worker): number {
  return traitProduct(w, 'speed');
}
export function traitDefects(w: Worker): number {
  return traitProduct(w, 'defects');
}
export function traitLearning(w: Worker): number {
  return traitProduct(w, 'learning');
}
export function traitFatigue(w: Worker): number {
  return traitProduct(w, 'fatigue');
}

function radioBonus(s: GameState, st: Station): number {
  for (const d of [-1, 1]) {
    const n = s.stations[st.index + d];
    const w = n ? workerById(s, n.workerId) : undefined;
    if (w && w.traits.includes('radio') && w.arriveAt <= s.minute) return 1.05;
  }
  return 1;
}

/** Efficiency (0..1+) of the station's worker on its operation, ignoring walking and breakdowns. */
export function stationEfficiency(s: GameState, st: Station): number {
  const w = workerById(s, st.workerId);
  if (!w || st.opId === null) return 0;
  const learn = w.learn[st.opId] ?? s.tuning.learnStart;
  return w.skill[st.machine] * learn * (1 - s.tuning.fatigueSpeed * w.fatigue) * traitSpeed(w) * radioBonus(s, st);
}

export function stationStopped(s: GameState, st: Station): boolean {
  return st.broken || st.serviceUntil > s.minute || powerStops(s, st.machine);
}

/** Pieces per hour this station can make right now (0 if stopped, empty or walking). */
export function stationRate(s: GameState, st: Station): number {
  if (stationStopped(s, st) || st.opId === null) return 0;
  const w = workerById(s, st.workerId);
  if (!w || w.arriveAt > s.minute) return 0;
  return (60 * stationEfficiency(s, st)) / opDef(st.opId).smv;
}

export function isWorking(s: GameState, st: Station): boolean {
  return s.phase === 'shift' && !isLunch(s) && !hasBlockingDecision(s) && st.current !== null && stationRate(s, st) > 0;
}

export function productOps(s: GameState, line = 0): OperationDef[] {
  const o = activeOrder(s, line);
  return o ? PRODUCTS[o.product]!.ops : [];
}

/** Capacity per operation of the active product (pieces/hour), summing every station on it. */
export function opCapacities(s: GameState, line = 0): Record<string, number> {
  const cap: Record<string, number> = {};
  for (const op of productOps(s, line)) cap[op.id] = 0;
  for (const st of s.stations) if (st.line === line && st.opId !== null && st.opId in cap) cap[st.opId]! += stationRate(s, st);
  return cap;
}

export function bottleneck(s: GameState, line = 0): string | null {
  const cap = opCapacities(s, line);
  const ids = Object.keys(cap);
  if (ids.length === 0) return null;
  return ids.reduce((a, b) => (cap[b]! < cap[a]! ? b : a));
}

/** Line output now in pieces/hour (the bottleneck). */
export function lineRate(s: GameState, line = 0): number {
  const cap = Object.values(opCapacities(s, line));
  return cap.length ? Math.min(...cap) : 0;
}

export function workMinutesLeftToday(s: GameState): number {
  const end = shiftEndMinute(s);
  let left = end - s.minute;
  if (s.minute < s.tuning.lunchStart) left -= s.tuning.lunchEnd - s.tuning.lunchStart;
  else if (s.minute < s.tuning.lunchEnd) left -= s.tuning.lunchEnd - s.minute;
  return Math.max(0, left);
}

export function workMinutesPerDay(s: GameState): number {
  return s.tuning.shiftEnd - s.tuning.shiftStart - (s.tuning.lunchEnd - s.tuning.lunchStart);
}

/** Projected finish for an order at the current line rate: game day (fractional) or Infinity. */
export function projectedFinishDay(s: GameState, o: Order, margin = 1): number {
  const rate = (lineRate(s, o.line) / 60) * margin;
  if (rate <= 0) return Infinity;
  let piecesAhead = o.qty - o.finished;
  for (const q of s.orders) {
    if (q.id === o.id) break;
    if (q.line === o.line && (q.status === 'active' || q.status === 'queued')) piecesAhead += q.qty - q.finished;
  }
  let minutes = piecesAhead / rate;
  const today = workMinutesLeftToday(s);
  if (minutes <= today) return s.day;
  minutes -= today;
  return s.day + Math.ceil(minutes / workMinutesPerDay(s));
}

/** Simple projection for Chapter 0: pieces finished by shift end at the current rate. */
export function projectionToday(s: GameState): number {
  const o = activeOrder(s);
  return Math.round((o?.finished ?? 0) + (workMinutesLeftToday(s) * lineRate(s)) / 60);
}

export function orderValue(o: Order, pieces = o.qty): number {
  return (pieces / 12) * o.price;
}

export function dailyWages(s: GameState): number {
  return s.workers.filter((w) => !w.absent).reduce((a, w) => a + w.wage, 0);
}

export function lineEfficiency(s: GameState): number {
  const start = s.tuning.shiftStart;
  const worked = Math.min(s.minute, shiftEndMinute(s)) - start;
  const lunch = Math.max(0, Math.min(s.minute, s.tuning.lunchEnd) - s.tuning.lunchStart);
  const people = s.workers.filter((w) => !w.absent && w.role === 'operator').length || 1;
  const minutes = Math.max(1, worked - lunch) * people;
  let earned = 0;
  for (const st of s.stations) if (st.opId && st.machine !== 'qc') earned += st.output * opDef(st.opId).smv;
  return earned / minutes;
}

export function inspectionLevel(o: Order): string {
  return BUYERS[o.buyer]!.inspection;
}

/** Simplified AQL: sample size by lot, accept number by strictness (PRD D4). */
export function aqlPlan(lot: number, strictness: string, shift: number): { sample: number; accept: number } {
  const sample = lot <= 150 ? 20 : lot <= 500 ? 50 : lot <= 1200 ? 80 : 125;
  const table: Record<string, Record<number, number>> = {
    strict: { 20: 0, 50: 1, 80: 2, 125: 3 },
    normal: { 20: 1, 50: 3, 80: 5, 125: 7 },
    relaxed: { 20: 2, 50: 5, 80: 7, 125: 10 },
  };
  const accept = Math.max(0, (table[strictness]?.[sample] ?? 99) + shift);
  return { sample: Math.min(sample, lot), accept };
}

export function clockLabel(minute: number): string {
  const h = Math.floor(minute / 60);
  const m = minute % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function dayLabel(day: number): string {
  return `${DAY_NAMES[(day - 1) % 6]} · day ${day}`;
}

/** Things the player could act on right now (for the quiet-time metric and the HUD). */
export function actionable(s: GameState): boolean {
  if (s.decisions.length) return true;
  for (const st of s.stations) {
    if (st.broken && !s.repairQueue.includes(st.index) && !s.agents.some((a) => a.target === st.index)) return true;
    if (st.pile.length >= 4) return true;
  }
  const emptySeat = s.stations.some((st) => st.opId !== null && st.workerId === null);
  if (emptySeat && s.workers.some((w) => w.role !== 'mechanic' && w.station === null && !w.absent)) return true;
  return false;
}
