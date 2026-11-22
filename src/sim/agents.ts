import { walkMinutes, workerById } from './selectors';
import { directorSite, hasSites, siteOfStation, siteOfWorker } from './sites';
import type { Agent, GameState, SimEvent } from './types';

/**
 * The director and the mechanics walk to machines. The director only fixes what the player asks
 * (repair queue). Mechanics also queue broken machines themselves and change worn needles when idle.
 */
export function stepAgents(s: GameState, events: SimEvent[]): void {
  // mechanics notice breakdowns on their own
  for (const m of s.agents) {
    if (m.kind !== 'mechanic' || !isPresent(s, m)) continue;
    const site = agentSite(s, m);
    for (const st of s.stations) {
      if (st.broken && (!hasSites(s) || siteOfStation(s, st) === site) && !s.repairQueue.includes(st.index) && !s.agents.some((a) => a.target === st.index)) s.repairQueue.push(st.index);
    }
  }
  // mechanics first: they are faster
  const order = [...s.agents].sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'mechanic' ? -1 : 1));
  for (const a of order) {
    if (!isPresent(s, a)) continue;
    stepAgent(s, a, events);
  }
}

function agentSite(s: GameState, a: Agent): string {
  if (a.kind === 'director') return directorSite(s);
  const w = workerById(s, a.id);
  return w ? siteOfWorker(s, w) : 'main';
}

function isPresent(s: GameState, a: Agent): boolean {
  if (a.kind === 'director') return directorSite(s) !== 'air';
  const w = workerById(s, a.id);
  return !!w && !w.absent;
}

function stepAgent(s: GameState, a: Agent, events: SimEvent[]): void {
  const t = s.tuning;
  if (a.target !== null) {
    const st = s.stations[a.target]!;
    if (a.until === 0 && s.minute >= a.arriveAt) {
      a.pos = a.target;
      if (a.task === 'fix') {
        if (!st.broken) return finish(a);
        a.until = s.minute + (a.kind === 'mechanic' ? t.mechanicFixMinutes : t.fixMinutes);
      } else {
        a.until = s.minute + t.needleChangeMinutes;
        st.serviceUntil = a.until;
      }
    } else if (a.until > 0 && s.minute >= a.until) {
      if (a.task === 'fix') {
        st.broken = false;
        events.push({ kind: 'fixed', station: st.index });
      }
      st.wear = 0;
      return finish(a);
    }
    return;
  }
  // take the next repair (the director only if the player asked)
  const here = hasSites(s) ? agentSite(s, a) : null;
  const next = s.repairQueue.find((i) => s.stations[i]!.broken && (here === null || siteOfStation(s, i) === here));
  s.repairQueue = s.repairQueue.filter((i) => s.stations[i]!.broken);
  if (next !== undefined) {
    s.repairQueue = s.repairQueue.filter((i) => i !== next);
    go(s, a, next, 'fix');
    return;
  }
  if (a.kind === 'mechanic') {
    let worst = -1;
    let wear = t.preventiveWear;
    for (const st of s.stations) {
      if (st.broken || st.machine === 'qc' || s.agents.some((x) => x.target === st.index) || (here !== null && siteOfStation(s, st) !== here)) continue;
      if (st.wear > wear) {
        wear = st.wear;
        worst = st.index;
      }
    }
    if (worst >= 0) go(s, a, worst, 'needle');
  }
}

function go(s: GameState, a: Agent, target: number, task: 'fix' | 'needle'): void {
  a.target = target;
  a.task = task;
  a.leftAt = s.minute;
  a.arriveAt = s.minute + walkMinutes(s, a.pos < 0 ? 0 : a.pos, target);
  a.until = 0;
}

function finish(a: Agent): void {
  a.target = null;
  a.task = null;
  a.until = 0;
}
