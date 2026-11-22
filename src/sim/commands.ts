import { OP_BY_ID, posOf, walkMinutes, workerById } from './selectors';
import { bestStationFor } from './sim';
import type { GameState } from './types';

export type Command =
  | { type: 'assign'; workerId: string; station: number | null }
  | { type: 'setOp'; station: number; opId: string | null }
  | { type: 'fix'; station: number };

export type CommandResult = { ok: true } | { ok: false; error: string };

/** The only way the player (or the bot) changes the world. */
export function applyCommand(s: GameState, c: Command): CommandResult {
  if (s.ended) return { ok: false, error: 'The shift is over.' };
  switch (c.type) {
    case 'assign':
      return assign(s, c.workerId, c.station);
    case 'setOp':
      return setOp(s, c.station, c.opId);
    case 'fix':
      return fix(s, c.station);
  }
}

function assign(s: GameState, workerId: string, station: number | null): CommandResult {
  const w = workerById(s, workerId);
  if (!w) return { ok: false, error: 'Unknown worker.' };
  if (station === w.station) return { ok: false, error: `${w.name} is already there.` };
  if (station !== null && !s.stations[station]) return { ok: false, error: 'Unknown station.' };

  const oldStation = w.station;
  const fromPos = posOf(oldStation);
  if (oldStation !== null) s.stations[oldStation]!.workerId = null;

  if (station !== null) {
    const target = s.stations[station]!;
    const other = workerById(s, target.workerId);
    if (other) {
      // swap: the displaced worker takes the old seat (or goes to the bench)
      other.station = oldStation;
      other.from = station;
      other.leftAt = s.minute;
      other.arriveAt = s.minute + walkMinutes(s, station, posOf(oldStation));
      if (oldStation !== null) s.stations[oldStation]!.workerId = other.id;
    }
    target.workerId = w.id;
  }
  w.station = station;
  w.from = oldStation;
  w.leftAt = s.minute;
  w.arriveAt = s.minute + walkMinutes(s, fromPos, posOf(station));
  return { ok: true };
}

function setOp(s: GameState, station: number, opId: string | null): CommandResult {
  const st = s.stations[station];
  if (!st) return { ok: false, error: 'Unknown station.' };
  if (opId !== null) {
    const op = OP_BY_ID[opId];
    if (!op) return { ok: false, error: 'Unknown operation.' };
    if (op.machine !== st.machine) return { ok: false, error: `${op.name} needs an ${op.machine} machine.` };
  }
  if (st.opId === opId) return { ok: false, error: 'Already on that operation.' };
  if (st.opId !== null) {
    const keeper = bestStationFor(s, st.opId, st.index);
    if (!keeper) return { ok: false, error: `${OP_BY_ID[st.opId]!.name} needs at least one machine.` };
    if (st.current) keeper.pile.unshift(st.current);
    keeper.pile.push(...st.pile);
    st.current = null;
    st.pile = [];
  }
  st.opId = opId;
  return { ok: true };
}

function fix(s: GameState, station: number): CommandResult {
  const st = s.stations[station];
  if (!st) return { ok: false, error: 'Unknown station.' };
  if (!st.broken) return { ok: false, error: 'That machine is running fine.' };
  const d = s.director;
  if (d.target === station || d.queue.includes(station)) return { ok: false, error: 'You are already on your way.' };
  d.queue.push(station);
  return { ok: true };
}
