import { describe, expect, it } from 'vitest';
import { CHAPTERS } from '../src/data/chapters';
import { DIFFICULTIES, type DifficultyId } from '../src/data/difficulty';
import { makeBot } from '../src/sim/autopilot';
import { applyCommand } from '../src/sim/commands';
import { newCustomers } from '../src/sim/macro';
import { stars } from '../src/sim/objectives';
import { runChapter, runShift } from '../src/sim/sim';
import { createChapter } from '../src/sim/state';
import { answerAll, playChapter, SEEDS } from './helpers';

describe('Chapter 7: the storm from the north (PRD §11)', () => {
  it('the shock cuts most of what Hanil still wants on day 2', () => {
    const s = createChapter('ch7', 1);
    const bot = makeBot();
    runChapter(s, (x) => {
      bot(x);
    }, 9000);
    expect(s.day).toBeGreaterThanOrEqual(2);
    expect(s.macro).not.toBeNull();
    expect(s.macro!.buyer).toBe('hanil');
    expect(s.macro!.cutPieces).toBeGreaterThan(800);
    const shirts = s.orders.find((o) => o.tag === 'hanil7')!;
    expect(shirts.qty).toBeLessThan(1800);
  });

  it('new markets cost money now and send a fax later', () => {
    const s = createChapter('ch7', 2);
    answerAll(s);
    const cash = s.cash;
    expect(applyCommand(s, { type: 'prospect', market: 'saigon' }).ok).toBe(true);
    expect(s.cash).toBe(cash - 40);
    expect(applyCommand(s, { type: 'prospect', market: 'saigon' }).ok).toBe(false);
    expect(s.prospects[0]!.day).toBe(2);
    const bot = makeBot();
    runChapter(s, (x) => {
      bot(x);
    }, 12000);
    expect(s.orders.some((o) => o.buyer === 'saigon')).toBe(true);
  });

  it('promising Má means nobody can be let go; closing a line counts the layoffs', () => {
    const keep = playChapter('ch7', 3, { family: { 'ch7.ma': 'keep' } });
    expect(keep.stats.layoffs).toBe(0);
    expect(applyCommand(keep, { type: 'letGo', workerId: keep.workers[3]!.id }).ok).toBe(false);
    const shrink = playChapter('ch7', 3, { family: { 'ch7.ma': 'shrink' } });
    expect(shrink.stats.layoffs).toBeGreaterThan(5);
    expect(shrink.workers.length).toBeLessThan(keep.workers.length);
  });

  it('both of Má’s paths win; ★★★ needs the no-layoff path', () => {
    for (const ma of ['keep', 'shrink']) {
      const runs = SEEDS.slice(0, 4).map((seed) => playChapter('ch7', seed, { family: { 'ch7.ma': ma } }));
      expect(runs.every((s) => stars(s) >= 1)).toBe(true);
      if (ma === 'shrink') expect(runs.every((s) => stars(s) < 3)).toBe(true);
    }
  });

  it('the bot finds at least two new customers', () => {
    const s = playChapter('ch7', 4);
    expect(newCustomers(s)).toBeGreaterThanOrEqual(2);
  });

  it('a day without the shock is not possible: idle play goes broke or earns nothing', () => {
    const s = playChapter('ch7', 5, 'idle');
    expect(stars(s)).toBe(0);
  });

  it('one shift of Chapter 7 runs at the usual pace', () => {
    const s = createChapter('ch7', 6);
    const bot = makeBot();
    runShift(s, (x) => {
      bot(x);
    });
    expect(s.phase === 'report' || s.decisions.length > 0).toBe(true);
  });
});

describe('difficulty (PRD §12)', () => {
  it('Ship Leaves Thursday exists, unlocks after Chapter 4, and is the hardest', () => {
    const t = DIFFICULTIES.thursday;
    expect(t.unlockAfter).toBe('ch4');
    for (const d of Object.values(DIFFICULTIES)) {
      expect(t.cash).toBeLessThanOrEqual(d.cash);
      expect(t.breakdowns).toBeGreaterThanOrEqual(d.breakdowns);
      expect(t.defects).toBeGreaterThanOrEqual(d.defects);
      expect(t.suppliers).toBeGreaterThanOrEqual(d.suppliers);
    }
  });

  for (const d of Object.keys(DIFFICULTIES) as DifficultyId[]) {
    it(`the bot completes the whole campaign (★ in every chapter) on ${DIFFICULTIES[d].name}`, () => {
      const fails: string[] = [];
      for (const ch of CHAPTERS) {
        for (const seed of SEEDS) {
          const s = playChapter(ch.id, seed, {}, { difficulty: d });
          if (stars(s) < 1) fails.push(`${ch.id}/${seed}`);
        }
      }
      expect(fails).toEqual([]);
    }, 60000);
  }
});
