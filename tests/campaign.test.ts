import { describe, expect, it } from 'vitest';
import { CHAPTERS } from '../src/data/chapters';
import { TUNING } from '../src/data/tuning';
import { makeBot } from '../src/sim/autopilot';
import { stars } from '../src/sim/objectives';
import { runChapter } from '../src/sim/sim';
import { cloneState, createChapter } from '../src/sim/state';
import { playChapter, SEEDS } from './helpers';

describe('determinism and saves', () => {
  it('same seed and same choices give the same chapter', () => {
    expect(JSON.stringify(playChapter('ch1', 4))).toBe(JSON.stringify(playChapter('ch1', 4)));
  });

  it('a save taken mid-chapter (JSON round trip) continues identically', () => {
    const a = createChapter('ch2', 3);
    const bot = makeBot();
    runChapter(a, bot, 1500);
    const b = cloneState(a);
    runChapter(a, makeBot());
    runChapter(b, makeBot());
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });
});

describe('progressive disclosure (PRD pillar 4)', () => {
  it('each chapter introduces one or two new systems, and systems accumulate', () => {
    let seen: string[] = [];
    for (const ch of CHAPTERS) {
      const fresh = ch.systems.filter((x) => !seen.includes(x));
      expect(fresh.sort()).toEqual([...ch.newSystems].sort());
      expect(fresh.length).toBeGreaterThanOrEqual(1);
      expect(fresh.length).toBeLessThanOrEqual(2);
      expect(seen.every((x) => ch.systems.includes(x as never))).toBe(true);
      seen = [...ch.systems];
    }
  });
});

describe('balance: the bot is a competent player', () => {
  for (const ch of CHAPTERS) {
    describe(ch.name, () => {
      const bot = SEEDS.map((seed) => playChapter(ch.id, seed));
      const idle = SEEDS.slice(0, 4).map((seed) => playChapter(ch.id, seed, 'idle'));

      it('the bot earns at least ★ on every seed', () => {
        expect(bot.map(stars).every((n) => n >= 1)).toBe(true);
      });
      it('doing nothing earns no star', () => {
        expect(idle.map(stars).every((n) => n === 0)).toBe(true);
      });
      it('★★★ is not free: the bot reaches it on at most 1 seed in 8', () => {
        expect(bot.filter((s) => stars(s) === 3).length).toBeLessThanOrEqual(1);
      });
      it('quiet time averages 50% or less of working minutes (no seed above 75%)', () => {
        const q = bot.map((s) => s.stats.quietMinutes / s.stats.dayMinutes);
        expect(q.reduce((a, b) => a + b, 0) / q.length).toBeLessThanOrEqual(0.5);
        for (const v of q) expect(v).toBeLessThanOrEqual(0.75);
      });
    });
  }
});

describe('family choices change the game, and every path can win (PRD §11.1)', () => {
  it('Má’s machines: keeping them adds cash and breakdowns in Chapter 1', () => {
    const keep = createChapter('ch1', 1, { campaign: { 'ch0.machines': 'keep' } });
    const sell = createChapter('ch1', 1, { campaign: { 'ch0.machines': 'sell' } });
    expect(keep.cash - sell.cash).toBe(80);
    expect(keep.mods.breakdowns).toBeGreaterThan(sell.mods.breakdowns);
    for (const campaign of [{ 'ch0.machines': 'keep' }, { 'ch0.machines': 'sell' }]) {
      expect(stars(playChapter('ch1', 2, {}, { campaign }))).toBeGreaterThanOrEqual(1);
    }
  });

  it('Uncle Sáu: accepting brings Mr. Leung’s order; both paths win', () => {
    const yes = playChapter('ch1', 2, { family: { 'ch1.uncle': 'accept' } });
    const no = playChapter('ch1', 2, { family: { 'ch1.uncle': 'decline' } });
    expect(yes.orders.some((o) => o.tag === 'golden')).toBe(true);
    expect(no.orders.some((o) => o.tag === 'golden')).toBe(false);
    expect(stars(yes)).toBeGreaterThanOrEqual(1);
    expect(stars(no)).toBeGreaterThanOrEqual(1);
  });

  it('Út: joining adds a worker, Osaka improves the sample; both paths win', () => {
    const join = playChapter('ch2', 2, { family: { 'ch2.ut': 'join' } });
    const osaka = playChapter('ch2', 2, { family: { 'ch2.ut': 'osaka' } });
    expect(join.workers.some((w) => w.id === 'ut')).toBe(true);
    expect(osaka.orders.find((o) => o.tag === 'sakuraya')!.sampleFactor).toBe(0.7);
    expect(stars(join)).toBeGreaterThanOrEqual(1);
    expect(stars(osaka)).toBeGreaterThanOrEqual(1);
  });
});

describe('pacing (PRD §18)', () => {
  it('one shift lasts 6–8 real minutes at 1×; the Chapter 0 tutorial is one shift', () => {
    const minutes = (TUNING.shiftEnd - TUNING.shiftStart) / TUNING.gameMinutesPerSecond / 60;
    expect(minutes).toBeGreaterThanOrEqual(6);
    expect(minutes).toBeLessThanOrEqual(8);
    expect(CHAPTERS[0]!.days).toBe(1);
  });
});
