import { applyCommand } from './commands';
import {
  activeOrder,
  bottleneck,
  dailyWages,
  has,
  lineRate,
  opCapacities,
  opDef,
  orderById,
  projectedFinishDay,
  stationRate,
  workMinutesPerDay,
} from './selectors';
import type { GameState } from './types';

export interface BotConfig {
  /** Option picked on quote faxes (index into the options), clamped. */
  quote?: number;
  /** Family choices by flag. Default: the first option. */
  family?: Record<string, string>;
  /** When false the bot never hires (to measure what hiring is worth). */
  hire?: boolean;
}

/**
 * A "competent player" for balance tests. Reacts every 5 game minutes and answers every card.
 * It never does clever swaps or reads defect causes: ★★★ should need a human.
 */
export function makeBot(cfg: BotConfig = {}) {
  return (s: GameState): number => {
    let actions = 0;
    const act = (r: { ok: boolean }) => (r.ok ? (actions += 1) : 0);

    for (const d of [...s.decisions]) act(applyCommand(s, { type: 'decide', decision: d.id, option: answer(s, d.id, cfg) }));
    if (s.phase !== 'shift' || s.minute % 5 !== 0) return actions;

    for (const st of s.stations) if (st.broken) act(applyCommand(s, { type: 'fix', station: st.index }));

    if (has(s, 'hiring') && cfg.hire !== false) hireIfNeeded(s, act);

    // seat whoever is on the bench
    for (const w of s.workers) {
      if (w.station !== null || w.absent || w.role === 'mechanic' || w.arriveAt > s.minute) continue;
      const qc = s.stations.find((st) => st.machine === 'qc' && st.workerId === null);
      if (w.role === 'qc' && qc) {
        act(applyCommand(s, { type: 'assign', workerId: w.id, station: qc.index }));
        continue;
      }
      const empty = s.stations
        .filter((st) => st.workerId === null && st.opId !== null && st.machine !== 'qc')
        .sort((a, b) => b.pile.length - a.pile.length)[0];
      if (empty) act(applyCommand(s, { type: 'assign', workerId: w.id, station: empty.index }));
    }

    coverEmptySteps(s, act);
    if (s.minute % 60 === 0) rebalance(s, act);

    const o = activeOrder(s);
    if (o && has(s, 'orders') && s.minute === 15 * 60 && !s.overtime) {
      const due = Math.min(...s.orders.filter((q) => q.status === 'active' || q.status === 'queued').map((q) => q.dueDay));
      const late = s.orders.some((q) => (q.status === 'active' || q.status === 'queued') && projectedFinishDay(s, q) > q.dueDay);
      if (late && s.day <= due) act(applyCommand(s, { type: 'overtime', on: true }));
    }
    return actions;
  };
}

export function answer(s: GameState, id: number, cfg: BotConfig = {}): string {
  const d = s.decisions.find((x) => x.id === id)!;
  switch (d.kind) {
    case 'fax': {
      const n = d.fax!.options.length;
      return String(Math.min(n - 1, cfg.quote ?? Math.floor(n / 2)));
    }
    case 'family':
      return cfg.family?.[d.flag!] ?? d.options[0]!.id;
    case 'cutoff': {
      const o = orderById(s, d.orderId!)!;
      const capacity = (lineRate(s) / 60) * workMinutesPerDay(s) * 2;
      return capacity >= o.qty - o.finished ? 'air' : 'short';
    }
    case 'inspection':
      return d.options.some((o) => o.id === 'ship') ? 'ship' : 'recheck';
    case 'change':
      return 'accept';
    case 'sample':
      return 'skip';
    default:
      return d.options[0]!.id;
  }
}

function hireIfNeeded(s: GameState, act: (r: { ok: boolean }) => number): void {
  const seats = s.stations.filter((st) => st.machine !== 'qc' && st.opId !== null).length;
  const sewers = s.workers.filter((w) => w.role === 'operator' && !w.absent).length;
  const budget = s.cash - dailyWages(s) * 2;
  const pickBest = (role: string) =>
    s.applicants.filter((a) => a.role === role).sort((a, b) => b.skill.lockstitch + b.skill.overlock - (a.skill.lockstitch + a.skill.overlock))[0];
  if (has(s, 'mechanic') && !s.workers.some((w) => w.role === 'mechanic')) {
    const m = pickBest('mechanic');
    if (m && budget > m.wage * 3) act(applyCommand(s, { type: 'hire', applicant: m.id }));
  }
  if (has(s, 'quality') && !s.workers.some((w) => w.role === 'qc')) {
    const q = pickBest('qc');
    if (q && budget > q.wage * 3) act(applyCommand(s, { type: 'hire', applicant: q.id }));
  }
  if (sewers < seats) {
    const a = pickBest('operator');
    if (a && budget > a.wage * 3) act(applyCommand(s, { type: 'hire', applicant: a.id }));
  }
}

/** A step with no staffed machine stops the whole line: move someone from a doubled-up step. */
function coverEmptySteps(s: GameState, act: (r: { ok: boolean }) => number): void {
  const staffed = (opId: string) => s.stations.filter((st) => st.opId === opId && st.workerId !== null);
  for (const opId of Object.keys(opCapacities(s))) {
    if (staffed(opId).length > 0) continue;
    const empty = s.stations.find((st) => st.opId === opId && st.workerId === null);
    if (!empty) continue;
    const donor = s.stations.find((st) => st.machine === empty.machine && st.opId !== null && st.opId !== opId && staffed(st.opId).length >= 2 && st.workerId !== null);
    if (donor) act(applyCommand(s, { type: 'assign', workerId: donor.workerId!, station: empty.index }));
  }
}

/** Point a machine with spare capacity at the bottleneck (same machine type only). */
function rebalance(s: GameState, act: (r: { ok: boolean }) => number): void {
  const neck = bottleneck(s);
  if (!neck) return;
  const cap = opCapacities(s);
  const machine = opDef(neck).machine;
  const idle = s.stations.find((st) => st.machine === machine && st.opId === null);
  if (idle) {
    act(applyCommand(s, { type: 'setOp', station: idle.index, opId: neck }));
    return;
  }
  let best: { index: number; spare: number } | null = null;
  for (const st of s.stations) {
    if (st.machine !== machine || st.opId === null || st.opId === neck || !(st.opId in cap)) continue;
    const others = s.stations.filter((x) => x.opId === st.opId).length;
    if (others < 2) continue;
    const spare = cap[st.opId]! - stationRate(s, st) - cap[neck]! * 1.15;
    if (spare > 0 && (!best || spare > best.spare)) best = { index: st.index, spare };
  }
  if (best) act(applyCommand(s, { type: 'setOp', station: best.index, opId: neck }));
}
