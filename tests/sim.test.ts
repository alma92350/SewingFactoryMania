import { describe, expect, it } from 'vitest';
import { TUNING } from '../src/data/prototype';
import { autopilot } from '../src/sim/autopilot';
import { applyCommand } from '../src/sim/commands';
import { opCapacities, stars } from '../src/sim/selectors';
import { runShift, step } from '../src/sim/sim';
import { cloneState, createState } from '../src/sim/state';
import type { GameState } from '../src/sim/types';

const SEEDS = Array.from({ length: 16 }, (_, i) => i + 1);

function play(seed: number, each?: (s: GameState) => void): GameState {
  const s = createState(seed);
  runShift(s, each);
  return s;
}

describe('determinism', () => {
  it('same seed and same commands give the same world', () => {
    const a = play(7, autopilot);
    const b = play(7, autopilot);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('state survives a JSON round trip mid-shift and continues identically', () => {
    const a = createState(3);
    runShift(a, autopilot, 600);
    const b = cloneState(a);
    runShift(a, autopilot);
    runShift(b, autopilot);
    expect(b.finished).toBe(a.finished);
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
  });

  it('different seeds give different shifts', () => {
    const results = new Set(SEEDS.map((seed) => JSON.stringify(play(seed, autopilot).stations.map((s) => s.output))));
    expect(results.size).toBeGreaterThan(1);
  });
});

describe('line math', () => {
  it('steady-state output equals the bottleneck capacity', () => {
    // no breakdowns, everyone fully trained: output is set by the slowest operation
    const s = createState(1, { breakBase: 0, learnStart: 1, learnFamiliar: 1, lunchStart: 2000, lunchEnd: 2000, cutBundles: 999 });
    applyCommand(s, { type: 'setOp', station: 3, opId: 'pocket' });
    applyCommand(s, { type: 'assign', workerId: 'lan', station: 3 });
    runShift(s, undefined, 540); // warm up
    const neck = Math.min(...Object.values(opCapacities(s))); // pieces per hour
    const before = s.finished;
    runShift(s, undefined, 900);
    const perHour = ((s.finished - before) / 360) * 60;
    expect(perHour).toBeGreaterThan(neck * 0.93);
    expect(perHour).toBeLessThan(neck * 1.07);
  });

  it('a pile grows in front of the bottleneck and starves the stations after it', () => {
    const s = createState(1, { breakBase: 0 });
    runShift(s, undefined, 660);
    const pocket = s.stations[2]!;
    const waist = s.stations[4]!;
    expect(pocket.pile.length).toBeGreaterThanOrEqual(5);
    expect(waist.pile.length).toBeLessThanOrEqual(1);
  });

  it('workers learn: speed on a new operation rises with pieces sewn', () => {
    const s = createState(1, { breakBase: 0 });
    const huong = s.workers.find((w) => w.id === 'huong')!;
    const start = huong.learn.pocket!;
    runShift(s, undefined, 600);
    expect(start).toBe(TUNING.learnStart);
    expect(huong.learn.pocket!).toBeGreaterThan(start + 0.3);
  });

  it('nobody sews during lunch', () => {
    const s = createState(1, { breakBase: 0 });
    runShift(s, undefined, TUNING.lunchStart);
    const before = s.stations.map((st) => st.output);
    runShift(s, undefined, TUNING.lunchEnd);
    expect(s.stations.map((st) => st.output)).toEqual(before);
  });

  it('a broken machine stops until the director fixes it', () => {
    const s = createState(1, { breakBase: 0 });
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
});

describe('commands', () => {
  it('assigning onto an occupied station swaps the two workers', () => {
    const s = createState(1);
    expect(applyCommand(s, { type: 'assign', workerId: 'lan', station: 2 }).ok).toBe(true);
    expect(s.stations[2]!.workerId).toBe('lan');
    expect(s.workers.find((w) => w.id === 'huong')!.station).toBeNull();
    expect(applyCommand(s, { type: 'assign', workerId: 'thao', station: 2 }).ok).toBe(true);
    expect(s.stations[1]!.workerId).toBe('lan');
    expect(s.stations[2]!.workerId).toBe('thao');
  });

  it('a walking worker does not sew until she arrives', () => {
    const s = createState(1, { breakBase: 0 });
    applyCommand(s, { type: 'assign', workerId: 'lan', station: 6 });
    const lan = s.workers.find((w) => w.id === 'lan')!;
    expect(lan.arriveAt).toBeGreaterThan(s.minute);
  });

  it('rejects invalid commands with a reason', () => {
    const s = createState(1);
    expect(applyCommand(s, { type: 'setOp', station: 3, opId: 'join' })).toMatchObject({ ok: false });
    expect(applyCommand(s, { type: 'setOp', station: 2, opId: null })).toMatchObject({ ok: false }); // pocket's only machine
    expect(applyCommand(s, { type: 'fix', station: 0 })).toMatchObject({ ok: false });
    expect(applyCommand(s, { type: 'assign', workerId: 'hoa', station: 0 })).toMatchObject({ ok: false });
  });

  it('moving a machine off an operation hands its bundles to another machine on that operation', () => {
    const s = createState(1, { breakBase: 0 });
    applyCommand(s, { type: 'setOp', station: 3, opId: 'pocket' });
    runShift(s, undefined, 600);
    const total = s.stations[2]!.pile.length + s.stations[3]!.pile.length + (s.stations[3]!.current ? 1 : 0) + (s.stations[2]!.current ? 1 : 0);
    expect(applyCommand(s, { type: 'setOp', station: 3, opId: 'waist' }).ok).toBe(true);
    expect(s.stations[2]!.pile.length + (s.stations[2]!.current ? 1 : 0)).toBe(total);
  });

  it('pieces are conserved: cut = waiting + in progress + finished', () => {
    const s = play(5, autopilot);
    let inLine = 0;
    for (const st of s.stations) inLine += st.pile.length * TUNING.bundleSize + (st.current ? TUNING.bundleSize : 0);
    expect(s.finished + inLine + s.cutStack * TUNING.bundleSize).toBe(TUNING.cutBundles * TUNING.bundleSize);
  });
});

describe('balance (autopilot = competent player)', () => {
  const bot = SEEDS.map((seed) => play(seed, autopilot));
  const idle = SEEDS.map((seed) => play(seed));

  it('the bot passes ★ on every seed', () => {
    expect(bot.map(stars).every((n) => n >= 1)).toBe(true);
  });

  it('doing nothing fails on every seed', () => {
    expect(idle.map(stars).every((n) => n === 0)).toBe(true);
  });

  it('★★★ is not free: the bot reaches it on at most 1 seed in 8', () => {
    expect(bot.filter((s) => stars(s) === 3).length).toBeLessThanOrEqual(SEEDS.length / 8);
  });

  it('breakdowns stay readable: 1–8 per shift, about 3 on average', () => {
    const counts = bot.map((s) => s.breakdowns);
    expect(Math.min(...counts)).toBeGreaterThanOrEqual(1);
    expect(Math.max(...counts)).toBeLessThanOrEqual(8);
    const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
    expect(avg).toBeGreaterThan(2);
    expect(avg).toBeLessThan(6);
  });
});

describe('pacing (PRD §18)', () => {
  it('one shift lasts 6–8 real minutes at 1×', () => {
    const seconds = (TUNING.shiftEnd - TUNING.shiftStart) / TUNING.gameMinutesPerSecond;
    expect(seconds / 60).toBeGreaterThanOrEqual(6);
    expect(seconds / 60).toBeLessThanOrEqual(8);
  });

  it('the player always has something to watch: no 90-second stretch without a bundle moving', () => {
    const s = createState(2);
    let last = s.minute;
    let longest = 0;
    while (!s.ended) {
      autopilot(s);
      const ev = step(s);
      const lunch = s.minute > TUNING.lunchStart && s.minute <= TUNING.lunchEnd;
      if (lunch || ev.some((e) => e.kind === 'bundleDone')) last = s.minute;
      longest = Math.max(longest, s.minute - last);
    }
    expect(longest / TUNING.gameMinutesPerSecond).toBeLessThan(90);
  });
});
