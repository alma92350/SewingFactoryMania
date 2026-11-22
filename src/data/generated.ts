/**
 * Generated chapters: the Daily Challenge (date-seeded, one shift, the same for everyone) and the
 * endless Sandbox. They are rebuilt from their id, so saves and replays stay deterministic.
 */
import { createRng, pick, randInt } from '../core/rng';
import { CHAPTER_BY_ID, type ChapterDef } from './chapters';
import { faxPool, scenarioDef, decodeScenario, SEASON_TEXT, type SeasonId } from './scenario';
import type { MachineType } from './products';
import { PRODUCTS } from './products';

export interface DailyModifier {
  id: string;
  name: string;
  text: string;
  emoji: string;
}

export const MODIFIERS: DailyModifier[] = [
  { id: 'breakdowns', name: 'Old machines', text: 'Machines break twice as often.', emoji: '🔧' },
  { id: 'learning', name: 'New style', text: 'Nobody has sewn this style before.', emoji: '📐' },
  { id: 'power', name: 'Blackout', text: 'A long power cut, and nobody has tested the generator.', emoji: '⚡' },
  { id: 'short', name: 'Short day', text: 'The shift ends at 14:30.', emoji: '⏱' },
];

const L: MachineType = 'lockstitch';
const O: MachineType = 'overlock';
const B: MachineType = 'buttonhole';
const T: MachineType = 'bartack';

/** Machines for a product: one per operation, plus a spare for the longest machine type. */
function machinesFor(product: string): MachineType[] {
  const ops = PRODUCTS[product]!.ops;
  const out = ops.map((o) => o.machine);
  out.push(L);
  return out;
}

export function dailyNumber(dateKey: number): number {
  const y = Math.floor(dateKey / 10000);
  const m = Math.floor((dateKey % 10000) / 100) - 1;
  const d = dateKey % 100;
  return Math.max(1, Math.round((Date.UTC(y, m, d) - Date.UTC(2026, 10, 22)) / 86400000) + 1);
}

/** The Daily Challenge for a date (YYYYMMDD). Star goals are filled in by `calibrateDaily`. */
export function dailyDef(dateKey: number): ChapterDef & { modifier: DailyModifier } {
  const rng = createRng(dateKey * 7 + 3);
  const product = pick(rng, ['shorts', 'shirt', 'polo', 'jeans', 'workwear', 'baby']);
  const modifier = pick(rng, MODIFIERS);
  const stations = machinesFor(product);
  const crew: Record<string, number | null> = {};
  return {
    id: `daily-${dateKey}`,
    index: 100,
    name: `Daily Challenge #${dailyNumber(dateKey)}`,
    year: 1990 + (dateKey % 8),
    place: `${PRODUCTS[product]!.plural} · ${modifier.name}`,
    intro: 'One shift, the same for everyone today. Pack as many pieces as you can by the end of the shift.',
    days: 1,
    systems: modifier.id === 'power' ? ['line', 'power'] : ['line'],
    newSystems: [],
    stations,
    crew,
    extraCrew: stations.length - 1,
    cash: 0,
    rent: 0,
    starText: ['Pack the target', 'Beat a good player', 'Beat a great player'],
    startOrder: { tag: 'daily', buyer: 'comai', product, qty: 2000, price: 0, dueDay: 1 },
    script: [],
    rainDays: [],
    applicantRoles: [],
    modifier,
  };
}

export interface SandboxOptions {
  lines: number;
  seed: number;
  /** Seasonal event (from today's date when started from the title screen). */
  season?: SeasonId;
}

/** The endless Sandbox: lines of mixed machines, a generous crew, faxes every morning. */
export function sandboxDef(opts: SandboxOptions): ChapterDef {
  const lines = Math.max(1, Math.min(4, opts.lines));
  const season = opts.season ?? 'none';
  const line = (first: boolean): MachineType[] => [...(first ? (['cutting'] as MachineType[]) : []), L, L, L, L, L, L, O, O, O, O, B, T, 'qc'];
  return {
    id: `sandbox-${lines}-${opts.seed}${season !== 'none' ? `-${season}` : ''}`,
    index: 200,
    name: 'Sandbox',
    year: 1997,
    place: `${lines} line${lines > 1 ? 's' : ''}, endless${season !== 'none' ? ` · ${SEASON_TEXT[season].name}` : ''}`,
    intro: 'Your own factory, as long as it lasts. Faxes arrive every morning from every buyer you know. There is no last day: keep the cash above zero and see how far you get.',
    days: 9999,
    systems: ['line', 'orders', 'hiring', 'quality', 'mechanic', 'sourcing', 'cutting', ...(season === 'monsoon' ? (['power'] as const) : []), 'leaders', 'morale', 'training', 'planning', 'merchandising'],
    newSystems: [],
    stations: [],
    lines: Array.from({ length: lines }, (_, i) => ({ name: `Line ${'ABCD'[i]}`, stations: line(i === 0) })),
    crew: { tam: 0, thu: 12 },
    extraCrew: lines * 10,
    cash: 1500 + lines * 300,
    rent: 12 * lines,
    applicants: 4 + lines,
    starText: ['Survive 5 days', 'Survive 10 days', 'Survive 20 days'],
    script: season === 'tet' ? [{ day: 3, minute: 7 * 60, kind: 'tet' }] : [],
    rainDays: season === 'monsoon' ? Array.from({ length: 30 }, (_, i) => i * 2 + 1) : [],
    generator: true,
    applicantRoles: ['operator', 'mechanic', 'qc', 'cutter', 'leader', 'planner', 'merchandiser'],
    ...(season !== 'none' ? { faxPool: faxPool(['hanil', 'sakuraya', 'formosa', 'golden', 'pearl'], [], [], season) } : {}),
    priceMul: season === 'midautumn' ? 1.08 : 1,
    qtyMul: season === 'christmas' ? 1.3 : 1,
    ...(season === 'tet' ? { tetDay: 3, family2: CHAPTER_BY_ID.ch5!.family2 } : {}),
  };
}

/** Make sure a generated chapter exists in the registry (after a reload, or before createChapter). */
export function ensureChapter(id: string): ChapterDef | undefined {
  if (CHAPTER_BY_ID[id]) return CHAPTER_BY_ID[id];
  let def: ChapterDef | undefined;
  const daily = id.match(/^daily-(\d{8})$/);
  const sandbox = id.match(/^sandbox-(\d)-(\d+)(?:-(tet|monsoon|midautumn|christmas))?$/);
  if (daily) def = dailyDef(Number(daily[1]));
  else if (sandbox) def = sandboxDef({ lines: Number(sandbox[1]), seed: Number(sandbox[2]), season: (sandbox[3] as SeasonId | undefined) ?? 'none' });
  else if (id.startsWith('scn:')) {
    const sc = decodeScenario(id.slice(4));
    if (sc) return scenarioDef(sc);
  }
  if (def) CHAPTER_BY_ID[id] = def;
  return def;
}

/** A generated fax for the sandbox: a buyer, a product some line can make, three quotes. */
export function sandboxFaxOptions(rngSeed: number, day: number, products: string[], pool?: [string, string, boolean][], priceMul = 1, qtyMul = 1) {
  const rng = createRng(rngSeed * 1000 + day);
  const buyers: [string, string, boolean][] = pool ?? [
    ['hanil', 'shirt', false],
    ['sakuraya', 'polo', false],
    ['formosa', 'jeans', false],
    ['golden', 'workwear', true],
    ['pearl', 'shorts', false],
    ['formosa', 'baby', false],
    ['hanil', 'padded', true],
    ['sakuraya', 'yukata', false],
  ];
  const usable = buyers.filter(([, p]) => products.includes(p));
  const [buyer, product, fob] = pick(rng, usable.length ? usable : buyers);
  const base: Record<string, number> = { shorts: 4.5, shirt: 8, polo: 12.5, jeans: 11.5, workwear: 20, baby: 9, padded: 30, yukata: 18 };
  const qty = Math.round((randInt(rng, 3, 9) * 100 * qtyMul) / 100) * 100;
  const due = day + randInt(rng, 2, 4);
  const price = Math.round(base[product]! * priceMul * 100) / 100;
  return {
    buyer,
    product,
    fob,
    options: [
      { label: 'Small and soon', qty: Math.max(200, qty - 200), price: price, dueDay: due },
      { label: 'Standard', qty, price: Math.round(price * 1.02 * 10) / 10, dueDay: due + 1 },
      { label: 'Big and later', qty: qty + 300, price: Math.round(price * 0.97 * 10) / 10, dueDay: due + 2 },
    ],
  };
}

export { L, O, B, T };
