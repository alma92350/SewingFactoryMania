import { describe, expect, it } from 'vitest';
import { BUYERS } from '../src/data/buyers';
import { CHAPTER_BY_ID } from '../src/data/chapters';
import { ensureChapter } from '../src/data/generated';
import { DAY_CHOICES, DEFAULT_SCENARIO, decodeScenario, encodeScenario, sanitize, scenarioDef, scenarioId, SCENARIO_BUYERS, SCENARIO_PRODUCTS, seasonOf, type Scenario } from '../src/data/scenario';
import { createRng, pick, rand, randInt } from '../src/core/rng';
import { makeBot } from '../src/sim/autopilot';
import { prepareScenario } from '../src/sim/meta';
import { stars } from '../src/sim/objectives';
import { runChapter } from '../src/sim/sim';
import { createChapter } from '../src/sim/state';
import { idle } from './helpers';

const custom: Scenario = {
  ...DEFAULT_SCENARIO,
  name: 'Bà Năm’s night market',
  lines: 1,
  days: 3,
  buyers: [],
  custom: [{ name: 'Chợ Đêm Traders', contact: 'Bà Năm', origin: 'Cần Thơ', inspection: 'relaxed', habit: 'Pays in gold, haggles forever.', product: 'shorts' }],
  seed: 42,
};

describe('share codes (PRD Phase 5)', () => {
  it('a scenario survives the trip through a code, also inside a link', () => {
    const code = encodeScenario(custom);
    expect(code.startsWith('SFM1-')).toBe(true);
    expect(decodeScenario(code)).toEqual(sanitize(custom));
    expect(decodeScenario(`https://example.org/SewingFactoryMania/?scenario=${code}`)).toEqual(sanitize(custom));
  });

  it('rejects codes that were changed or are not codes at all', () => {
    const code = encodeScenario(custom);
    const i = code.length - 6;
    const tampered = code.slice(0, i) + (code[i] === 'A' ? 'B' : 'A') + code.slice(i + 1);
    expect(decodeScenario(tampered)).toBeNull();
    expect(decodeScenario('hello')).toBeNull();
    expect(decodeScenario('SFM1-!!!!')).toBeNull();
    expect(decodeScenario('')).toBeNull();
  });

  it('never trusts a code: everything is clamped and markup is stripped', () => {
    const s = sanitize({
      name: '<img src=x onerror=alert(1)>Evil',
      lines: 99,
      days: 42,
      cash: 1e9,
      buyers: ['hanil', 'nobody', 'hanil'],
      custom: Array.from({ length: 5 }, () => ({ name: '"><script>', contact: 'x'.repeat(200), origin: 'y', inspection: 'brutal' as never, habit: 'z', product: 'spaceship' })),
      modifiers: ['breakdowns', 'meteor'],
      season: 'winter' as never,
    });
    expect(s.name).not.toMatch(/[<>"]/);
    expect(s.lines).toBe(4);
    expect(DAY_CHOICES).toContain(s.days);
    expect(s.cash).toBeLessThanOrEqual(9000);
    expect(s.buyers).toEqual(['hanil']);
    expect(s.custom.length).toBe(2);
    expect(s.custom[0]!.name).not.toMatch(/[<>"]/);
    expect(s.custom[0]!.contact.length).toBeLessThanOrEqual(30);
    expect(s.custom[0]!.inspection).toBe('normal');
    expect(s.custom[0]!.product).toBe('shirt');
    expect(s.modifiers).toEqual(['breakdowns']);
    expect(s.season).toBe('none');
  });
});

describe('scenarios play like chapters', () => {
  it('a scenario chapter is rebuilt from its id after a reload', () => {
    const id = scenarioId(custom);
    scenarioDef(custom);
    delete CHAPTER_BY_ID[id];
    const def = ensureChapter(id);
    expect(def?.name).toBe('Bà Năm’s night market');
    expect(def?.days).toBe(3);
  });

  it('player-made buyers send faxes and get orders', () => {
    const def = prepareScenario(scenarioDef(custom), custom.seed);
    const s = createChapter(def.id, custom.seed);
    runChapter(s, makeBot());
    const buyer = s.orders[0]?.buyer ?? '';
    expect(BUYERS[buyer]?.name).toBe('Chợ Đêm Traders');
    expect(s.orders.every((o) => o.product === 'shorts')).toBe(true);
    expect(stars(s)).toBeGreaterThanOrEqual(1);
  });

  it('the 2007 era brings American buyers, higher wages and a computerised office', () => {
    const sc = { ...DEFAULT_SCENARIO, era: '2007' as const, buyers: ['atlantic'], seed: 7 };
    const modern = createChapter(scenarioDef(sc).id, 7);
    const old = createChapter(scenarioDef({ ...sc, era: '1990s' }).id, 7);
    expect(modern.workers.some((w) => w.role === 'planner')).toBe(true);
    expect(modern.workers.some((w) => w.role === 'merchandiser')).toBe(true);
    const lan = (s: typeof modern) => s.workers.find((w) => w.id === 'thu')!.wage;
    expect(lan(modern)).toBeGreaterThan(lan(old));
    runChapter(modern, makeBot());
    expect(modern.orders.some((o) => o.buyer === 'atlantic')).toBe(true);
  });
});

describe('seasons (PRD Phase 5)', () => {
  it('the calendar decides the season', () => {
    expect(seasonOf(new Date(2026, 0, 28))).toBe('tet');
    expect(seasonOf(new Date(2026, 6, 10))).toBe('monsoon');
    expect(seasonOf(new Date(2026, 8, 20))).toBe('midautumn');
    expect(seasonOf(new Date(2026, 10, 22))).toBe('christmas');
    expect(seasonOf(new Date(2026, 3, 1))).toBe('none');
  });

  it('Tết closes a day and some people stay home; the monsoon brings power cuts', () => {
    const tet = createChapter(scenarioDef({ ...DEFAULT_SCENARIO, season: 'tet', days: 7, seed: 3 }).id, 3);
    runChapter(tet, makeBot());
    expect(tet.tet).not.toBeNull();
    expect(tet.campaign['ch5.tet']).toBeDefined();
    const wet = createChapter(scenarioDef({ ...DEFAULT_SCENARIO, season: 'monsoon', days: 5, seed: 3 }).id, 3);
    expect(wet.power).not.toBeNull();
    runChapter(wet, makeBot());
    expect(wet.power!.minutesLost + wet.history.length).toBeGreaterThan(0);
  });

  it('the Sandbox keeps its season after a reload', () => {
    const def = ensureChapter('sandbox-2-77-midautumn')!;
    expect(def.faxPool?.some(([, p]) => p === 'baby' || p === 'shorts')).toBe(true);
    expect(def.priceMul).toBeGreaterThan(1);
  });
});

describe('random scenarios are winnable and never crash (fuzz)', () => {
  it('the bot earns a star and doing nothing earns none, on 10 random scenarios', () => {
    const rng = createRng(2026);
    for (let i = 0; i < 10; i++) {
      const sc = sanitize({
        name: `Fuzz ${i}`,
        lines: randInt(rng, 1, 4),
        days: pick(rng, [3, 5]),
        cash: randInt(rng, 6, 40) * 100,
        era: pick(rng, ['1990s', '2007']),
        buyers: SCENARIO_BUYERS.filter(() => rand(rng) < 0.4),
        custom: rand(rng) < 0.5 ? [{ name: 'Fuzz Co', contact: 'Ms. Fuzz', origin: 'Huế', inspection: 'strict', habit: '', product: pick(rng, SCENARIO_PRODUCTS) }] : [],
        modifiers: rand(rng) < 0.3 ? ['breakdowns'] : [],
        season: pick(rng, ['none', 'tet', 'monsoon', 'midautumn', 'christmas']),
        seed: randInt(rng, 1, 9999),
      });
      const def = prepareScenario(scenarioDef(sc), sc.seed);
      const bot = createChapter(def.id, sc.seed);
      runChapter(bot, makeBot());
      expect(stars(bot), encodeScenario(sc)).toBeGreaterThanOrEqual(1);
      const lazy = createChapter(def.id, sc.seed);
      runChapter(lazy, idle);
      expect(stars(lazy), encodeScenario(sc)).toBe(0);
    }
  }, 120000);
});
