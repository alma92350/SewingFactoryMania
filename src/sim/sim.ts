import { chance } from '../core/rng';
import { OPERATIONS } from '../data/prototype';
import { OP_BY_ID, OP_INDEX, stationEfficiency, walkMinutes, workerById } from './selectors';
import type { Bundle, GameState, SimEvent, Station } from './types';

/**
 * Advance the world by one game minute. System order is part of the contract:
 * director → sewing (pull, work, wear, breakdown, route) → clock.
 */
export function step(s: GameState): SimEvent[] {
  const events: SimEvent[] = [];
  if (s.ended) return events;
  const t = s.tuning;

  if (s.minute === t.lunchStart) events.push({ kind: 'lunch', start: true });
  if (s.minute === t.lunchEnd) events.push({ kind: 'lunch', start: false });

  stepDirector(s, events);

  const lunch = s.minute >= t.lunchStart && s.minute < t.lunchEnd;
  if (!lunch) for (const st of s.stations) stepStation(s, st, events);

  s.minute += 1;
  if (s.minute >= t.shiftEnd) {
    s.ended = true;
    events.push({ kind: 'ended' });
  }
  return events;
}

function stepDirector(s: GameState, events: SimEvent[]): void {
  const d = s.director;
  if (d.target !== null) {
    if (d.fixUntil === 0 && s.minute >= d.arriveAt) {
      d.pos = d.target;
      d.fixUntil = s.minute + s.tuning.fixMinutes;
    } else if (d.fixUntil > 0 && s.minute >= d.fixUntil) {
      const st = s.stations[d.target]!;
      st.broken = false;
      st.wear = 0;
      events.push({ kind: 'fixed', station: st.index });
      d.target = null;
      d.fixUntil = 0;
    }
  }
  if (d.target === null && d.queue.length > 0) {
    const next = d.queue.shift()!;
    d.target = next;
    d.leftAt = s.minute;
    d.arriveAt = s.minute + walkMinutes(s, d.pos, next);
    d.fixUntil = 0;
  }
}

function stepStation(s: GameState, st: Station, events: SimEvent[]): void {
  if (st.broken || st.opId === null) return;
  const w = workerById(s, st.workerId);
  if (!w || w.arriveAt > s.minute) return;

  if (!st.current) {
    if (st.pile.length > 0) st.current = st.pile.shift()!;
    else if (OP_INDEX[st.opId] === 0 && s.cutStack > 0) {
      s.cutStack -= 1;
      st.current = { id: s.nextBundleId++, pieces: s.tuning.bundleSize, done: 0 };
    } else return;
  }

  const op = OP_BY_ID[st.opId]!;
  const rate = stationEfficiency(s, st) / op.smv; // pieces per minute
  const b = st.current;
  const made = Math.min(rate, b.pieces - b.done);
  b.done += made;
  st.output += made;
  w.learn[op.id] = Math.min(1, (w.learn[op.id] ?? 0) + made * s.tuning.learnPerPiece);
  st.wear = Math.min(1, st.wear + made * s.tuning.wearPerPiece);

  if (b.done >= b.pieces - 1e-9) {
    st.current = null;
    routeBundle(s, st, b, events);
  }

  if (chance(s.rng, s.tuning.breakBase * (1 + st.wear * s.tuning.wearFactor))) {
    st.broken = true;
    s.breakdowns += 1;
    events.push({ kind: 'broke', station: st.index });
  }
}

/** Score for choosing where a bundle goes next: fewest waiting, avoid stopped stations. */
function loadScore(s: GameState, st: Station): number {
  const stopped = st.broken || st.workerId === null ? 100 : 0;
  return stopped + st.pile.length + (st.current ? 1 : 0);
}

export function bestStationFor(s: GameState, opId: string, exclude: number | null = null): Station | null {
  let best: Station | null = null;
  for (const st of s.stations) {
    if (st.opId !== opId || st.index === exclude) continue;
    if (!best || loadScore(s, st) < loadScore(s, best)) best = st;
  }
  return best;
}

function routeBundle(s: GameState, from: Station, b: Bundle, events: SimEvent[]): void {
  const nextOp = OPERATIONS[OP_INDEX[from.opId!]! + 1];
  if (!nextOp) {
    s.finished += b.pieces;
    events.push({ kind: 'bundleDone', station: from.index, to: null, pieces: b.pieces });
    return;
  }
  const target = bestStationFor(s, nextOp.id);
  if (!target) throw new Error(`no station for ${nextOp.id}`);
  target.pile.push({ id: b.id, pieces: b.pieces, done: 0 });
  events.push({ kind: 'bundleDone', station: from.index, to: target.index, pieces: b.pieces });
}

/** Run until the shift ends (or a minute limit), calling `each` before every step. */
export function runShift(s: GameState, each?: (s: GameState) => void, until = Infinity): SimEvent[] {
  const all: SimEvent[] = [];
  while (!s.ended && s.minute < until) {
    each?.(s);
    all.push(...step(s));
  }
  return all;
}
