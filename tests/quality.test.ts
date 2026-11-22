import { describe, expect, it } from 'vitest';
import { applyCommand } from '../src/sim/commands';
import { recheckLot, runInspection } from '../src/sim/orders';
import { activeOrder, aqlPlan } from '../src/sim/selectors';
import { runShift, step } from '../src/sim/sim';
import { createChapter } from '../src/sim/state';
import type { GameState } from '../src/sim/types';
import { makeBot } from '../src/sim/autopilot';
import { answerAll, playChapter, SEEDS } from './helpers';

function startCh2(seed = 1, family = 'join'): GameState {
  const s = createChapter('ch2', seed);
  answerAll(s, { family: { 'ch2.ut': family } });
  step(s);
  answerAll(s); // fax: catalogue lot; sample: skip
  return s;
}

describe('AQL inspection', () => {
  it('sample size grows with the lot; strict buyers accept fewer defects', () => {
    expect(aqlPlan(100, 'strict', 0)).toEqual({ sample: 20, accept: 0 });
    expect(aqlPlan(800, 'strict', 0)).toEqual({ sample: 80, accept: 2 });
    expect(aqlPlan(800, 'relaxed', 0)).toEqual({ sample: 80, accept: 7 });
    expect(aqlPlan(2000, 'normal', 0)).toEqual({ sample: 125, accept: 7 });
    expect(aqlPlan(800, 'strict', -1).accept).toBe(1);
  });

  it('a clean lot passes and a dirty lot fails', () => {
    const s = startCh2();
    const o = activeOrder(s)!;
    o.finished = 800;
    o.lotDefects = 0;
    runInspection(s, o, []);
    expect(o.inspections.at(-1)!.passed).toBe(true);
    s.decisions = [];
    o.lotDefects = 200;
    runInspection(s, o, []);
    expect(o.inspections.at(-1)!.passed).toBe(false);
    expect(s.decisions.at(-1)!.options.map((x) => x.id)).toEqual(['recheck', 'anyway']);
  });

  it('re-checking a rejected lot sends defects back to the operation that made them', () => {
    const s = startCh2();
    const o = activeOrder(s)!;
    o.finished = 800;
    o.lotDefects = 40;
    o.lotOrigins = { 'polo.placket': 30, 'polo.collar': 10 };
    const caught = recheckLot(s, o);
    expect(caught).toBeGreaterThan(20);
    expect(o.finished).toBe(800 - caught);
    expect(o.lotDefects).toBe(40 - caught);
    const rework = s.stations.flatMap((st) => st.pile.filter((b) => b.rework).map((b) => ({ op: st.opId, n: b.pieces })));
    expect(rework.reduce((a, r) => a + r.n, 0)).toBe(caught);
    expect(rework.every((r) => r.op === 'polo.placket' || r.op === 'polo.collar')).toBe(true);
  });
});

describe('defects and the QC table', () => {
  it('every defect has recorded causes (skill, learning, wear, fatigue) and a worker', () => {
    const s = startCh2();
    runShift(s, answerAll);
    const o = activeOrder(s)!;
    const causes = Object.values(o.causes);
    expect(causes.length).toBeGreaterThan(0);
    for (const c of causes) {
      expect(c.skill + c.learn + c.wear + c.fatigue).toBeCloseTo(c.count, 5);
      expect(Object.values(c.byWorker).reduce((a, b) => a + b, 0)).toBe(c.count);
    }
  });

  it('a staffed QC table catches defects before packing; an empty one lets them through', () => {
    const run = (staffQc: boolean) => {
      const s = startCh2(3);
      // same two extra operators in both runs, so the line is fully staffed
      for (const a of s.applicants.filter((x) => x.role === 'operator').slice(0, 2)) applyCommand(s, { type: 'hire', applicant: a.id });
      if (staffQc) applyCommand(s, { type: 'hire', applicant: s.applicants.find((a) => a.role === 'qc')!.id });
      runShift(s, makeBot({ hire: false }));
      return activeOrder(s)!;
    };
    const without = run(false);
    const withQc = run(true);
    expect(without.caughtByQc).toBe(0);
    expect(withQc.caughtByQc).toBeGreaterThan(0);
    const rate = (o: ReturnType<typeof run>) => o.lotDefects / Math.max(1, o.finished);
    expect(rate(withQc)).toBeLessThan(rate(without));
  });

  it('a mechanic fixes breakdowns without being asked and changes worn needles', () => {
    const s = startCh2(2);
    applyCommand(s, { type: 'hire', applicant: s.applicants.find((a) => a.role === 'mechanic')!.id });
    s.stations[0]!.broken = true;
    s.stations[1]!.wear = 0.9;
    runShift(s, answerAll, s.minute + 40);
    expect(s.stations[0]!.broken).toBe(false);
    expect(s.stations[1]!.wear).toBeLessThan(0.9);
  });

  it('the sample check lowers defects for that order', () => {
    const s = createChapter('ch2', 1);
    answerAll(s, { family: { 'ch2.ut': 'join' } });
    step(s);
    const fax = s.decisions[0]!;
    applyCommand(s, { type: 'decide', decision: fax.id, option: '1' });
    const sample = s.decisions.find((d) => d.kind === 'sample')!;
    expect(applyCommand(s, { type: 'decide', decision: sample.id, option: 'play' }).ok).toBe(false);
    applyCommand(s, { type: 'sample', decision: sample.id, found: 3 });
    expect(activeOrder(s)!.sampleFactor).toBe(0.7);
  });

  it('Út studying in Osaka approves Sakura-ya samples with the best rating', () => {
    const s = startCh2(1, 'osaka');
    expect(activeOrder(s)!.sampleFactor).toBe(0.7);
    expect(s.workers.some((w) => w.id === 'ut')).toBe(false);
  });

  it('every failed inspection in bot play is traceable to recorded causes', () => {
    for (const seed of SEEDS) {
      const s = playChapter('ch2', seed);
      for (const o of s.orders) {
        if (o.inspections.some((i) => !i.passed)) expect(Object.values(o.causes).reduce((a, c) => a + c.count, 0)).toBeGreaterThan(0);
      }
    }
  });
});
