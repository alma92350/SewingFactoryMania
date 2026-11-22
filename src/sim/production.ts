import { chance } from '../core/rng';
import { PRODUCTS } from '../data/products';
import { bestStationFor, sendRework } from './orders';
import { stepCutting } from './sourcing';
import { mentoring, moraleDefects } from './morale';
import {
  activeOrder,
  opDef,
  orderById,
  stationEfficiency,
  stationStopped,
  traitDefects,
  traitFatigue,
  traitLearning,
  workerById,
} from './selectors';
import type { Bundle, DefectCause, GameState, Order, SimEvent, Station, Worker } from './types';

/**
 * Defect chance per piece at a station (PRD D4): every factor is visible to the player
 * (skill pips, learning %, machine wear, fatigue), so every defect has a cause you could have seen.
 */
export function defectTerms(s: GameState, st: Station, w: Worker): { p: number; skill: number; learn: number; wear: number; fatigue: number } {
  const t = s.tuning;
  const op = opDef(st.opId!);
  const learn = w.learn[st.opId!] ?? t.learnStart;
  const skill = 1 + t.defectSkill * Math.max(0, 1 - w.skill[st.machine]);
  const lrn = 1 + t.defectLearn * Math.max(0, 1 - learn);
  const wear = 1 + t.defectWear * st.wear;
  const fatigue = 1 + t.fatigueDefects * w.fatigue;
  const order = activeOrder(s, st.line);
  const p = op.risk * skill * lrn * wear * fatigue * traitDefects(w) * s.mods.defects * (order?.sampleFactor ?? 1) * moraleDefects(s, w);
  return { p, skill, learn: lrn, wear, fatigue };
}

function recordCause(o: Order, opId: string, w: Worker, n: number, terms: ReturnType<typeof defectTerms>): void {
  const c: DefectCause = (o.causes[opId] ??= { count: 0, skill: 0, learn: 0, wear: 0, fatigue: 0, fabric: 0, byWorker: {} });
  c.fabric ??= 0;
  c.count += n;
  // attribute each defect to the factors in proportion to how much they raised the risk
  const ex = { skill: terms.skill - 1, learn: terms.learn - 1, wear: terms.wear - 1, fatigue: terms.fatigue - 1 };
  const total = ex.skill + ex.learn + ex.wear + ex.fatigue || 1;
  c.skill += (n * ex.skill) / total;
  c.learn += (n * ex.learn) / total;
  c.wear += (n * ex.wear) / total;
  c.fatigue += (n * ex.fatigue) / total;
  c.byWorker[w.id] = (c.byWorker[w.id] ?? 0) + n;
}

export function stepStation(s: GameState, st: Station, events: SimEvent[]): void {
  if (stationStopped(s, st) || st.opId === null) return;
  if (st.machine === 'cutting') return stepCutting(s, st);
  const w = workerById(s, st.workerId);
  if (!w || w.arriveAt > s.minute || w.absent) return;

  if (!st.current) {
    if (st.pile.length > 0) st.current = st.pile.shift()!;
    else {
      const o = activeOrder(s, st.line);
      const first = o ? PRODUCTS[o.product]!.ops[0]!.id : null;
      if (o && o.status === 'active' && st.opId === first && o.cut > 0 && o.sampled) {
        o.cut -= 1;
        st.current = { id: s.nextId++, orderId: o.id, pieces: s.tuning.bundleSize, done: 0, defects: 0, origins: {}, rework: false, pAcc: 0, fabric: o.cutFabric.shift() };
      } else return;
    }
  }

  const op = opDef(st.opId);
  const b = st.current;
  const smv = op.smv * (b.rework ? s.tuning.reworkFactor : 1);
  const rate = stationEfficiency(s, st) / smv;
  const made = Math.min(rate, b.pieces - b.done);
  b.done += made;
  st.output += made;
  w.learn[op.id] = Math.min(1, (w.learn[op.id] ?? 0) + made * s.tuning.learnPerPiece * traitLearning(w) * mentoring(s, w, st.machine, made));
  st.wear = Math.min(1, st.wear + made * s.tuning.wearPerPiece);
  const overtime = s.minute >= s.tuning.shiftEnd;
  w.fatigue = Math.min(1, w.fatigue + s.tuning.fatiguePerMinute * (overtime ? s.tuning.overtimeFatigue : 1) * traitFatigue(w) * (s.welfare.fans ? 0.7 : 1));
  if (op.machine !== 'qc') b.pAcc += defectTerms(s, st, w).p * made;

  if (b.done >= b.pieces - 1e-9) {
    st.current = null;
    if (op.machine === 'qc') finishQc(s, st, w, b, events);
    else {
      drawDefects(s, st, w, b);
      route(s, st, b, events);
    }
  }

  if (chance(s.rng, s.tuning.breakBase * (1 + st.wear * s.tuning.wearFactor) * s.mods.breakdowns)) {
    st.broken = true;
    s.stats.breakdowns += 1;
    s.stats.dayBreakdowns += 1;
    events.push({ kind: 'broke', station: st.index });
  }
}

function drawDefects(s: GameState, st: Station, w: Worker, b: Bundle): void {
  if (b.fabric && b.fabric !== 'good') fabricDefects(s, w, b);
  const p = b.pAcc / b.pieces;
  b.pAcc = 0;
  let n = 0;
  for (let i = b.defects; i < b.pieces; i++) if (chance(s.rng, p)) n += 1;
  if (n === 0) return;
  b.defects += n;
  st.defects += n;
  b.origins[st.opId!] = (b.origins[st.opId!] ?? 0) + n;
  const o = orderById(s, b.orderId);
  if (o) recordCause(o, st.opId!, w, n, defectTerms(s, st, w));
}

/** Garments go to the QC table only when someone sits there; otherwise they are packed unchecked. */
/** Off-shade rolls spoil every piece; flawed rolls raise the risk. Both are traced to the fabric. */
function fabricDefects(s: GameState, w: Worker, b: Bundle): void {
  let n = 0;
  if (b.fabric === 'offShade') n = b.pieces - b.defects;
  else for (let i = b.defects; i < b.pieces; i++) if (chance(s.rng, s.tuning.flawedRisk)) n += 1;
  b.fabric = 'good';
  if (n === 0) return;
  b.defects += n;
  b.origins.fabric = (b.origins.fabric ?? 0) + n;
  const o = orderById(s, b.orderId);
  if (!o) return;
  const c: DefectCause = (o.causes.fabric ??= { count: 0, skill: 0, learn: 0, wear: 0, fatigue: 0, fabric: 0, byWorker: {} });
  c.count += n;
  c.fabric = (c.fabric ?? 0) + n;
  c.byWorker[w.id] = (c.byWorker[w.id] ?? 0) + n;
}

function qcStationExists(s: GameState, line: number): boolean {
  return s.stations.some((st) => st.line === line && st.opId === 'qc' && st.workerId !== null && !workerById(s, st.workerId)?.absent);
}

function route(s: GameState, from: Station, b: Bundle, events: SimEvent[]): void {
  const o = orderById(s, b.orderId);
  if (!o) return;
  const ops = PRODUCTS[o.product]!.ops;
  const idx = ops.findIndex((x) => x.id === from.opId);
  const next = b.rework ? undefined : ops[idx + 1];
  if (next) {
    const target = bestStationFor(s, next.id, null, from.line);
    if (target) {
      target.pile.push({ ...b, done: 0, pAcc: 0 });
      events.push({ kind: 'bundleDone', station: from.index, to: target.index });
      return;
    }
  }
  if (qcStationExists(s, from.line)) {
    const qc = bestStationFor(s, 'qc', null, from.line)!;
    qc.pile.push({ ...b, done: 0, pAcc: 0 });
    events.push({ kind: 'bundleDone', station: from.index, to: qc.index });
    return;
  }
  pack(s, o, b);
  events.push({ kind: 'bundleDone', station: from.index, to: null });
}

function pack(s: GameState, o: Order, b: Bundle): void {
  o.finished += b.pieces;
  o.lotDefects += b.defects;
  for (const [opId, n] of Object.entries(b.origins)) o.lotOrigins[opId] = (o.lotOrigins[opId] ?? 0) + n;
  s.stats.dayPieces += b.pieces;
}

/** The QC table catches defects (by skill and learning) and sends them back to the operation that caused them. */
function finishQc(s: GameState, st: Station, w: Worker, b: Bundle, events: SimEvent[]): void {
  const o = orderById(s, b.orderId);
  if (!o) return;
  const catchRate = Math.min(0.97, s.tuning.qcCatch * w.skill.qc * (w.learn.qc ?? s.tuning.learnStart) * 1.25);
  const caught: Record<string, number> = {};
  let total = 0;
  for (const [opId, n] of Object.entries(b.origins)) {
    let c = 0;
    for (let i = 0; i < n; i++) if (chance(s.rng, catchRate)) c += 1;
    if (c > 0) {
      caught[opId] = c;
      total += c;
    }
  }
  const good: Bundle = { ...b, pieces: b.pieces - total, defects: b.defects - total, origins: { ...b.origins } };
  for (const [opId, c] of Object.entries(caught)) good.origins[opId] = (good.origins[opId] ?? 0) - c;
  if (good.pieces > 0) pack(s, o, good);
  for (const [opId, c] of Object.entries(caught)) sendRework(s, o.id, opId, c);
  o.caughtByQc += total;
  events.push({ kind: 'bundleDone', station: st.index, to: null });
}
