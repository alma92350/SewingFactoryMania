import { describe, expect, it } from 'vitest';
import { TUNING } from '../src/data/tuning';
import { applyCommand } from '../src/sim/commands';
import { activeOrder, opCapacities } from '../src/sim/selectors';
import { runShift } from '../src/sim/sim';
import { createChapter } from '../src/sim/state';

/** Line mechanics on the Chapter 0 workshop (one product, seven machines). */
describe('line math', () => {
  it('steady-state output equals the bottleneck capacity', () => {
    const s = createChapter('ch0', 1, { tuning: { breakBase: 0, learnStart: 1, learnFamiliar: 1, lunchStart: 2000, lunchEnd: 2000 } });
    applyCommand(s, { type: 'setOp', station: 3, opId: 'shorts.pocket' });
    applyCommand(s, { type: 'assign', workerId: 'lan', station: 3 });
    runShift(s, undefined, 540);
    const neck = Math.min(...Object.values(opCapacities(s)));
    const before = activeOrder(s)!.finished;
    runShift(s, undefined, 900);
    const perHour = ((activeOrder(s)!.finished - before) / 360) * 60;
    expect(perHour).toBeGreaterThan(neck * 0.9);
    expect(perHour).toBeLessThan(neck * 1.1);
  });

  it('a pile grows in front of the bottleneck and starves the stations after it', () => {
    const s = createChapter('ch0', 1, { tuning: { breakBase: 0 } });
    runShift(s, undefined, 660);
    expect(s.stations[2]!.pile.length).toBeGreaterThanOrEqual(5);
    expect(s.stations[4]!.pile.length).toBeLessThanOrEqual(1);
  });

  it('workers learn: speed on a new operation rises with pieces sewn', () => {
    const s = createChapter('ch0', 1, { tuning: { breakBase: 0 } });
    const huong = s.workers.find((w) => w.id === 'huong')!;
    expect(huong.learn['shorts.pocket']).toBe(TUNING.learnStart);
    runShift(s, undefined, 600);
    expect(huong.learn['shorts.pocket']!).toBeGreaterThan(TUNING.learnStart + 0.3);
  });

  it('nobody sews during lunch', () => {
    const s = createChapter('ch0', 1, { tuning: { breakBase: 0 } });
    runShift(s, undefined, TUNING.lunchStart);
    const before = s.stations.map((st) => st.output);
    runShift(s, undefined, TUNING.lunchEnd);
    expect(s.stations.map((st) => st.output)).toEqual(before);
  });

  it('a broken machine stops until someone fixes it', () => {
    const s = createChapter('ch0', 1, { tuning: { breakBase: 0 } });
    runShift(s, undefined, 480);
    const st = s.stations[1]!;
    st.broken = true;
    const out = st.output;
    runShift(s, undefined, 500);
    expect(st.output).toBe(out);
    expect(applyCommand(s, { type: 'fix', station: 1 }).ok).toBe(true);
    runShift(s, undefined, 500 + TUNING.fixMinutes + 5);
    expect(st.broken).toBe(false);
    expect(st.output).toBeGreaterThan(out);
  });

  it('pieces are conserved: cut = waiting + in progress + packed', () => {
    const s = createChapter('ch0', 5);
    runShift(s);
    const o = activeOrder(s)!;
    let inLine = 0;
    for (const st of s.stations) inLine += st.pile.reduce((a, b) => a + b.pieces, 0) + (st.current?.pieces ?? 0);
    const cutPieces = (Math.ceil(o.qty / TUNING.bundleSize) - o.cut) * TUNING.bundleSize;
    expect(o.finished + inLine).toBe(cutPieces);
  });
});

describe('commands', () => {
  it('assigning onto an occupied station swaps the two workers', () => {
    const s = createChapter('ch0', 1);
    expect(applyCommand(s, { type: 'assign', workerId: 'lan', station: 2 }).ok).toBe(true);
    expect(s.stations[2]!.workerId).toBe('lan');
    expect(s.workers.find((w) => w.id === 'huong')!.station).toBeNull();
    expect(applyCommand(s, { type: 'assign', workerId: 'thao', station: 2 }).ok).toBe(true);
    expect(s.stations[1]!.workerId).toBe('lan');
    expect(s.stations[2]!.workerId).toBe('thao');
  });

  it('rejects invalid commands with a reason', () => {
    const s = createChapter('ch0', 1);
    expect(applyCommand(s, { type: 'setOp', station: 3, opId: 'shorts.join' })).toMatchObject({ ok: false });
    expect(applyCommand(s, { type: 'setOp', station: 2, opId: null })).toMatchObject({ ok: false });
    expect(applyCommand(s, { type: 'fix', station: 0 })).toMatchObject({ ok: false });
    expect(applyCommand(s, { type: 'assign', workerId: 'hoa', station: 0 })).toMatchObject({ ok: false });
    expect(applyCommand(s, { type: 'hire', applicant: 'x' })).toMatchObject({ ok: false });
    expect(applyCommand(s, { type: 'overtime', on: true })).toMatchObject({ ok: false });
  });

  it('moving a machine off an operation hands its bundles to another machine on it', () => {
    const s = createChapter('ch0', 1, { tuning: { breakBase: 0 } });
    applyCommand(s, { type: 'setOp', station: 3, opId: 'shorts.pocket' });
    runShift(s, undefined, 600);
    const count = (i: number) => s.stations[i]!.pile.length + (s.stations[i]!.current ? 1 : 0);
    const total = count(2) + count(3);
    expect(applyCommand(s, { type: 'setOp', station: 3, opId: 'shorts.waist' }).ok).toBe(true);
    expect(count(2)).toBe(total);
  });
});
