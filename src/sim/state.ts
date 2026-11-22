import { createRng } from '../core/rng';
import { CHAPTER_BY_ID } from '../data/chapters';
import { ensureChapter } from '../data/generated';
import { DIFFICULTIES, type DifficultyId } from '../data/difficulty';
import { CREW, type PersonDef } from '../data/people';
import { ALL_OPS } from '../data/products';
import { TUNING, type Tuning } from '../data/tuning';
import { generateApplicants, generateVeterans } from './people';
import { planDay } from './power';
import { createOrder, activateOrder, pushFamily } from './orders';
import type { GameState, Station, Worker } from './types';

export interface ChapterOptions {
  difficulty?: DifficultyId;
  campaign?: Record<string, string>;
  tuning?: Partial<Tuning>;
}

export function emptyLedger() {
  return { revenue: 0, materials: 0, wages: 0, rent: 0, electricity: 0, freight: 0, penalties: 0 };
}

export function makeWorker(p: PersonDef | (Omit<PersonDef, 'familiar'> & { familiar?: string[] }), tuning: Tuning, station: number | null, minute: number): Worker {
  const learn: Record<string, number> = {};
  for (const id of Object.keys(ALL_OPS)) learn[id] = tuning.learnStart;
  for (const id of p.familiar ?? []) learn[id] = tuning.learnFamiliar;
  return {
    id: p.id,
    name: p.name,
    role: p.role,
    skill: { ...p.skill },
    traits: [...p.traits],
    wage: p.wage,
    station,
    arriveAt: minute,
    from: station,
    leftAt: minute,
    learn,
    fatigue: 0,
    morale: tuning.moraleStart,
    absent: false,
    note: p.note,
    mentor: null,
  };
}

export function createChapter(chapterId: string, seed: number, opts: ChapterOptions = {}): GameState {
  const ch = CHAPTER_BY_ID[chapterId] ?? ensureChapter(chapterId);
  if (!ch) throw new Error(`unknown chapter ${chapterId}`);
  const tuning: Tuning = { ...TUNING, ...opts.tuning };
  if (ch.modifier?.id === 'short') tuning.shiftEnd = 14 * 60 + 30;
  const diff = DIFFICULTIES[opts.difficulty ?? 'seamstress'];
  const campaign = { ...opts.campaign };

  // family choices carried from earlier chapters (PRD §11.1): every choice changes the game
  let breakdowns = diff.breakdowns;
  let cash = ch.cash * diff.cash;
  if (ch.index > 0 && campaign['ch0.machines'] === 'keep') {
    cash += 40;
    breakdowns *= 1.2;
  } else if (ch.index > 0 && campaign['ch0.machines'] === 'sell') {
    cash -= 40;
    breakdowns *= 0.7;
  }

  const lineDefs = ch.lines ?? [{ name: 'Line A', stations: ch.stations }];
  const flat = lineDefs.flatMap((l, line) => l.stations.map((machine) => ({ machine, line })));
  const stations: Station[] = flat.map(({ machine, line }, index) => ({
    index,
    line,
    machine,
    opId: machine === 'qc' ? 'qc' : machine === 'cutting' ? 'cut' : null,
    workerId: null,
    broken: false,
    wear: 0,
    serviceUntil: 0,
    current: null,
    pile: [],
    output: 0,
    defects: 0,
  }));

  const workers: Worker[] = [];
  for (const [id, seat] of Object.entries(ch.crew)) {
    const w = makeWorker(CREW[id]!, tuning, seat, tuning.shiftStart);
    if (seat !== null) stations[seat]!.workerId = id;
    workers.push(w);
  }

  const s: GameState = {
    version: 2,
    seed,
    rng: createRng(seed),
    chapterId: ch.id,
    difficulty: diff.id,
    campaign,
    systems: [...ch.systems],
    tuning,
    mods: { breakdowns, defects: diff.defects, inspectionShift: diff.inspectionShift, suppliers: diff.suppliers },
    day: 1,
    minute: tuning.shiftStart,
    overtime: false,
    phase: 'shift',
    stations,
    warehouse: [],
    shipments: [],
    loan: 0,
    pallets: false,
    power: ch.systems.includes('power')
      ? { off: false, rain: false, cuts: [], generator: { running: false, startAt: 0, tested: false }, closedFrom: 0, closedUntil: 0, minutesLost: 0 }
      : null,
    welfare: { fans: false, canteen: false, water: false },
    tet: ch.tetDay ? { bonusPaid: false, closed: false, volunteers: false, returned: 0, left: [] } : null,
    policy: { quote: 1, extras: true },
    prospects: [],
    macro: null,
    closedToday: false,
    workers,
    agents: [{ id: 'director', kind: 'director', target: null, task: null, pos: -1, leftAt: 0, arriveAt: 0, until: 0 }],
    repairQueue: [],
    orders: [],
    lines: lineDefs.map((l) => ({ name: l.name, activeOrderId: null, leaderId: null })),
    nextId: 1,
    cash: Math.round(cash),
    ledger: emptyLedger(),
    history: [],
    decisions: [],
    applicants: [],
    negativeDays: 0,
    firedEvents: [],
    stats: { breakdowns: 0, dayBreakdowns: 0, dayPieces: 0, quietMinutes: 0, dayMinutes: 0, overtimeDays: 0, quits: 0, sickDays: 0, leaderMoves: 0, perfectSample: false, bestMarker: 0, layoffs: 0 },
    failed: null,
  };

  if (ch.startOrder) {
    const o = createOrder(s, { ...ch.startOrder });
    // Ch0 keeps the Phase 0 seating: the spare machine has no job until the player gives it one
    activateOrder(s, o, ch.id === 'ch0' ? [0, 1, 2, null, 3, 4, 5] : undefined);
  }
  if (ch.systems.includes('hiring')) s.applicants = generateApplicants(s, true);
  planDay(s);
  if (ch.modifier?.id === 'power' && s.power) s.power.cuts = [{ start: 10 * 60, end: 11 * 60 + 40 }];
  for (const [id, line] of Object.entries(ch.crewLeads ?? {})) if (s.lines[line]) s.lines[line]!.leaderId = id;
  if (ch.extraCrew) {
    // veterans fill empty sewing machines, line by line in turn
    const free = s.stations.filter((st) => st.workerId === null && st.machine !== 'qc' && st.machine !== 'cutting');
    const byLine = s.lines.map((_, i) => free.filter((st) => st.line === i));
    const order: typeof free = [];
    for (let k = 0; order.length < free.length; k++) for (const l of byLine) if (l[k]) order.push(l[k]!);
    generateVeterans(s, ch.extraCrew).forEach((a, i) => {
      const seat = order[i];
      const w = makeWorker({ ...a, familiar: [] }, tuning, seat?.index ?? null, tuning.shiftStart);
      for (const id of Object.keys(w.learn)) w.learn[id] = 0.7;
      if (seat) seat.workerId = w.id;
      s.workers.push(w);
    });
  }
  // Daily Challenge modifiers (and the same modifiers chosen in a scenario)
  const mods = [ch.modifier?.id, ...(ch.scenarioMods ?? [])];
  if (mods.includes('breakdowns')) s.mods.breakdowns *= 2;
  if (mods.includes('learning')) for (const w of s.workers) for (const id of Object.keys(w.learn)) w.learn[id] = 0.4;
  if (mods.includes('power') && s.power) s.power.cuts = [{ start: 10 * 60, end: 11 * 60 + 40 }];
  // the 2007 era: everyone earns more (prices are higher too)
  if (ch.wageMul && ch.wageMul !== 1) for (const w of s.workers) w.wage = Math.round(w.wage * ch.wageMul * 100) / 100;
  if (ch.index > 2 && ch.index < 100 && campaign['ch2.ut'] === 'join') s.workers.push(makeWorker(CREW.ut!, tuning, null, tuning.shiftStart));
  if (ch.family && ch.family.when === 'start') pushFamily(s);
  return s;
}

/** Deep copy through JSON: the state is plain data by contract. */
export function cloneState(s: GameState): GameState {
  return JSON.parse(JSON.stringify(s)) as GameState;
}
