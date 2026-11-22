import { applyCommand } from './commands';
import { coverEmptySteps, leaderPresent, rebalance, seatBench } from './leader';
export { coverEmptySteps, rebalance } from './leader';
import { buyMissingFabric } from './office';
import { bonusCost } from './morale';
import { activeOrder, dailyWages, has, lineRate, orderById, projectedFinishDay, workMinutesPerDay } from './selectors';
import type { GameState } from './types';

export interface BotConfig {
  /** Option picked on quote faxes (index into the options), clamped. */
  quote?: number;
  /** Family choices by flag. Default: the first option. */
  family?: Record<string, string>;
  /** When false the bot never hires (to measure what hiring is worth). */
  hire?: boolean;
  /** The exploiter: no welfare, no bonus, overtime every evening (the "fair play wins" test). */
  exploit?: boolean;
  /** Never hire line leaders (to measure what they save). */
  noLeaders?: boolean;
  /** Optional counter of balancing actions (seating, covering steps, retargeting machines). */
  balance?: { n: number };
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

    if (has(s, 'hiring') && cfg.hire !== false) hireIfNeeded(s, act, cfg);

    // leaders seat the bench on their own lines; the player only seats for unled lines
    const allLed = s.lines.every((l, i) => l.leaderId && leaderPresent(s, i));
    const bal = (r: { ok: boolean }) => {
      if (r.ok && cfg.balance) cfg.balance.n += 1;
      return act(r);
    };
    if (!allLed) seatBench(s, bal, null);

    // lines with a leader balance themselves (that is the point of hiring one)
    s.lines.forEach((l, line) => {
      if (l.leaderId && leaderPresent(s, line)) return;
      coverEmptySteps(s, bal, line);
      if (s.minute % 60 === 0) rebalance(s, bal, line);
    });
    if (has(s, 'leaders')) assignLeaders(s, act);

    if (has(s, 'sourcing') && s.minute % 30 === 0) buyFabricIfNeeded(s, act);
    if (has(s, 'power') && !s.pallets && s.cash > s.tuning.palletsCost + dailyWages(s) * 2) act(applyCommand(s, { type: 'pallets' }));
    if (has(s, 'morale') && !cfg.exploit) {
      for (const item of ['water', 'canteen', 'fans'] as const) {
        if (!s.welfare[item] && s.cash > s.tuning.welfareCost[item] + dailyWages(s) * 3) act(applyCommand(s, { type: 'welfare', item }));
      }
    }
    // after the shock, look for new customers while there is time and cash
    if (has(s, 'diversify') && s.macro && s.minute === 8 * 60) {
      for (const m of ['saigon', 'uniform', 'europe']) {
        if (s.cash > dailyWages(s) * 4) act(applyCommand(s, { type: 'prospect', market: m }));
      }
    }
    if (cfg.exploit && has(s, 'orders') && s.minute === 15 * 60 && !s.overtime) act(applyCommand(s, { type: 'overtime', on: true }));

    const o = activeOrder(s);
    if (o && has(s, 'orders') && s.minute === 15 * 60 && !s.overtime) {
      const due = Math.min(...s.orders.filter((q) => q.status === 'active' || q.status === 'queued').map((q) => q.dueDay));
      const late = s.orders.some((q) => (q.status === 'active' || q.status === 'queued') && projectedFinishDay(s, q, 0.85) > q.dueDay);
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
    case 'marker':
      return 'auto';
    case 'fabric':
      return 'cutter';
    case 'power':
      return 'start';
    case 'bonus':
      return !cfg.exploit && s.cash > bonusCost(s) + dailyWages(s) * 2 ? 'pay' : 'no';
    default:
      return d.options[0]!.id;
  }
}

function hireIfNeeded(s: GameState, act: (r: { ok: boolean }) => number, cfg: BotConfig): void {
  const seats = s.stations.filter((st) => st.machine !== 'qc' && st.machine !== 'cutting' && st.opId !== null).length;
  const sewers = s.workers.filter((w) => w.role === 'operator' && !w.absent).length;
  const budget = s.cash - dailyWages(s) * 2;
  const pickBest = (role: string) =>
    s.applicants.filter((a) => a.role === role).sort((a, b) => b.skill.lockstitch + b.skill.overlock - (a.skill.lockstitch + a.skill.overlock))[0];
  if (has(s, 'mechanic') && !s.workers.some((w) => w.role === 'mechanic')) {
    const m = pickBest('mechanic');
    if (m && budget > m.wage * 3) act(applyCommand(s, { type: 'hire', applicant: m.id }));
  }
  const qcTables = s.stations.filter((st) => st.machine === 'qc').length;
  if (has(s, 'quality') && s.workers.filter((w) => w.role === 'qc').length < qcTables) {
    const q = pickBest('qc');
    if (q && budget > q.wage * 3) act(applyCommand(s, { type: 'hire', applicant: q.id }));
  }
  if (has(s, 'power') && !s.workers.some((w) => w.role === 'electrician')) {
    const e = pickBest('electrician');
    if (e && budget > e.wage * 3) act(applyCommand(s, { type: 'hire', applicant: e.id }));
  }
  for (const role of ['planner', 'merchandiser'] as const) {
    const sys = role === 'planner' ? 'planning' : 'merchandising';
    if (has(s, sys) && !s.workers.some((w) => w.role === role)) {
      const p = pickBest(role);
      if (p && budget > p.wage * 3) act(applyCommand(s, { type: 'hire', applicant: p.id }));
    }
  }
  if (has(s, 'leaders') && !cfg.noLeaders && s.workers.filter((w) => w.role === 'leader').length < s.lines.length) {
    const l = pickBest('leader');
    if (l && budget > l.wage * 3) act(applyCommand(s, { type: 'hire', applicant: l.id }));
  }
  if (has(s, 'cutting') && !s.workers.some((w) => w.role === 'cutter')) {
    const c = pickBest('cutter');
    if (c && budget > c.wage * 3) act(applyCommand(s, { type: 'hire', applicant: c.id }));
  }
  if (sewers < seats) {
    const a = pickBest('operator');
    if (a && budget > a.wage * 3) act(applyCommand(s, { type: 'hire', applicant: a.id }));
  }
}

/** Buy the missing rolls (the same rule the Production Planner uses). */
function buyFabricIfNeeded(s: GameState, act: (r: { ok: boolean }) => number): void {
  for (let i = buyMissingFabric(s, 4); i > 0; i--) act({ ok: true });
}


/** Give every unled line a leader from the team. */
function assignLeaders(s: GameState, act: (r: { ok: boolean }) => number): void {
  for (const w of s.workers) {
    if (w.role !== 'leader' || s.lines.some((l) => l.leaderId === w.id)) continue;
    const free = s.lines.findIndex((l) => !l.leaderId);
    if (free >= 0) act(applyCommand(s, { type: 'lead', workerId: w.id, line: free }));
  }
}
