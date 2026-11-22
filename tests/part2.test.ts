import { describe, expect, it } from 'vitest';
import { makeBot } from '../src/sim/autopilot';
import { applyCommand } from '../src/sim/commands';
import { brandStock, demandTonight, fullPriceShare } from '../src/sim/brand';
import { stars } from '../src/sim/objectives';
import { endDay, runChapter, runShift, step } from '../src/sim/sim';
import { createChapter } from '../src/sim/state';
import { auditChecks, brokerQuota, quotaCost } from '../src/sim/us';
import { answerAll, playChapter, SEEDS } from './helpers';
import type { GameState } from '../src/sim/types';

/** The first minutes of a chapter: the opening cards fire on the first step, answer them. */
function open(s: GameState): void {
  for (let i = 0; i < 6; i++) {
    answerAll(s);
    step(s);
  }
  answerAll(s);
}

describe('Chapter 8: US quota and the compliance audit (Part II)', () => {
  it('American orders need quota; buying it costs today’s price, and the price moves every night', () => {
    const s = createChapter('ch8', 1);
    open(s);
    const us = s.orders.find((o) => o.buyer === 'atlantic')!;
    const cash = s.cash;
    expect(applyCommand(s, { type: 'quota', orderId: us.id }).ok).toBe(true);
    expect(cash - s.cash).toBe(quotaCost(s, { ...us, quotaPaid: false }));
    expect(applyCommand(s, { type: 'quota', orderId: us.id }).ok).toBe(false);
    const prices = new Set<number>();
    runChapter(s, (x) => {
      prices.add(x.quota!.price);
    });
    expect(prices.size).toBeGreaterThan(2);
  });

  it('without quota, a broker charges 50% more at shipping time', () => {
    const s = createChapter('ch8', 2);
    open(s);
    const us = s.orders.find((o) => o.buyer === 'atlantic')!;
    const today = quotaCost(s, us);
    const cash = s.cash;
    brokerQuota(s, us, []);
    expect(us.quotaPaid).toBe(true);
    expect(cash - s.cash).toBe(quotaCost(s, us, true));
    expect(quotaCost(s, us, true)).toBeGreaterThan(today * 1.4);
  });

  it('a fair factory passes the audit; an exploiting one fails it twice and loses 10% on American orders', () => {
    const fair = playChapter('ch8', 3);
    expect(fair.audit!.firstPassed).toBe(true);
    const bad = createChapter('ch8', 3);
    runChapter(bad, makeBot({ exploit: true }));
    expect(bad.audit!.firstPassed).toBe(false);
    expect(bad.audit!.visits).toBe(2);
    expect(bad.orders.filter((o) => o.buyer === 'atlantic').every((o) => o.discount >= 0.1)).toBe(true);
    expect(stars(fair)).toBeGreaterThan(stars(bad));
  });

  it('the code of conduct is checked live', () => {
    const s = createChapter('ch8', 4);
    const c = auditChecks(s);
    expect(Object.keys(c).length).toBe(6);
    expect(c.water).toBe(false);
    s.welfare.water = true;
    expect(auditChecks(s).water).toBe(true);
  });
});

describe('Chapter 9: two cities (Part II)', () => {
  it('you can only move people where you are; a flight takes three hours', () => {
    const s = createChapter('ch9', 1);
    open(s);
    const north = s.workers.find((w) => w.station !== null && s.lines[s.stations[w.station]!.line]!.site === 'hanoi' && w.role === 'operator')!;
    const empty = s.stations.find((st) => st.workerId === null && s.lines[st.line]!.site === 'hanoi' && st.machine !== 'qc' && st.machine !== 'cutting');
    expect(s.director!.site).toBe('saigon');
    const r = applyCommand(s, { type: 'assign', workerId: north.id, station: empty ? empty.index : null });
    expect(r.ok).toBe(false);
    expect(applyCommand(s, { type: 'travel', site: 'hanoi' }).ok).toBe(true);
    expect(s.director!.flightUntil).toBe(s.minute + 180);
    expect(applyCommand(s, { type: 'assign', workerId: north.id, station: null }).ok).toBe(false); // still flying
    runShift(s, undefined, s.minute + 181);
    expect(s.director!.flightUntil).toBe(0);
    expect(applyCommand(s, { type: 'assign', workerId: north.id, station: null }).ok).toBe(true);
  });

  it('nobody moves between cities, and line leaders work while you are away', () => {
    const s = createChapter('ch9', 2);
    open(s);
    const south = s.workers.find((w) => w.station !== null && s.lines[s.stations[w.station]!.line]!.site === 'saigon' && w.role === 'operator')!;
    const north = s.stations.find((st) => s.lines[st.line]!.site === 'hanoi' && st.machine === 'lockstitch')!;
    expect(applyCommand(s, { type: 'assign', workerId: south.id, station: north.index }).ok).toBe(false);
    const before = s.stats.leaderMoves;
    runChapter(s, undefined, 4000);
    expect(s.stats.leaderMoves).toBeGreaterThan(before);
  });

  it('northern wages are lower; both of the family’s choices put a leader on line C and win', () => {
    for (const choice of ['ut', 'thang']) {
      const s = playChapter('ch9', 3, { family: { 'ch9.north': choice } });
      expect(s.lines[2]!.leaderId).toBe(choice);
      expect(stars(s)).toBeGreaterThanOrEqual(1);
    }
    const s = createChapter('ch9', 4);
    const v = s.workers.filter((w) => /^v\d+$/.test(w.id));
    const north = v.filter((w) => w.site === 'hanoi');
    const south = v.filter((w) => w.site === 'saigon');
    if (north.length && south.length) {
      const avg = (l: typeof v) => l.reduce((a, w) => a + w.wage, 0) / l.length;
      expect(avg(north)).toBeLessThan(avg(south));
    }
  });
});

describe('Chapter 10: your own label (Part II)', () => {
  it('the collection is sewn like an order and sold by the shops every night; leftovers go on sale', () => {
    const s = createChapter('ch10', 1);
    open(s);
    expect(s.brand).not.toBeNull();
    const bot = makeBot();
    let sold = 0;
    runChapter(s, (x) => {
      bot(x);
      sold = Math.max(sold, x.brand?.sold ?? 0);
    });
    expect(s.brand!.sold).toBeGreaterThan(0);
    expect(brandStock(s)).toBe(0); // the last night sells the rest at 60% off
    expect(fullPriceShare(s)).toBeGreaterThan(0.5);
  });

  it('a lower price sells more, an advertisement more still', () => {
    const s = createChapter('ch10', 2);
    open(s);
    const normal = demandTonight(s);
    applyCommand(s, { type: 'price', level: -1 });
    const sale = demandTonight(s);
    expect(sale).toBeGreaterThan(normal);
    applyCommand(s, { type: 'price', level: 1 });
    expect(demandTonight(s)).toBeLessThan(normal);
    applyCommand(s, { type: 'price', level: 0 });
    expect(applyCommand(s, { type: 'advertise' }).ok).toBe(true);
    expect(demandTonight(s)).toBeGreaterThan(normal);
    expect(applyCommand(s, { type: 'advertise' }).ok).toBe(false);
  });

  it('every collection and both names win; neither name is strictly better', () => {
    const cash: Record<string, number> = {};
    for (const col of ['shirt', 'polo', 'padded']) {
      for (const name of ['heritage', 'lan']) {
        const s = createChapter('ch10', 5, { campaign: {} });
        const bot = makeBot({ family: { 'ch10.name': name } });
        runChapter(s, (x) => {
          for (const d of [...x.decisions]) if (d.kind === 'brand') applyCommand(x, { type: 'decide', decision: d.id, option: col });
          bot(x);
        });
        expect(stars(s), `${col}/${name}`).toBeGreaterThanOrEqual(1);
        cash[`${col}/${name}`] = s.cash;
      }
    }
    const heritageWins = ['shirt', 'polo', 'padded'].filter((c) => cash[`${c}/heritage`]! > cash[`${c}/lan`]!).length;
    expect(heritageWins).toBeGreaterThan(0);
    expect(heritageWins).toBeLessThan(3);
  }, 60000);
});

describe('Part II fair play and workload', () => {
  it('in Chapter 8, care beats exploitation on stars on every seed', () => {
    for (const seed of SEEDS.slice(0, 4)) {
      const fair = playChapter('ch8', seed);
      const bad = createChapter('ch8', seed);
      runChapter(bad, makeBot({ exploit: true }));
      expect(stars(fair)).toBeGreaterThan(stars(bad));
    }
  }, 30000);

  it('a shift still ends: steps and nights run without errors in every Part II chapter', () => {
    for (const ch of ['ch8', 'ch9', 'ch10']) {
      const s = createChapter(ch, 9);
      const bot = makeBot();
      for (let i = 0; i < 3000 && s.phase !== 'done'; i++) {
        bot(s);
        if (s.phase === 'report' && !s.decisions.length) endDay(s);
        else step(s);
      }
      expect(s.day).toBeGreaterThan(1);
    }
  });
});
