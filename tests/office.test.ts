import { describe, expect, it } from 'vitest';
import { makeBot } from '../src/sim/autopilot';
import { applyCommand } from '../src/sim/commands';
import { stars } from '../src/sim/objectives';
import { runChapter, step } from '../src/sim/sim';
import { createChapter } from '../src/sim/state';
import type { GameState } from '../src/sim/types';
import { answerAll, SEEDS } from './helpers';

function hire(s: GameState, role: string): void {
  const a = s.applicants.find((x) => x.role === role);
  if (a) applyCommand(s, { type: 'hire', applicant: a.id });
}

describe('Chapter 6: the office', () => {
  it('four lines; Út comes back as a free merchandiser or line leader', () => {
    for (const choice of ['merch', 'lead']) {
      const s = createChapter('ch6', 1);
      expect(s.lines).toHaveLength(4);
      const d = s.decisions.find((x) => x.flag === 'ch6.ut')!;
      applyCommand(s, { type: 'decide', decision: d.id, option: choice });
      const ut = s.workers.find((w) => w.id === 'ut')!;
      expect(ut.wage).toBe(0);
      expect(ut.role).toBe(choice === 'merch' ? 'merchandiser' : 'leader');
      if (choice === 'lead') expect(s.lines[2]!.leaderId).toBe('ut');
    }
  });

  it('a merchandiser answers routine faxes with the quote policy; the director answers nothing', () => {
    const s = createChapter('ch6', 2);
    answerAll(s, { family: { 'ch6.ut': 'lead' } });
    hire(s, 'merchandiser');
    applyCommand(s, { type: 'policy', quote: 0, extras: false });
    step(s);
    // four faxes arrived and were answered; only the sample card (yukata) is handled too
    const tags = s.orders.map((o) => o.tag).sort();
    expect(tags).toEqual(['baby', 'padded', 'shirts', 'yukata']);
    expect(s.orders.find((o) => o.tag === 'baby')!.qty).toBe(800); // quote 0
    expect(s.decisions.filter((d) => d.kind === 'fax' || d.kind === 'sample')).toHaveLength(0);
  });

  it('with "no extras", the merchandiser declines optional overflow orders', () => {
    const s = createChapter('ch6', 2);
    answerAll(s, { family: { 'ch6.ut': 'merch' } });
    applyCommand(s, { type: 'policy', quote: 1, extras: false });
    runChapter(s, makeBot());
    expect(s.orders.some((o) => o.tag.startsWith('pearl'))).toBe(false);
  });

  it('a planner buys fabric for FOB orders and handles marker and fabric cards', () => {
    const s = createChapter('ch6', 3);
    answerAll(s, { family: { 'ch6.ut': 'merch' } });
    hire(s, 'planner');
    step(s);
    answerAll(s); // the player answers nothing the office handles; only non-office cards remain
    for (let i = 0; i < 60; i++) step(s);
    const padded = s.orders.find((o) => o.tag === 'padded')!;
    expect(padded.markerSet).toBe(true);
    expect(s.shipments.some((x) => x.orderId === padded.id)).toBe(true);
  });

  it('Uncle Sáu’s favour arrives only if you accepted his letter in Chapter 1, and cannot be refused', () => {
    const run = (uncle: string) => {
      const s = createChapter('ch6', 1, { campaign: { 'ch1.uncle': uncle } });
      runChapter(s, makeBot());
      return s.orders.find((o) => o.tag === 'favour');
    };
    expect(run('accept')).toBeDefined();
    expect(run('decline')).toBeUndefined();
  });

  it('fair play wins in Chapter 6 too: never fewer stars, and more money on average', () => {
    let fairCash = 0;
    let badCash = 0;
    for (const seed of SEEDS.slice(0, 6)) {
      const fair = createChapter('ch6', seed);
      runChapter(fair, makeBot());
      const bad = createChapter('ch6', seed);
      runChapter(bad, makeBot({ exploit: true }));
      expect(stars(fair)).toBeGreaterThanOrEqual(stars(bad));
      fairCash += fair.cash;
      badCash += bad.cash;
    }
    expect(fairCash).toBeGreaterThan(badCash);
  });
});

describe('workload stays flat as the factory grows (PRD Phase 3)', () => {
  it('bot actions per minute in Chapters 3–7 stay within ±20% of Chapter 2', () => {
    const rate = (ch: string) =>
      SEEDS.slice(0, 4).reduce((acc, seed) => {
        const s = createChapter(ch, seed);
        const bot = makeBot();
        let a = 0;
        runChapter(s, (x) => {
          a += bot(x);
        });
        return acc + a / s.stats.dayMinutes;
      }, 0) / 4;
    const base = rate('ch2');
    for (const ch of ['ch3', 'ch4', 'ch5', 'ch6', 'ch7']) {
      const r = rate(ch);
      expect(r, ch).toBeGreaterThanOrEqual(base * 0.8);
      expect(r, ch).toBeLessThanOrEqual(base * 1.2);
    }
  }, 120000);
});
