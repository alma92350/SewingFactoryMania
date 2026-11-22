import { describe, expect, it } from 'vitest';
import { makeBot } from '../src/sim/autopilot';
import { applyCommand } from '../src/sim/commands';
import { lineCanMake } from '../src/sim/orders';
import { stationStopped } from '../src/sim/selectors';
import { endDay, runChapter, runShift, step } from '../src/sim/sim';
import { createChapter } from '../src/sim/state';
import type { GameState } from '../src/sim/types';
import { answerAll, playChapter, SEEDS } from './helpers';

function startCh4(seed = 1): GameState {
  const s = createChapter('ch4', seed);
  answerAll(s);
  step(s);
  answerAll(s);
  return s;
}

describe('two lines', () => {
  it('jeans can only go to the line with a bartack machine', () => {
    const s = startCh4();
    expect(lineCanMake(s, 0, 'jeans')).toBe(false);
    expect(lineCanMake(s, 1, 'jeans')).toBe(true);
    const jeans = s.orders.find((o) => o.product === 'jeans')!;
    const jackets = s.orders.find((o) => o.product === 'workwear')!;
    expect(jeans.line).toBe(1);
    expect(jackets.line).toBe(0);
    expect(s.lines[0]!.activeOrderId).toBe(jackets.id);
    expect(s.lines[1]!.activeOrderId).toBe(jeans.id);
  });

  it('bundles stay on their own line', () => {
    const s = startCh4();
    runShift(s, makeBot());
    for (const st of s.stations) {
      for (const b of [...st.pile, ...(st.current ? [st.current] : [])]) {
        if (st.machine === 'cutting') continue;
        expect(s.orders.find((o) => o.id === b.orderId)!.line).toBe(st.line);
      }
    }
  });
});

describe('power cuts and the generator', () => {
  it('a power cut stops sewing machines but not the QC or cutting tables', () => {
    const s = startCh4();
    s.power!.off = true;
    const sewing = s.stations.find((st) => st.machine === 'lockstitch')!;
    const qc = s.stations.find((st) => st.machine === 'qc')!;
    const cut = s.stations.find((st) => st.machine === 'cutting')!;
    expect(stationStopped(s, sewing)).toBe(true);
    expect(stationStopped(s, qc)).toBe(false);
    expect(stationStopped(s, cut)).toBe(false);
    s.power!.generator.running = true;
    expect(stationStopped(s, sewing)).toBe(false);
  });

  it('without an electrician a card asks whether to start the generator', () => {
    const s = startCh4();
    s.power!.cuts = [{ start: s.minute + 1, end: s.minute + 60 }];
    s.power!.generator.tested = true;
    step(s);
    step(s);
    const d = s.decisions.find((x) => x.kind === 'power')!;
    expect(d).toBeDefined();
    applyCommand(s, { type: 'decide', decision: d.id, option: 'start' });
    runShift(s, undefined, s.minute + s.tuning.generatorStartMinutes + 2);
    expect(s.power!.generator.running).toBe(true);
    runShift(s, undefined, s.power!.cuts[0]!.end + 1);
    expect(s.power!.off).toBe(false);
    expect(s.power!.generator.running).toBe(false);
  });

  it('an electrician starts the generator by himself within minutes', () => {
    const s = startCh4();
    const e = s.applicants.find((a) => a.role === 'electrician')!;
    applyCommand(s, { type: 'hire', applicant: e.id });
    s.power!.cuts = [{ start: s.minute + 1, end: s.minute + 90 }];
    runShift(s, undefined, s.minute + 1 + s.tuning.electricianStartMinutes + 2);
    expect(s.decisions.some((x) => x.kind === 'power')).toBe(false);
    expect(s.power!.generator.running).toBe(true);
  });

  it('minutes without power are counted (★★★ needs few)', () => {
    const s = startCh4();
    s.power!.cuts = [{ start: s.minute + 1, end: s.minute + 31 }];
    runShift(s, (x) => {
      for (const d of [...x.decisions]) applyCommand(x, { type: 'decide', decision: d.id, option: d.kind === 'power' ? 'wait' : d.options[0]!.id });
    }, s.minute + 40);
    expect(s.power!.minutesLost).toBe(30);
  });
});

describe('rain and the flood', () => {
  it('on a rainy morning the leaking roof spoils rolls on the floor, unless they are on pallets', () => {
    const run = (pallets: boolean) => {
      const s = startCh4();
      if (pallets) applyCommand(s, { type: 'pallets' });
      for (const r of s.warehouse) r.dry = pallets;
      s.power!.rain = true;
      s.power!.cuts = [];
      runShift(s, answerAll, 9 * 60 + 2);
      return s.warehouse.filter((r) => r.condition === 'flawed').length;
    };
    expect(run(false)).toBeGreaterThan(0);
    expect(run(true)).toBe(0);
  });

  it('helping in the flood closes the afternoon and brings two strong applicants the next morning', () => {
    const s = createChapter('ch4', 3);
    runChapter(s, makeBot({ family: { 'ch4.flood': 'help' } }), 0);
    // play to day 4 07:00, answer the flood with "help"
    const bot = makeBot({ family: { 'ch4.flood': 'help' } });
    while (!(s.day === 4 && s.minute > 7 * 60) && s.phase !== 'done') {
      bot(s);
      if (s.phase === 'report') endDay(s);
      else step(s);
    }
    expect(s.campaign['ch4.flood']).toBe('help');
    expect(s.power!.closedFrom).toBe(13 * 60);
    runShift(s, bot);
    endDay(s);
    expect(s.applicants.slice(0, 2).every((a) => a.note.includes('flood'))).toBe(true);
  });
});

describe('line leaders', () => {
  it('a leader seats bench workers on their line and covers empty steps', () => {
    const s = startCh4();
    const l = s.applicants.find((a) => a.role === 'leader')!;
    applyCommand(s, { type: 'hire', applicant: l.id });
    const leader = s.workers.at(-1)!;
    expect(applyCommand(s, { type: 'assign', workerId: leader.id, station: 1 })).toMatchObject({ ok: false });
    expect(applyCommand(s, { type: 'lead', workerId: leader.id, line: 1 }).ok).toBe(true);
    // put two operators on the bench; the leader should seat them on line B within 15 minutes
    for (const a of s.applicants.filter((x) => x.role === 'operator').slice(0, 2)) applyCommand(s, { type: 'hire', applicant: a.id });
    runShift(s, answerAll, s.minute + 20);
    const benchOps = s.workers.filter((w) => w.role === 'operator' && w.station === null && !w.absent);
    expect(benchOps).toHaveLength(0);
  });

  it('line leaders take the balancing off the player', () => {
    const run = (noLeaders: boolean, seed: number) => {
      const balance = { n: 0 };
      const s = createChapter('ch4', seed);
      runChapter(s, makeBot({ noLeaders, balance }));
      return { player: balance.n, leaders: s.stats.leaderMoves };
    };
    const sum = (noLeaders: boolean) =>
      SEEDS.slice(0, 4)
        .map((seed) => run(noLeaders, seed))
        .reduce((a, r) => ({ player: a.player + r.player, leaders: a.leaders + r.leaders }), { player: 0, leaders: 0 });
    const led = sum(false);
    const alone = sum(true);
    expect(led.leaders).toBeGreaterThan(0);
    expect(alone.leaders).toBe(0);
    expect(led.player).toBeLessThan(alone.player);
  });

  it('both flood choices can win Chapter 4', () => {
    for (const flood of ['help', 'keep']) {
      const s = playChapter('ch4', 3, { family: { 'ch4.flood': flood } });
      expect(s.orders.find((o) => o.tag === 'formosa')!.onTime).toBe(true);
    }
  });
});
