import { applySampleResult, bestStationFor, resolveDecision } from './orders';
import { buyFabric, rejectRolls } from './sourcing';
import { makeWorker } from './state';
import { endDay } from './sim';
import { has, opDef, orderById, posOf, walkMinutes, workerById } from './selectors';
import type { GameState, SimEvent } from './types';

export type Command =
  | { type: 'assign'; workerId: string; station: number | null }
  | { type: 'setOp'; station: number; opId: string | null }
  | { type: 'fix'; station: number }
  | { type: 'decide'; decision: number; option: string }
  | { type: 'sample'; decision: number; found: number }
  | { type: 'hire'; applicant: string }
  | { type: 'letGo'; workerId: string }
  | { type: 'overtime'; on: boolean }
  | { type: 'sleep' }
  | { type: 'buy'; supplier: string; orderId: number; rolls: number }
  | { type: 'marker'; decision: number; eff: number }
  | { type: 'fabricResult'; decision: number; rolls: number[] }
  | { type: 'pallets' };

export type CommandResult = { ok: true; events: SimEvent[] } | { ok: false; error: string };

const ok = (events: SimEvent[] = []): CommandResult => ({ ok: true, events });
const no = (error: string): CommandResult => ({ ok: false, error });

/** The only way the player (or the bot) changes the world. */
export function applyCommand(s: GameState, c: Command): CommandResult {
  if (s.phase === 'done' && c.type !== 'decide') return no('The chapter is over.');
  switch (c.type) {
    case 'assign':
      return assign(s, c.workerId, c.station);
    case 'setOp':
      return setOp(s, c.station, c.opId);
    case 'fix':
      return fix(s, c.station);
    case 'decide': {
      const events: SimEvent[] = [];
      const err = resolveDecision(s, c.decision, c.option, events);
      return err ? no(err) : ok(events);
    }
    case 'sample': {
      const d = s.decisions.find((x) => x.id === c.decision && x.kind === 'sample');
      if (!d) return no('No sample to check.');
      const o = orderById(s, d.orderId!);
      if (o) applySampleResult(o, c.found);
      s.decisions = s.decisions.filter((x) => x.id !== c.decision);
      return ok();
    }
    case 'hire':
      return hire(s, c.applicant);
    case 'letGo':
      return letGo(s, c.workerId);
    case 'overtime':
      if (!has(s, 'orders')) return no('No overtime in this chapter.');
      if (s.phase !== 'shift' || s.minute >= s.tuning.shiftEnd) return no('Too late to change overtime today.');
      s.overtime = c.on;
      return ok();
    case 'buy': {
      if (!has(s, 'sourcing')) return no('No sourcing in this chapter.');
      const err = buyFabric(s, c.supplier, c.orderId, Math.floor(c.rolls));
      return err ? no(err) : ok();
    }
    case 'marker': {
      const d = s.decisions.find((x) => x.id === c.decision && x.kind === 'marker');
      if (!d) return no('No marker to lay.');
      const o = orderById(s, d.orderId!);
      if (o) {
        o.markerEff = Math.max(0.6, Math.min(s.tuning.markerBest, c.eff));
        o.markerSet = true;
      }
      s.decisions = s.decisions.filter((x) => x.id !== c.decision);
      return ok();
    }
    case 'fabricResult': {
      const d = s.decisions.find((x) => x.id === c.decision && x.kind === 'fabric');
      if (!d) return no('No fabric to inspect.');
      rejectRolls(s, s.warehouse.filter((r) => c.rolls.includes(r.id)));
      s.decisions = s.decisions.filter((x) => x.id !== c.decision);
      return ok();
    }
    case 'pallets':
      if (!has(s, 'sourcing')) return no('No warehouse in this chapter.');
      if (s.pallets) return no('The warehouse already has pallets.');
      if (s.cash < s.tuning.palletsCost) return no('Not enough cash.');
      s.cash -= s.tuning.palletsCost;
      s.ledger.materials += s.tuning.palletsCost;
      s.pallets = true;
      for (const r of s.warehouse) r.dry = true;
      return ok();
    case 'sleep':
      if (s.phase !== 'report') return no('The shift is not over yet.');
      if (s.decisions.length) return no('Answer the open card first.');
      endDay(s);
      return ok();
  }
}

function assign(s: GameState, workerId: string, station: number | null): CommandResult {
  const w = workerById(s, workerId);
  if (!w) return no('Unknown worker.');
  if (w.absent) return no(`${w.name} is not here today.`);
  if (w.role === 'mechanic') return no('Mechanics fix machines; they do not sew.');
  if (station === w.station) return no(`${w.name} is already there.`);
  if (station !== null && !s.stations[station]) return no('Unknown station.');

  const oldStation = w.station;
  const fromPos = posOf(s, oldStation);
  if (oldStation !== null) s.stations[oldStation]!.workerId = null;

  if (station !== null) {
    const target = s.stations[station]!;
    const other = workerById(s, target.workerId);
    if (other) {
      other.station = oldStation;
      other.from = station;
      other.leftAt = s.minute;
      other.arriveAt = s.minute + walkMinutes(s, station, posOf(s, oldStation));
      if (oldStation !== null) s.stations[oldStation]!.workerId = other.id;
    }
    target.workerId = w.id;
  }
  w.station = station;
  w.from = oldStation;
  w.leftAt = s.minute;
  w.arriveAt = s.minute + walkMinutes(s, fromPos, posOf(s, station));
  return ok();
}

function setOp(s: GameState, station: number, opId: string | null): CommandResult {
  const st = s.stations[station];
  if (!st) return no('Unknown station.');
  if (st.machine === 'qc') return no('The QC table only does QC.');
  if (opId !== null) {
    const op = opDef(opId);
    if (!op) return no('Unknown operation.');
    if (op.machine !== st.machine) return no(`${op.name} needs a ${op.machine} machine.`);
  }
  if (st.opId === opId) return no('Already on that operation.');
  if (st.opId !== null) {
    const keeper = bestStationFor(s, st.opId, st.index, st.line);
    if (!keeper) return no(`${opDef(st.opId).name} needs at least one machine.`);
    if (st.current) keeper.pile.unshift(st.current);
    keeper.pile.push(...st.pile);
    st.current = null;
    st.pile = [];
  }
  st.opId = opId;
  return ok();
}

function fix(s: GameState, station: number): CommandResult {
  const st = s.stations[station];
  if (!st) return no('Unknown station.');
  if (!st.broken) return no('That machine is running fine.');
  if (s.repairQueue.includes(station) || s.agents.some((a) => a.target === station)) return no('Someone is already on the way.');
  s.repairQueue.push(station);
  return ok();
}

function hire(s: GameState, id: string): CommandResult {
  if (!has(s, 'hiring')) return no('No hiring in this chapter.');
  const a = s.applicants.find((x) => x.id === id);
  if (!a) return no('That applicant has left.');
  s.applicants = s.applicants.filter((x) => x.id !== id);
  const w = makeWorker({ ...a, id: `w${s.nextId++}`, familiar: [] }, s.tuning, null, s.minute);
  w.arriveAt = s.minute + 2;
  s.workers.push(w);
  if (a.role === 'mechanic') s.agents.push({ id: w.id, kind: 'mechanic', target: null, task: null, pos: -1, leftAt: s.minute, arriveAt: s.minute, until: 0 });
  return ok();
}

function letGo(s: GameState, workerId: string): CommandResult {
  const w = workerById(s, workerId);
  if (!w) return no('Unknown worker.');
  if (w.station !== null) s.stations[w.station]!.workerId = null;
  const severance = Math.round(w.wage * 2 * 100) / 100;
  s.cash -= severance;
  s.ledger.wages += severance;
  s.workers = s.workers.filter((x) => x.id !== workerId);
  s.agents = s.agents.filter((a) => a.id !== workerId);
  return ok();
}
