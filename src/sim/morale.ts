import { chance, rand } from '../core/rng';
import { CREW } from '../data/people';
import { chapterOf, has, workerById } from './selectors';
import type { GameState, SimEvent, Worker } from './types';

/**
 * People (PRD §7, D7). Morale moves every night with welfare, overtime, tiredness and pay;
 * it changes speed and quality. Low morale makes people leave. Care pays: every welfare
 * investment raises morale, and exploitative play (overtime, no welfare, no bonus) loses
 * more to quits and defects than it gains — the "fair play wins" test checks it.
 */

export function marketWage(w: Worker): number {
  return 0.9 + ((w.skill.lockstitch + w.skill.overlock) / 2) * 0.9;
}

export function welfareCount(s: GameState): number {
  return Number(s.welfare.fans) + Number(s.welfare.canteen) + Number(s.welfare.water);
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Every night: morale drifts with how the factory treats people. */
export function nightlyMorale(s: GameState, overtimeToday: boolean): void {
  if (!has(s, 'morale')) return;
  const t = s.tuning;
  for (const w of s.workers) {
    if (w.absent) continue;
    let d = welfareCount(s) * t.welfareMorale;
    d += overtimeToday ? -t.overtimeMorale : 0.015;
    if (w.fatigue > 0.6) d -= 0.03;
    if (w.role === 'operator' && w.wage > 0) d += Math.max(-0.05, Math.min(0.05, (w.wage / (chapterOf(s).wageMul ?? 1) - marketWage(w)) * 0.15));
    if (s.campaign.cat === 'adopt') d += 0.01; // the factory cat
    w.morale = clamp01(w.morale + d);
  }
}

/** Unhappy people leave overnight for a bigger factory. */
export function nightlyQuits(s: GameState, events: SimEvent[]): void {
  if (!has(s, 'morale')) return;
  const left: string[] = [];
  for (const w of [...s.workers]) {
    if (w.id === 'ut' || w.morale >= s.tuning.quitBelow) continue;
    if (chance(s.rng, s.tuning.quitChance)) {
      removeWorker(s, w);
      left.push(w.name);
    }
  }
  if (left.length) {
    s.stats.quits += left.length;
    events.push({ kind: 'note', text: `${left.join(', ')} left for a bigger factory in Biên Hòa.` });
  }
}

export function removeWorker(s: GameState, w: Worker): void {
  if (w.station !== null) s.stations[w.station]!.workerId = null;
  s.workers = s.workers.filter((x) => x.id !== w.id);
  s.agents = s.agents.filter((a) => a.id !== w.id);
  for (const l of s.lines) if (l.leaderId === w.id) l.leaderId = null;
  for (const x of s.workers) if (x.mentor === w.id) x.mentor = null;
}

/** Every morning: some people are sick (less with clean water and a first-aid corner). */
export function morningSickness(s: GameState, events: SimEvent[]): void {
  if (!has(s, 'morale')) return;
  const sick: string[] = [];
  const p = s.tuning.sickChance * (s.welfare.water ? 0.4 : 1);
  for (const w of s.workers) {
    if (w.absent || w.id === 'ut') continue;
    if (chance(s.rng, p * (1 + w.fatigue))) {
      if (w.station !== null) s.stations[w.station]!.workerId = null;
      w.station = null;
      w.absent = true;
      w.sick = true;
      sick.push(w.name);
    }
  }
  if (sick.length) {
    s.stats.sickDays += sick.length;
    events.push({ kind: 'note', text: `${sick.join(', ')} ${sick.length > 1 ? 'are' : 'is'} sick today.` });
  }
}

/** Speed multiplier from morale (≈1 at the starting morale). */
export function moraleSpeed(s: GameState, w: Worker): number {
  if (!has(s, 'morale')) return 1;
  return 0.8 + s.tuning.moraleSpeed * w.morale;
}

export function moraleDefects(s: GameState, w: Worker): number {
  if (!has(s, 'morale')) return 1;
  return Math.max(0.6, 1 + s.tuning.moraleDefects * (0.7 - w.morale));
}

/** A senior teaching someone sews a bit slower. */
export function mentorPenalty(s: GameState, w: Worker): number {
  if (!has(s, 'training')) return 1;
  const teaching = s.workers.some((j) => j.mentor === w.id && j.station !== null && !j.absent && j.arriveAt <= s.minute);
  return teaching ? s.tuning.mentorSeniorSpeed : 1;
}

/** The junior learns faster and slowly gains the senior's skill on this machine. */
export function mentoring(s: GameState, w: Worker, machine: keyof Worker['skill'], made: number): number {
  if (!has(s, 'training') || !w.mentor) return 1;
  const senior = workerById(s, w.mentor);
  if (!senior || senior.absent || senior.station === null) return 1;
  w.skill[machine] = Math.min(Math.max(w.skill[machine], senior.skill[machine]), w.skill[machine] + made * s.tuning.mentorSkillPerPiece);
  return s.tuning.mentorLearning;
}

export function buyWelfare(s: GameState, item: 'fans' | 'canteen' | 'water'): string | null {
  if (!has(s, 'morale')) return 'Not in this chapter.';
  if (s.welfare[item]) return 'Already done.';
  const cost = s.tuning.welfareCost[item];
  if (s.cash < cost) return `Not enough cash: it costs $${cost}.`;
  s.cash -= cost;
  s.ledger.materials += cost;
  s.welfare[item] = true;
  for (const w of s.workers) w.morale = clamp01(w.morale + 0.05);
  return null;
}

export function bonusCost(s: GameState): number {
  return Math.round(s.workers.filter((w) => !w.absent || true).reduce((a, w) => a + w.wage, 0) * s.tuning.bonusDays);
}

export function payBonus(s: GameState): void {
  const cost = bonusCost(s);
  s.cash -= cost;
  s.ledger.wages += cost;
  for (const w of s.workers) w.morale = clamp01(w.morale + 0.2);
  if (s.tet) s.tet.bonusPaid = true;
}

/** After Tết, everyone decides whether to come back to the city. */
export function tetReturns(s: GameState, events: SimEvent[]): void {
  if (!s.tet) return;
  const t = s.tuning;
  const left: string[] = [];
  let returned = 0;
  for (const w of [...s.workers]) {
    if (w.id === 'ut' || w.role === 'leader') {
      returned += 1;
      continue;
    }
    const p = Math.max(0.25, Math.min(0.98, t.tetReturnBase + (w.morale - 0.5) * 0.5 + (s.tet.bonusPaid ? t.tetBonusReturn : 0)));
    if (rand(s.rng) < p) returned += 1;
    else {
      removeWorker(s, w);
      left.push(w.name);
    }
  }
  s.tet.returned = returned;
  s.tet.left = left;
  events.push({
    kind: 'note',
    text: left.length ? `After Tết, ${returned} came back. ${left.length} stayed in their home provinces: ${left.slice(0, 6).join(', ')}${left.length > 6 ? '…' : ''}.` : 'After Tết, everyone came back!',
  });
}

/** Tết volunteers: about 40% come in, paid double. */
export function tetVolunteers(s: GameState): void {
  for (const w of s.workers) {
    if (w.id === 'ut') continue;
    if (rand(s.rng) > 0.4) {
      if (w.station !== null) s.stations[w.station]!.workerId = null;
      w.station = null;
      w.absent = true;
    }
  }
  if (s.tet) s.tet.volunteers = true;
}

export function bacTuScissors(s: GameState, workerId: string): void {
  const w = workerById(s, workerId) ?? s.workers.find((x) => CREW[x.id]);
  if (!w) return;
  for (const k of Object.keys(w.skill) as (keyof Worker['skill'])[]) w.skill[k] = Math.min(1, Math.round((w.skill[k] + 0.15) * 100) / 100);
  if (!w.traits.includes('scissors')) w.traits.push('scissors');
}

/** Chapter 6: Út comes back and takes a job in the office or on line C (free, family). */
export function utReturns(s: GameState, choice: string): void {
  let ut = s.workers.find((w) => w.id === 'ut');
  if (!ut) {
    const def = CREW.ut!;
    ut = {
      id: 'ut',
      name: def.name,
      role: 'operator',
      skill: { ...def.skill },
      traits: [...def.traits],
      wage: 0,
      station: null,
      arriveAt: s.minute,
      from: null,
      leftAt: s.minute,
      learn: {},
      fatigue: 0,
      morale: 1,
      absent: false,
      note: s.campaign['ch2.ut'] === 'osaka' ? 'Back from Osaka with a degree in textile engineering.' : def.note,
      mentor: null,
    };
    s.workers.push(ut);
  }
  if (ut.station !== null) s.stations[ut.station]!.workerId = null;
  ut.station = null;
  ut.wage = 0;
  if (choice === 'lead') {
    ut.role = 'leader';
    const line = s.lines[2] ?? s.lines[0]!;
    line.leaderId = ut.id;
  } else ut.role = 'merchandiser';
}
