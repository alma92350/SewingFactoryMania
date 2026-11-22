import { describe, expect, it } from 'vitest';
import { TUNING } from '../src/data/tuning';
import { applyCommand } from '../src/sim/commands';
import { activeOrder, dailyWages } from '../src/sim/selectors';
import { endDay, runShift, step } from '../src/sim/sim';
import { createChapter } from '../src/sim/state';
import type { GameState } from '../src/sim/types';
import { answerAll } from './helpers';

function startCh1(seed = 1): GameState {
  const s = createChapter('ch1', seed);
  answerAll(s); // family letter
  step(s); // the first fax arrives at 07:00
  return s;
}

describe('faxes and orders', () => {
  it('Chapter 1 opens with a family letter, then Hanil’s fax with three quotes', () => {
    const s = createChapter('ch1', 1);
    expect(s.decisions[0]!.kind).toBe('family');
    answerAll(s);
    step(s);
    const fax = s.decisions[0]!;
    expect(fax.kind).toBe('fax');
    expect(fax.options).toHaveLength(3);
    applyCommand(s, { type: 'decide', decision: fax.id, option: '0' });
    const o = activeOrder(s)!;
    expect(o).toMatchObject({ tag: 'hanil', product: 'shirt', qty: 1000, dueDay: 4, status: 'active' });
    expect(s.stations.every((st) => st.opId === null || st.opId.startsWith('shirt.'))).toBe(true);
  });

  it('the world waits while a card is open', () => {
    const s = createChapter('ch1', 1);
    const m = s.minute;
    step(s);
    step(s);
    expect(s.minute).toBe(m);
  });

  it('Ms. Park’s change adds 15% (rounded to bundles) to the same vessel', () => {
    const s = startCh1();
    answerAll(s);
    const o = activeOrder(s)!;
    const qty = o.qty;
    o.finished = 0;
    s.day = 3;
    s.minute = 7 * 60;
    step(s);
    const d = s.decisions.find((x) => x.kind === 'change')!;
    expect(d).toBeDefined();
    applyCommand(s, { type: 'decide', decision: d.id, option: 'accept' });
    expect(o.qty).toBe(qty + Math.ceil((qty * 0.15) / 10) * 10);
  });

  it('missing the vessel offers air freight (2 more days, half the value) or a short shipment', () => {
    const s = startCh1();
    applyCommand(s, { type: 'decide', decision: s.decisions[0]!.id, option: '0' });
    const o = activeOrder(s)!;
    s.day = o.dueDay;
    s.minute = TUNING.shiftEnd - 1;
    step(s);
    const d = s.decisions.find((x) => x.kind === 'cutoff')!;
    expect(d.options.map((x) => x.id)).toEqual(['air', 'short']);
    applyCommand(s, { type: 'decide', decision: d.id, option: 'air' });
    expect(o.airFreight).toBe(true);
    expect(o.dueDay).toBe(s.day + 2);
    // finish it: air freight is charged on shipment
    o.finished = o.qty;
    o.cut = 0;
    for (const st of s.stations) {
      st.pile = [];
      st.current = null;
    }
    step(s);
    expect(o.status).toBe('shipped');
    expect(o.onTime).toBe(false);
    expect(o.revenue).toBe(Math.round((o.qty / 12) * o.price) - Math.round((o.qty / 12) * o.price * TUNING.airFreightShare));
    expect(s.ledger.freight).toBe(Math.round((o.qty / 12) * o.price * TUNING.airFreightShare));
  });

  it('a short shipment pays for what is packed, minus a penalty on the rest', () => {
    const s = startCh1();
    applyCommand(s, { type: 'decide', decision: s.decisions[0]!.id, option: '0' });
    const o = activeOrder(s)!;
    o.finished = 600;
    s.day = o.dueDay;
    s.minute = TUNING.shiftEnd - 1;
    const cash = s.cash;
    step(s);
    applyCommand(s, { type: 'decide', decision: s.decisions[0]!.id, option: 'short' });
    expect(o.status).toBe('short');
    const expected = Math.round((600 / 12) * o.price) - Math.round(((o.qty - 600) / 12) * o.price * TUNING.shortShipPenaltyShare);
    expect(s.cash - cash).toBe(expected);
  });
});

describe('money, people and days', () => {
  it('wages, rent and electricity are paid at the end of each shift', () => {
    const s = startCh1();
    answerAll(s);
    const cash = s.cash;
    const wages = dailyWages(s);
    runShift(s, answerAll);
    expect(s.phase).toBe('report');
    const machines = s.stations.length;
    expect(cash - s.cash + s.ledger.revenue).toBeCloseTo(wages + 6 + machines * TUNING.electricityPerMachine, 1);
  });

  it('overtime runs the shift to 19:00 and costs a wage premium', () => {
    const a = startCh1();
    const b = startCh1();
    answerAll(a);
    answerAll(b);
    applyCommand(b, { type: 'overtime', on: true });
    runShift(a, answerAll);
    runShift(b, answerAll);
    expect(a.minute).toBe(TUNING.shiftEnd);
    expect(b.minute).toBe(TUNING.overtimeEnd);
    expect(b.ledger.wages).toBeGreaterThan(a.ledger.wages);
    expect(b.workers[0]!.fatigue).toBeGreaterThan(a.workers[0]!.fatigue);
  });

  it('hiring adds a worker to the bench; letting go pays two days of wages', () => {
    const s = startCh1();
    answerAll(s);
    const a = s.applicants[0]!;
    const n = s.workers.length;
    expect(applyCommand(s, { type: 'hire', applicant: a.id }).ok).toBe(true);
    expect(s.workers).toHaveLength(n + 1);
    const w = s.workers[n]!;
    expect(w.station).toBeNull();
    const cash = s.cash;
    applyCommand(s, { type: 'letGo', workerId: w.id });
    expect(s.workers).toHaveLength(n);
    expect(cash - s.cash).toBeCloseTo(w.wage * 2, 2);
  });

  it('sleeping starts the next day at 07:00 with new applicants and rested workers', () => {
    const s = startCh1();
    answerAll(s);
    applyCommand(s, { type: 'overtime', on: true });
    runShift(s, answerAll);
    const tired = s.workers[0]!.fatigue;
    const before = s.applicants.map((a) => a.id).join();
    endDay(s);
    expect(s.day).toBe(2);
    expect(s.minute).toBe(TUNING.shiftStart);
    expect(s.workers[0]!.fatigue).toBeLessThan(tired);
    expect(s.applicants.map((a) => a.id).join()).not.toBe(before);
  });

  it('machines being serviced at the end of a day are free the next morning (regression)', () => {
    const s = startCh1();
    answerAll(s);
    runShift(s, answerAll);
    s.stations[0]!.serviceUntil = 1100;
    endDay(s);
    expect(s.stations[0]!.serviceUntil).toBe(0);
  });

  it('two days in the red ends the chapter (bankruptcy)', () => {
    const s = startCh1();
    answerAll(s);
    s.cash = -500;
    runShift(s, answerAll);
    endDay(s);
    runShift(s, answerAll);
    expect(s.failed).toBe('bankrupt');
    expect(s.phase).toBe('done');
  });
});
