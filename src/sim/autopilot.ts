import { OPERATIONS } from '../data/prototype';
import { applyCommand } from './commands';
import { bottleneck, opCapacities } from './selectors';
import type { GameState } from './types';

/**
 * A "competent player" used by the balance tests. It reacts every 5 game minutes:
 * fixes broken machines, seats idle workers, and points the spare machine at the bottleneck.
 * It never does clever swaps: ★★★ should need a human who reads the line.
 */
export function autopilot(s: GameState): number {
  if (s.minute % 5 !== 0) return 0;
  let actions = 0;
  const ok = (r: { ok: boolean }) => (r.ok ? (actions += 1) : 0);

  for (const st of s.stations) if (st.broken) ok(applyCommand(s, { type: 'fix', station: st.index }));

  for (const st of s.stations) {
    if (st.opId !== null || st.machine !== 'lockstitch') continue;
    ok(applyCommand(s, { type: 'setOp', station: st.index, opId: worstOp(s, 'lockstitch') }));
  }

  for (const w of s.workers) {
    if (w.station !== null) continue;
    const empty = s.stations
      .filter((st) => st.workerId === null && st.opId !== null)
      .sort((a, b) => b.pile.length - a.pile.length)[0];
    if (empty) ok(applyCommand(s, { type: 'assign', workerId: w.id, station: empty.index }));
  }

  if (s.minute % 60 === 0) {
    const neck = bottleneck(s);
    const op = OPERATIONS.find((o) => o.id === neck)!;
    const spare = s.stations.find((st) => st.index === 3)!;
    if (op.machine === spare.machine && spare.opId !== neck) ok(applyCommand(s, { type: 'setOp', station: 3, opId: neck }));
  }
  return actions;
}

function worstOp(s: GameState, machine: string): string {
  const cap = opCapacities(s);
  const ops = OPERATIONS.filter((o) => o.machine === machine);
  return ops.reduce((a, b) => (cap[b.id]! < cap[a.id]! ? b : a)).id;
}
