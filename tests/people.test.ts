import { describe, expect, it } from 'vitest';
import { makeBot } from '../src/sim/autopilot';
import { applyCommand } from '../src/sim/commands';
import { bonusCost, nightlyMorale, nightlyQuits, tetReturns } from '../src/sim/morale';
import { stars } from '../src/sim/objectives';
import { stationEfficiency } from '../src/sim/selectors';
import { endDay, runChapter, runShift, step } from '../src/sim/sim';
import { createChapter } from '../src/sim/state';
import type { GameState } from '../src/sim/types';
import { answerAll, playChapter, SEEDS } from './helpers';

function startCh5(seed = 1): GameState {
  const s = createChapter('ch5', seed);
  answerAll(s);
  step(s);
  answerAll(s);
  return s;
}

describe('Chapter 5 crew', () => {
  it('starts with veterans seated on the empty machines of all three lines', () => {
    const s = createChapter('ch5', 1);
    expect(s.lines).toHaveLength(3);
    expect(s.workers.filter((w) => /^v\d+$/.test(w.id)).length).toBe(14);
    for (let l = 0; l < 3; l++) expect(s.stations.filter((st) => st.line === l && st.workerId).length).toBeGreaterThan(5);
  });

  it('Bác Tư’s scissors make the chosen seamstress better', () => {
    const s = createChapter('ch5', 1);
    const before = s.workers.find((w) => w.id === 'thao')!.skill.lockstitch;
    const d = s.decisions.find((x) => x.flag === 'ch5.scissors')!;
    applyCommand(s, { type: 'decide', decision: d.id, option: 'thao' });
    const thao = s.workers.find((w) => w.id === 'thao')!;
    expect(thao.skill.lockstitch).toBeCloseTo(Math.min(1, before + 0.15), 2);
    expect(thao.traits).toContain('scissors');
  });
});

describe('morale', () => {
  it('welfare raises morale every night, overtime lowers it', () => {
    const a = startCh5();
    const b = startCh5();
    for (const item of ['fans', 'canteen', 'water'] as const) a.welfare[item] = true;
    for (let i = 0; i < 3; i++) {
      nightlyMorale(a, false);
      nightlyMorale(b, true);
    }
    const avg = (s: GameState) => s.workers.reduce((x, w) => x + w.morale, 0) / s.workers.length;
    expect(avg(a)).toBeGreaterThan(avg(b) + 0.2);
  });

  it('morale changes speed and quality', () => {
    const s = startCh5();
    const st = s.stations.find((x) => x.workerId && x.opId && x.machine === 'lockstitch')!;
    const w = s.workers.find((x) => x.id === st.workerId)!;
    w.morale = 1;
    const happy = stationEfficiency(s, st);
    w.morale = 0.2;
    expect(stationEfficiency(s, st)).toBeLessThan(happy * 0.8);
  });

  it('very unhappy workers quit overnight', () => {
    const s = startCh5();
    for (const w of s.workers) w.morale = 0.1;
    const n = s.workers.length;
    nightlyQuits(s, []);
    expect(s.workers.length).toBeLessThan(n);
    expect(s.stats.quits).toBe(n - s.workers.length);
  });

  it('clean water and a first-aid corner mean fewer sick days', () => {
    const sick = (water: boolean) =>
      SEEDS.reduce((acc, seed) => {
        const s = startCh5(seed);
        s.welfare.water = water;
        for (let d = 0; d < 3; d++) {
          runShift(s, answerAll);
          endDay(s);
          answerAll(s);
        }
        return acc + s.stats.sickDays;
      }, 0);
    expect(sick(true)).toBeLessThan(sick(false));
  });

  it('the 1994 Labour Code caps overtime at three evenings', () => {
    const s = startCh5();
    s.stats.overtimeDays = 3;
    expect(applyCommand(s, { type: 'overtime', on: true })).toMatchObject({ ok: false });
    s.stats.overtimeDays = 2;
    expect(applyCommand(s, { type: 'overtime', on: true }).ok).toBe(true);
  });

  it('welfare costs cash once and cannot be bought twice', () => {
    const s = startCh5();
    const cash = s.cash;
    expect(applyCommand(s, { type: 'welfare', item: 'canteen' }).ok).toBe(true);
    expect(cash - s.cash).toBe(s.tuning.welfareCost.canteen);
    expect(applyCommand(s, { type: 'welfare', item: 'canteen' })).toMatchObject({ ok: false });
  });
});

describe('Tết', () => {
  function toTet(seed: number, bonus: 'pay' | 'no', tet: 'home' | 'stay'): GameState {
    const s = createChapter('ch5', seed);
    const bot = makeBot();
    for (let i = 0; i < 60000 && s.phase !== 'done'; i++) {
      const b = s.decisions.find((d) => d.kind === 'bonus');
      if (b) applyCommand(s, { type: 'decide', decision: b.id, option: bonus });
      const t = s.decisions.find((d) => d.flag === 'ch5.tet');
      if (t) {
        applyCommand(s, { type: 'decide', decision: t.id, option: tet });
        return s;
      }
      bot(s);
      if (s.phase === 'report') endDay(s);
      else step(s);
    }
    return s;
  }

  it('the 13th-month bonus card arrives on day 4 and costs five days of wages', () => {
    const s = createChapter('ch5', 2);
    const bot = makeBot();
    while (!s.decisions.some((d) => d.kind === 'bonus') && s.phase !== 'done') {
      bot(s);
      if (s.phase === 'report') endDay(s);
      else step(s);
      if (s.decisions.some((d) => d.kind === 'bonus')) break;
    }
    expect(s.day).toBe(4);
    const cost = bonusCost(s);
    const cash = s.cash;
    applyCommand(s, { type: 'decide', decision: s.decisions.find((d) => d.kind === 'bonus')!.id, option: 'pay' });
    expect(cash - s.cash).toBe(cost);
    expect(s.tet!.bonusPaid).toBe(true);
  });

  it('going home closes the factory for the day: no work, no wages', () => {
    const s = toTet(1, 'pay', 'home');
    expect(s.day).toBe(5);
    const out = s.stats.dayPieces;
    step(s);
    expect(s.phase).toBe('report');
    expect(s.history.at(-1)!.ledger.wages).toBe(0);
    expect(s.stats.dayPieces).toBe(out);
  });

  it('opening on Tết brings about 40% of the crew at double pay', () => {
    const s = toTet(1, 'pay', 'stay');
    const present = s.workers.filter((w) => !w.absent).length / s.workers.length;
    expect(present).toBeGreaterThan(0.2);
    expect(present).toBeLessThan(0.65);
  });

  it('the bonus and good morale bring more people back after Tết', () => {
    const back = (bonus: boolean) =>
      SEEDS.reduce((acc, seed) => {
        const s = startCh5(seed);
        if (bonus) s.tet!.bonusPaid = true;
        const before = s.workers.length;
        tetReturns(s, []);
        return acc + s.workers.length / before;
      }, 0) / SEEDS.length;
    expect(back(true)).toBeGreaterThan(back(false) + 0.08);
  });
});

describe('mentoring', () => {
  it('a junior gains skill from her mentor; the mentor sews a little slower', () => {
    const s = startCh5(3);
    const seat = s.stations.find((st) => st.machine === 'lockstitch' && st.workerId && st.opId)!;
    const junior = s.workers.find((w) => w.id === seat.workerId)!;
    junior.skill.lockstitch = 0.5;
    const senior = s.workers.find((w) => w.id === 'lan')!;
    const seniorSeat = s.stations[senior.station!]!;
    const before = stationEfficiency(s, seniorSeat);
    expect(applyCommand(s, { type: 'mentor', junior: junior.id, senior: senior.id }).ok).toBe(true);
    expect(stationEfficiency(s, seniorSeat)).toBeLessThan(before);
    runShift(s, answerAll);
    expect(junior.skill.lockstitch).toBeGreaterThan(0.5);
  });
});

describe('fair play wins (PRD D7)', () => {
  it('in Chapter 5, care beats exploitation on every seed', () => {
    let fairTotal = 0;
    let exploitTotal = 0;
    for (const seed of SEEDS.slice(0, 6)) {
      const fair = stars(playChapter('ch5', seed));
      const s = createChapter('ch5', seed);
      runChapter(s, makeBot({ exploit: true }));
      const exploit = stars(s);
      expect(fair).toBeGreaterThanOrEqual(exploit);
      fairTotal += fair;
      exploitTotal += exploit;
    }
    expect(fairTotal).toBeGreaterThan(exploitTotal);
  });
});
