import { applyCommand, asLeader } from './commands';
import { siteOfStation, siteOfWorker } from './sites';
import { bottleneck, has, opCapacities, opDef, stationRate, workerById } from './selectors';
import type { GameState } from './types';

/**
 * Line balancing shared by the Line Leader (in the simulation) and the test bot.
 * Leaders do no clever swaps either: they cover empty steps, seat the bench and
 * point spare machines at the bottleneck.
 */
export type Act = (r: { ok: boolean }) => number;

export function leaderPresent(s: GameState, line: number): boolean {
  const w = workerById(s, s.lines[line]?.leaderId ?? null);
  return !!w && !w.absent;
}

/** Seat bench workers: specialists at their tables, operators at the emptiest station (optionally one line). */
export function seatBench(s: GameState, act: Act, line: number | null): void {
  for (const w of s.workers) {
    if (w.station !== null || w.absent || w.arriveAt > s.minute) continue;
    if (w.role === 'mechanic' || w.role === 'leader' || w.role === 'electrician' || w.role === 'planner' || w.role === 'merchandiser') continue;
    const home = siteOfWorker(s, w);
    const special = w.role === 'qc' ? 'qc' : w.role === 'cutter' ? 'cutting' : null;
    if (special) {
      const st = s.stations.find((x) => x.machine === special && x.workerId === null && siteOfStation(s, x) === home && (line === null || x.line === line || special === 'cutting'));
      if (st) act(applyCommand(s, { type: 'assign', workerId: w.id, station: st.index }));
      continue;
    }
    // a step nobody covers stops a whole line: fill those first, then the biggest piles
    const uncovered = (st: GameState['stations'][number]) =>
      !s.stations.some((x) => x.line === st.line && x.opId === st.opId && x.workerId !== null) ? 1 : 0;
    const empty = s.stations
      .filter((st) => st.workerId === null && st.opId !== null && st.machine !== 'qc' && st.machine !== 'cutting' && siteOfStation(s, st) === home && (line === null || st.line === line))
      .sort((a, b) => uncovered(b) - uncovered(a) || b.pile.length - a.pile.length)[0];
    if (empty) act(applyCommand(s, { type: 'assign', workerId: w.id, station: empty.index }));
  }
}

/** A step with no staffed machine stops the whole line: move someone from a doubled-up step. */
export function coverEmptySteps(s: GameState, act: Act, line = 0): void {
  const staffed = (opId: string) => s.stations.filter((st) => st.line === line && st.opId === opId && st.workerId !== null);
  for (const opId of Object.keys(opCapacities(s, line))) {
    if (staffed(opId).length > 0) continue;
    const empty = s.stations.find((st) => st.line === line && st.opId === opId && st.workerId === null);
    if (!empty) continue;
    const donor = s.stations.find(
      (st) => st.line === line && st.machine === empty.machine && st.opId !== null && st.opId !== opId && staffed(st.opId).length >= 2 && st.workerId !== null,
    );
    if (donor) act(applyCommand(s, { type: 'assign', workerId: donor.workerId!, station: empty.index }));
  }
}

/** Point a machine with spare capacity at the bottleneck (same machine type only). */
export function rebalance(s: GameState, act: Act, line = 0): void {
  const neck = bottleneck(s, line);
  if (!neck) return;
  const cap = opCapacities(s, line);
  const machine = opDef(neck).machine;
  const idle = s.stations.find((st) => st.line === line && st.machine === machine && st.opId === null);
  if (idle) {
    act(applyCommand(s, { type: 'setOp', station: idle.index, opId: neck }));
    return;
  }
  let best: { index: number; spare: number } | null = null;
  for (const st of s.stations) {
    if (st.line !== line || st.machine !== machine || st.opId === null || st.opId === neck || !(st.opId in cap)) continue;
    const others = s.stations.filter((x) => x.line === line && x.opId === st.opId).length;
    if (others < 2) continue;
    const spare = cap[st.opId]! - stationRate(s, st) - cap[neck]! * 1.15;
    if (spare > 0 && (!best || spare > best.spare)) best = { index: st.index, spare };
  }
  if (best) act(applyCommand(s, { type: 'setOp', station: best.index, opId: neck }));
}

/** Every 15 game minutes, each present leader balances their own line. */
export function stepLeaders(s: GameState): void {
  if (!has(s, 'leaders') || s.minute % 15 !== 0) return;
  const act: Act = (r) => {
    if (r.ok) s.stats.leaderMoves += 1;
    return r.ok ? 1 : 0;
  };
  asLeader(() =>
    s.lines.forEach((l, line) => {
      if (!l.leaderId || !leaderPresent(s, line)) return;
      seatBench(s, act, line);
      coverEmptySteps(s, act, line);
      if (s.minute % 60 === 0) rebalance(s, act, line);
    }),
  );
}
