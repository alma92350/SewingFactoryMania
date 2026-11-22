/**
 * Phase 5 (PRD Part III, "Sandbox & Beyond"): player-made scenarios that travel as share codes,
 * player-made buyers inside them, seasonal events, and a 2007 era (WTO entry, US buyers,
 * computerised planning). A scenario is rebuilt from its code, so saves and replays stay deterministic.
 */
import { BUYERS, type BuyerDef, type Strictness } from './buyers';
import { CHAPTER_BY_ID, type ChapterDef, type ScriptEvent } from './chapters';
import type { MachineType } from './products';

export type SeasonId = 'none' | 'tet' | 'monsoon' | 'midautumn' | 'christmas';
export type Era = '1990s' | '2007';

export interface CustomBuyer {
  name: string;
  contact: string;
  origin: string;
  inspection: Strictness;
  habit: string;
  product: string;
}

export interface Scenario {
  v: 1;
  name: string;
  lines: number;
  /** Number of shifts; 0 = endless. */
  days: number;
  cash: number;
  era: Era;
  /** Built-in buyers who send faxes. */
  buyers: string[];
  custom: CustomBuyer[];
  modifiers: string[];
  season: SeasonId;
  seed: number;
}

export const SCENARIO_BUYERS = ['hanil', 'sakuraya', 'formosa', 'pearl', 'golden', 'saigon', 'nordlicht', 'kansai', 'atlantic'];
/** What each built-in buyer orders in a scenario: product and whether it is FOB. */
export const BUYER_ORDERS: Record<string, [string, boolean][]> = {
  hanil: [['shirt', false], ['padded', true]],
  sakuraya: [['polo', false], ['yukata', false]],
  formosa: [['jeans', false], ['baby', false]],
  pearl: [['shorts', false], ['shirt', false]],
  golden: [['workwear', true]],
  saigon: [['shirt', false]],
  nordlicht: [['polo', false]],
  kansai: [['workwear', false]],
  atlantic: [['jeans', true], ['polo', false]],
};
export const SCENARIO_PRODUCTS = ['shorts', 'shirt', 'polo', 'jeans', 'workwear', 'baby', 'padded', 'yukata'];
export const SCENARIO_MODIFIERS = ['breakdowns', 'learning', 'power'];
export const DAY_CHOICES = [3, 5, 7, 10, 0];
export const LIMITS = { name: 40, contact: 30, origin: 24, habit: 90, customBuyers: 2, cashMin: 300, cashMax: 9000 };

export const DEFAULT_SCENARIO: Scenario = {
  v: 1,
  name: 'My factory',
  lines: 2,
  days: 5,
  cash: 2000,
  era: '1990s',
  buyers: ['hanil', 'sakuraya', 'formosa', 'golden'],
  custom: [],
  modifiers: [],
  season: 'none',
  seed: 1,
};

/** The season of a calendar date (approximate: the Lunar New Year moves every year). */
export function seasonOf(d: Date): SeasonId {
  const md = (d.getMonth() + 1) * 100 + d.getDate();
  if (md >= 120 && md <= 220) return 'tet';
  if (md >= 601 && md <= 831) return 'monsoon';
  if (md >= 901 && md <= 1010) return 'midautumn';
  if (md >= 1020 && md <= 1220) return 'christmas';
  return 'none';
}

export const SEASON_TEXT: Record<SeasonId, { name: string; text: string }> = {
  none: { name: 'No season', text: 'An ordinary month.' },
  tet: { name: 'Tết', text: 'The factory closes for Tết on day 3; not everyone comes back from the provinces.' },
  monsoon: { name: 'Monsoon', text: 'Rain every other afternoon, and the power goes with it.' },
  midautumn: { name: 'Mid-Autumn Festival', text: 'Children’s clothes for the lantern festival: more orders for shorts and baby wear, at better prices.' },
  christmas: { name: 'Christmas rush', text: 'European catalogues order big for Christmas.' },
};

// ───────────────────────────── share codes

const clampStr = (v: unknown, max: number, fallback = ''): string =>
  (typeof v === 'string' ? v : fallback)
    .replace(/[<>"`\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
const clampInt = (v: unknown, lo: number, hi: number, fallback: number): number => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : fallback;
};

/** Make any input a valid scenario (codes come from other people: never trust them). */
export function sanitize(raw: Partial<Scenario>): Scenario {
  const d = DEFAULT_SCENARIO;
  const era: Era = raw.era === '2007' ? '2007' : '1990s';
  // Atlantic Outfitters only comes to Vietnam after the trade agreement and the WTO
  const buyers = Array.isArray(raw.buyers) ? [...new Set(raw.buyers.filter((b) => SCENARIO_BUYERS.includes(b) && (b !== 'atlantic' || era === '2007')))] : d.buyers;
  const custom = (Array.isArray(raw.custom) ? raw.custom : []).slice(0, LIMITS.customBuyers).map((c) => ({
    name: clampStr(c?.name, LIMITS.name, 'New buyer') || 'New buyer',
    contact: clampStr(c?.contact, LIMITS.contact, 'The buyer') || 'The buyer',
    origin: clampStr(c?.origin, LIMITS.origin, 'Saigon') || 'Saigon',
    inspection: (['none', 'relaxed', 'normal', 'strict'] as Strictness[]).includes(c?.inspection as Strictness) ? (c!.inspection as Strictness) : 'normal',
    habit: clampStr(c?.habit, LIMITS.habit),
    product: SCENARIO_PRODUCTS.includes(c?.product as string) ? (c!.product as string) : 'shirt',
  }));
  return {
    v: 1,
    name: clampStr(raw.name, LIMITS.name, d.name) || d.name,
    lines: clampInt(raw.lines, 1, 4, d.lines),
    days: DAY_CHOICES.includes(Number(raw.days)) ? Number(raw.days) : d.days,
    cash: clampInt(raw.cash, LIMITS.cashMin, LIMITS.cashMax, d.cash),
    era,
    buyers: buyers.length || custom.length ? buyers : d.buyers,
    custom,
    modifiers: Array.isArray(raw.modifiers) ? [...new Set(raw.modifiers.filter((m) => SCENARIO_MODIFIERS.includes(m)))] : [],
    season: (['none', 'tet', 'monsoon', 'midautumn', 'christmas'] as SeasonId[]).includes(raw.season as SeasonId) ? (raw.season as SeasonId) : 'none',
    seed: clampInt(raw.seed, 1, 999999, 1),
  };
}

function b64url(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64url(s: string): string {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}
function checksum(s: string): string {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return (h % 1296).toString(36).padStart(2, '0');
}

/** A short, copyable code: "SFM1-" + base64url(JSON) + a two-character checksum. */
export function encodeScenario(sc: Scenario): string {
  const s = sanitize(sc);
  const body = b64url(JSON.stringify([s.name, s.lines, s.days, s.cash, s.era, s.buyers, s.custom.map((c) => [c.name, c.contact, c.origin, c.inspection, c.habit, c.product]), s.modifiers, s.season, s.seed]));
  return `SFM1-${body}${checksum(body)}`;
}

/** Decode a code (or a link containing one). Returns null when it is not a valid code. */
export function decodeScenario(input: string): Scenario | null {
  const m = String(input ?? '').match(/SFM1-([A-Za-z0-9_-]{4,3000})/);
  if (!m) return null;
  const all = m[1]!;
  const body = all.slice(0, -2);
  if (checksum(body) !== all.slice(-2)) return null;
  try {
    const a = JSON.parse(unb64url(body)) as unknown[];
    if (!Array.isArray(a)) return null;
    const custom = (Array.isArray(a[6]) ? a[6] : []).map((c) => {
      const x = Array.isArray(c) ? c : [];
      return { name: x[0], contact: x[1], origin: x[2], inspection: x[3], habit: x[4], product: x[5] } as CustomBuyer;
    });
    return sanitize({ name: a[0] as string, lines: a[1] as number, days: a[2] as number, cash: a[3] as number, era: a[4] as Era, buyers: a[5] as string[], custom, modifiers: a[7] as string[], season: a[8] as SeasonId, seed: a[9] as number });
  } catch {
    return null;
  }
}

// ───────────────────────────── the chapter a scenario builds

const L: MachineType = 'lockstitch';
const O: MachineType = 'overlock';
const B: MachineType = 'buttonhole';
const T: MachineType = 'bartack';

/** A line that can sew every product: lockstitch, overlock, buttonhole, bartack and a QC table. */
export function universalLine(first: boolean): MachineType[] {
  return [...(first ? (['cutting'] as MachineType[]) : []), L, L, L, L, L, L, L, O, O, O, O, B, T, 'qc'];
}

/** Fax pool for generated chapters: [buyer, product, fob], weighted by repetition. */
export function faxPool(buyers: string[], customIds: string[], customProducts: string[], season: SeasonId): [string, string, boolean][] {
  const pool: [string, string, boolean][] = [];
  for (const b of buyers) for (const [p, fob] of BUYER_ORDERS[b] ?? []) pool.push([b, p, fob]);
  customIds.forEach((id, i) => {
    pool.push([id, customProducts[i]!, false], [id, customProducts[i]!, false]);
  });
  if (season === 'midautumn') {
    const kids = pool.filter(([, p]) => p === 'shorts' || p === 'baby');
    pool.push(...kids, ...(kids.length ? [] : ([['formosa', 'baby', false], ['pearl', 'shorts', false]] as [string, string, boolean][])));
  }
  if (season === 'christmas') pool.push(['nordlicht', 'polo', false], ['nordlicht', 'polo', false]);
  return pool.length ? pool : [['hanil', 'shirt', false]];
}

export function scenarioId(sc: Scenario): string {
  return `scn:${encodeScenario(sc)}`;
}

/** Build (and register) the chapter for a scenario. Star goals for finite scenarios come from calibration. */
export function scenarioDef(input: Scenario): ChapterDef {
  const sc = sanitize(input);
  const id = scenarioId(sc);
  if (CHAPTER_BY_ID[id]) return CHAPTER_BY_ID[id]!;
  const customIds = sc.custom.map((c, i) => {
    const bid = `cb${i}-${checksum(c.name + c.contact)}`;
    const def: BuyerDef = { id: bid, name: c.name, contact: c.contact, habit: c.habit, origin: c.origin, inspection: c.inspection, colour: i ? '#7b1fa2' : '#00838f' };
    BUYERS[bid] = def;
    return bid;
  });
  const modern = sc.era === '2007';
  const endless = sc.days === 0;
  const script: ScriptEvent[] = [];
  const tet = sc.season === 'tet' && (endless || sc.days >= 4);
  if (tet) script.push({ day: 3, minute: 7 * 60, kind: 'tet' });
  const power = sc.season === 'monsoon' || sc.modifiers.includes('power');
  const def: ChapterDef = {
    id,
    index: 300,
    name: sc.name,
    year: modern ? 2007 : 1996,
    place: `${sc.lines} line${sc.lines > 1 ? 's' : ''} · ${endless ? 'endless' : `${sc.days} days`}${sc.season !== 'none' ? ` · ${SEASON_TEXT[sc.season].name}` : ''}`,
    intro: modern
      ? 'A scenario set in 2007: Vietnam has just joined the WTO, American buyers are here, wages and prices are higher, and the office plans on a computer.'
      : 'A scenario made by a player. Faxes arrive every morning from the buyers they chose.',
    days: endless ? 9999 : sc.days,
    systems: ['line', 'orders', 'hiring', 'quality', 'mechanic', 'sourcing', 'cutting', ...(power ? (['power'] as const) : []), 'leaders', 'morale', 'training', 'planning', 'merchandising'],
    newSystems: [],
    stations: [],
    lines: Array.from({ length: sc.lines }, (_, i) => ({ name: `Line ${'ABCD'[i]}`, stations: universalLine(i === 0) })),
    crew: { tam: 0, thu: 14, ...(modern ? { hien: null, tuan: null } : {}) },
    extraCrew: sc.lines * 11,
    cash: sc.cash,
    rent: 12 * sc.lines,
    applicants: 3 + sc.lines,
    starText: endless ? ['Survive 5 days', 'Survive 10 days', 'Survive 20 days'] : ['Pack the target', 'Beat a good player', 'Beat a great player'],
    script,
    rainDays: sc.season === 'monsoon' ? Array.from({ length: 30 }, (_, i) => i * 2 + 1) : [],
    generator: true,
    applicantRoles: ['operator', 'mechanic', 'qc', 'cutter', 'electrician', 'leader', 'planner', 'merchandiser'],
    faxPool: faxPool(sc.buyers, customIds, sc.custom.map((c) => c.product), sc.season),
    priceMul: (modern ? 1.4 : 1) * (sc.season === 'midautumn' ? 1.08 : 1),
    qtyMul: sc.season === 'christmas' ? 1.3 : 1,
    wageMul: modern ? 1.4 : 1,
    scenarioMods: sc.modifiers,
    ...(tet ? { tetDay: 3, family2: CHAPTER_BY_ID.ch5!.family2 } : {}),
  };
  CHAPTER_BY_ID[id] = def;
  return def;
}
