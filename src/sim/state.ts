import { createRng } from '../core/rng';
import { OPERATIONS, STATIONS, TUNING, WORKERS, type Tuning } from '../data/prototype';
import type { GameState, Station, Worker } from './types';

export function createState(seed: number, overrides: Partial<Tuning> = {}): GameState {
  const tuning: Tuning = { ...TUNING, ...overrides };
  const stations: Station[] = STATIONS.map((s, index) => ({
    index,
    machine: s.machine,
    opId: s.opId,
    workerId: null,
    broken: false,
    wear: 0,
    current: null,
    pile: [],
    output: 0,
  }));
  const workers: Worker[] = WORKERS.map((w) => {
    const learn: Record<string, number> = {};
    for (const op of OPERATIONS) learn[op.id] = op.id === w.familiar ? tuning.learnFamiliar : tuning.learnStart;
    if (w.start !== null) stations[w.start]!.workerId = w.id;
    return {
      id: w.id,
      name: w.name,
      skill: { ...w.skill },
      station: w.start,
      arriveAt: tuning.shiftStart,
      from: w.start,
      leftAt: tuning.shiftStart,
      learn,
      note: w.note,
    };
  });
  return {
    version: 1,
    seed,
    rng: createRng(seed),
    minute: tuning.shiftStart,
    tuning,
    stations,
    workers,
    director: { target: null, pos: -1, leftAt: 0, arriveAt: 0, fixUntil: 0, queue: [] },
    cutStack: tuning.cutBundles,
    nextBundleId: 1,
    finished: 0,
    breakdowns: 0,
    ended: false,
  };
}

/** Deep copy through JSON: the state is plain data by contract. */
export function cloneState(s: GameState): GameState {
  return JSON.parse(JSON.stringify(s)) as GameState;
}
