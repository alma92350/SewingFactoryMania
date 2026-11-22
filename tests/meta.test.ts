import { describe, expect, it } from 'vitest';
import { CHAPTER_BY_ID } from '../src/data/chapters';
import { dailyDef, dailyNumber, ensureChapter } from '../src/data/generated';
import { makeBot } from '../src/sim/autopilot';
import { ACHIEVEMENTS, careerTitle, newAchievements, prepareDaily, shareLine } from '../src/sim/meta';
import { stars } from '../src/sim/objectives';
import { runChapter, step } from '../src/sim/sim';
import { cloneState, createChapter } from '../src/sim/state';
import { playChapter } from './helpers';

describe('Daily Challenge', () => {
  it('is the same for everyone on a given date, and different the next day', () => {
    const a = dailyDef(20261201);
    const b = dailyDef(20261201);
    const c = dailyDef(20261202);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(c));
    expect(dailyNumber(20261122)).toBe(1);
    expect(dailyNumber(20261201)).toBe(10);
  });

  it('calibrates its stars against a competent player: the bot earns ★ but never ★★★', () => {
    for (const key of [20261201, 20261202, 20261203, 20261204, 20261205, 20261206]) {
      const def = prepareDaily(key);
      expect(def.scoreStars![0]).toBeLessThan(def.scoreStars![1]);
      expect(def.scoreStars![1]).toBeLessThan(def.scoreStars![2]);
      const s = createChapter(def.id, key);
      runChapter(s, makeBot());
      expect(stars(s)).toBeGreaterThanOrEqual(1);
      expect(stars(s)).toBeLessThan(3);
    }
  });

  it('is one shift, and the share line names the day, the stars and the score', () => {
    const def = prepareDaily(20261210);
    expect(def.days).toBe(1);
    const s = createChapter(def.id, 20261210);
    runChapter(s, makeBot());
    expect(shareLine(s)).toMatch(/^SewingFactoryMania #19 [★☆]{3} \d+ pieces 🧵/);
  });

  it('modifiers change the day (e.g. a short day ends at 14:30)', () => {
    let found = false;
    for (let k = 20261201; k < 20261231 && !found; k++) {
      const def = dailyDef(k);
      if (def.modifier.id !== 'short') continue;
      found = true;
      const s = createChapter(def.id, k);
      expect(s.tuning.shiftEnd).toBe(14 * 60 + 30);
    }
    expect(found).toBe(true);
  });
});

describe('Sandbox', () => {
  it('a fax arrives every morning, and a saved game reloads after the registry is rebuilt', () => {
    ensureChapter('sandbox-2-9');
    const s = createChapter('sandbox-2-9', 9);
    step(s);
    expect(s.decisions.some((d) => d.kind === 'fax')).toBe(true);
    const saved = cloneState(s);
    delete CHAPTER_BY_ID['sandbox-2-9'];
    expect(ensureChapter(saved.chapterId)?.lines).toHaveLength(2);
  });

  it('runs for many days until the money runs out', () => {
    ensureChapter('sandbox-1-3');
    const s = createChapter('sandbox-1-3', 3);
    runChapter(s, makeBot(), 30000);
    expect(s.history.length).toBeGreaterThanOrEqual(5);
  });
});

describe('achievements and career', () => {
  it('chapter results unlock achievements once', () => {
    const s = playChapter('ch0', 1);
    const got = newAchievements(s, []);
    expect(got).toContain('doors');
    expect(newAchievements(s, got)).toEqual([]);
    expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(12);
  });

  it('the flood choice and Tết have their own achievements', () => {
    const flood = playChapter('ch4', 2, { family: { 'ch4.flood': 'help' } });
    expect(newAchievements(flood, [])).toContain('neighbour');
  });

  it('career titles follow the stars collected across the campaign', () => {
    expect(careerTitle({}).title).toBe('Apprentice');
    expect(careerTitle({ ch0: 2, ch1: 1 }).title).toBe('Line Leader');
    expect(careerTitle({ ch0: 3, ch1: 3, ch2: 3, ch3: 3, ch4: 3, ch5: 3 }).title).toBe('Garment Tycoon');
    expect(careerTitle({ ch0: 2 }).next).toBe(3);
  });
});
