import { describe, expect, it } from 'vitest';
import { ROLL_METRES, SUPPLIERS } from '../src/data/suppliers';
import { applyCommand } from '../src/sim/commands';
import { metresInStock, metresPerBundle, rollsToBuy, scrapForRecut } from '../src/sim/sourcing';
import { endDay, runShift, step } from '../src/sim/sim';
import { createChapter } from '../src/sim/state';
import type { GameState, Order } from '../src/sim/types';
import { makeBot } from '../src/sim/autopilot';
import { answerAll, playChapter } from './helpers';

function startCh3(seed = 1, loan = 'borrow'): GameState {
  const s = createChapter('ch3', seed);
  answerAll(s, { family: { 'ch3.loan': loan } });
  step(s); // both faxes arrive at 07:00
  answerAll(s); // Hanil CMT, Mr. Leung FOB (middle quote), standard marker
  return s;
}
const golden = (s: GameState): Order => s.orders.find((o) => o.tag === 'golden')!;
const hanil = (s: GameState): Order => s.orders.find((o) => o.tag === 'hanil3')!;

describe('CMT and FOB', () => {
  it('CMT fabric arrives with the order; FOB fabric must be bought', () => {
    const s = startCh3();
    expect(hanil(s).mode).toBe('cmt');
    expect(golden(s).mode).toBe('fob');
    expect(metresInStock(s, hanil(s).id)).toBeGreaterThanOrEqual(60 * metresPerBundle(s, hanil(s)));
    expect(metresInStock(s, golden(s).id)).toBe(0);
    expect(rollsToBuy(s, golden(s))).toBe(Math.ceil((90 * metresPerBundle(s, golden(s))) / ROLL_METRES));
  });

  it('a tighter marker means fewer rolls to buy', () => {
    const s = createChapter('ch3', 1);
    answerAll(s, { family: { 'ch3.loan': 'borrow' } });
    step(s);
    const fax = s.decisions.find((d) => d.fax?.tag === 'golden')!;
    applyCommand(s, { type: 'decide', decision: fax.id, option: '1' });
    const marker = s.decisions.find((d) => d.kind === 'marker')!;
    expect(applyCommand(s, { type: 'decide', decision: marker.id, option: 'play' }).ok).toBe(false);
    const auto = rollsToBuy(s, golden(s));
    applyCommand(s, { type: 'marker', decision: marker.id, eff: 0.92 });
    expect(rollsToBuy(s, golden(s))).toBeLessThan(auto);
  });

  it('buying costs cash now and the fabric arrives after the supplier’s lead time', () => {
    const s = startCh3();
    const cash = s.cash;
    expect(applyCommand(s, { type: 'buy', supplier: 'binhminh', orderId: golden(s).id, rolls: 5 }).ok).toBe(true);
    expect(cash - s.cash).toBe(5 * SUPPLIERS.binhminh!.price);
    const sh = s.shipments[0]!;
    expect(sh.arriveDay).toBeGreaterThanOrEqual(s.day + SUPPLIERS.binhminh!.leadDays);
    expect(applyCommand(s, { type: 'buy', supplier: 'daegu', orderId: hanil(s).id, rolls: 5 })).toMatchObject({ ok: false });
    expect(applyCommand(s, { type: 'buy', supplier: 'daegu', orderId: golden(s).id, rolls: 999 })).toMatchObject({ ok: false });
  });

  it('an arriving shipment asks for inspection; rejected bad rolls are refunded', () => {
    const s = startCh3(2);
    applyCommand(s, { type: 'buy', supplier: 'binhminh', orderId: golden(s).id, rolls: 20 });
    const sh = s.shipments[0]!;
    sh.arriveDay = s.day;
    sh.arriveMinute = s.minute + 1;
    sh.wrongColour = true; // every roll off-shade
    step(s);
    step(s);
    const d = s.decisions.find((x) => x.kind === 'fabric')!;
    expect(d).toBeDefined();
    const rolls = s.warehouse.filter((r) => r.orderId === golden(s).id);
    expect(rolls).toHaveLength(20);
    expect(rolls.every((r) => r.condition === 'offShade')).toBe(true);
    const cash = s.cash;
    applyCommand(s, { type: 'fabricResult', decision: d.id, rolls: rolls.slice(0, 5).map((r) => r.id) });
    expect(s.cash - cash).toBe(5 * SUPPLIERS.binhminh!.price);
    expect(metresInStock(s, golden(s).id)).toBe(15 * ROLL_METRES);
  });
});

describe('the cutting table', () => {
  it('nothing reaches the line until someone cuts; the cutter turns fabric into bundles', () => {
    const s = startCh3();
    const h = hanil(s);
    expect(h.cut).toBe(0);
    expect(h.uncut).toBe(60);
    // seat Út (or anyone) at the cutting table
    applyCommand(s, { type: 'assign', workerId: 'linh', station: 0 });
    const before = metresInStock(s, h.id);
    runShift(s, answerAll, 9 * 60);
    expect(h.uncut).toBeLessThan(60);
    expect(metresInStock(s, h.id)).toBeLessThan(before);
  });

  it('off-shade fabric spoils every piece cut from it, traced to the fabric', () => {
    const s = startCh3();
    for (const r of s.warehouse) if (r.orderId === hanil(s).id) r.condition = 'offShade';
    runShift(s, makeBot());
    const h = hanil(s);
    expect(h.causes.fabric?.count ?? 0).toBeGreaterThan(0);
    expect(h.causes.fabric!.fabric).toBe(h.causes.fabric!.count);
  });

  it('scrapped pieces are cut again, rounded up to a whole bundle (regression)', () => {
    const s = startCh3();
    const h = hanil(s);
    const uncut = h.uncut;
    scrapForRecut(s, h, 3);
    expect(h.uncut).toBe(uncut + 1);
  });
});

describe('family loan', () => {
  it('borrowing gives $300 now and costs $330 at the end of the chapter', () => {
    const yes = createChapter('ch3', 1);
    const no = createChapter('ch3', 1);
    answerAll(yes, { family: { 'ch3.loan': 'borrow' } });
    answerAll(no, { family: { 'ch3.loan': 'no' } });
    expect(yes.cash - no.cash).toBe(300);
    expect(yes.loan).toBe(330);
    yes.day = 7;
    yes.phase = 'report';
    const cash = yes.cash;
    endDay(yes);
    expect(cash - yes.cash).toBeGreaterThanOrEqual(330);
    expect(yes.loan).toBe(0);
  });

  it('both loan choices can win Chapter 3', () => {
    for (const loan of ['borrow', 'no']) {
      const s = playChapter('ch3', 3, { family: { 'ch3.loan': loan } });
      expect(golden(s).status).toBe('shipped');
    }
  });
});
