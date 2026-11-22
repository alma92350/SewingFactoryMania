import { chance, randInt } from '../core/rng';
import { pushDecision } from './orders';
import { chapterOf, has, workerById } from './selectors';
import type { GameState, SimEvent } from './types';

/**
 * Rainy season (Chapter 4): scheduled power cuts, a generator that someone must start,
 * roof leaks that spoil fabric left on the floor.
 */
export function planDay(s: GameState): void {
  if (!has(s, 'power') || !s.power) return;
  const p = s.power;
  const ch = chapterOf(s);
  p.rain = ch.rainDays ? ch.rainDays.includes(s.day) : chance(s.rng, 0.4);
  const n = 1 + (p.rain ? 1 : 0);
  p.cuts = [];
  for (let i = 0; i < n; i++) {
    const start = randInt(s.rng, 8 * 60, 15 * 60);
    p.cuts.push({ start, end: start + randInt(s.rng, 40, 100) });
  }
  p.cuts.sort((a, b) => a.start - b.start);
  p.off = false;
  p.generator.running = false;
  p.generator.startAt = 0;
  p.closedFrom = 0;
  p.closedUntil = 0;
  if (electricianPresent(s)) p.generator.tested = true;
}

export function electricianPresent(s: GameState): boolean {
  return s.workers.some((w) => w.role === 'electrician' && !w.absent);
}

export function stepPower(s: GameState, events: SimEvent[]): void {
  const p = s.power;
  if (!p || !has(s, 'power')) return;
  const t = s.tuning;

  if (p.rain && s.minute === 9 * 60 && !s.pallets) {
    let spoiled = 0;
    for (const r of s.warehouse) {
      if (spoiled >= 3) break;
      if (!r.dry && !r.rejected && r.condition === 'good' && r.metres > 0) {
        r.condition = 'flawed';
        spoiled += 1;
      }
    }
    if (spoiled > 0) events.push({ kind: 'note', text: `The roof leaks: ${spoiled} rolls on the warehouse floor got wet. Pallets would keep them dry.` });
  }

  for (const c of p.cuts) {
    if (s.minute === c.start && !p.off) {
      p.off = true;
      events.push({ kind: 'note', text: 'Power cut! Every machine stops.' });
      if (electricianPresent(s)) p.generator.startAt = s.minute + t.electricianStartMinutes;
      else {
        const d = pushDecision(s, {
          kind: 'power',
          title: 'Power cut',
          body: 'The lights go out and forty machines stop at once. Everyone sighs together. Start the generator in the shed?',
          options: [
            { id: 'start', label: 'Run to the generator', detail: `${t.generatorStartMinutes} minutes to start it; diesel costs $${t.fuelPerHour}/hour` },
            { id: 'wait', label: 'Wait for the power to come back', detail: 'Free, but nobody sews' },
          ],
        });
        events.push({ kind: 'decision', id: d.id });
      }
    }
    if (s.minute === c.end && p.off) {
      p.off = false;
      p.generator.running = false;
      p.generator.startAt = 0;
      events.push({ kind: 'note', text: 'The power is back.' });
    }
  }

  if (p.off && !p.generator.running && p.generator.startAt > 0 && s.minute >= p.generator.startAt) {
    const sure = p.generator.tested || electricianPresent(s);
    if (sure || chance(s.rng, 1 - t.generatorFailUntested)) {
      p.generator.running = true;
      p.generator.tested = true;
      events.push({ kind: 'note', text: 'The generator roars: the machines run again.' });
    } else {
      p.generator.startAt = 0;
      p.generator.tested = true; // you learn how to start it
      const d = pushDecision(s, {
        kind: 'power',
        title: 'The generator coughs and dies',
        body: 'Nobody has started it since last season. Try again? You know the trick now.',
        options: [
          { id: 'start', label: 'Try again', detail: `${t.generatorStartMinutes} more minutes` },
          { id: 'wait', label: 'Wait for the power', detail: 'Nobody sews' },
        ],
      });
      events.push({ kind: 'decision', id: d.id });
    }
  }

}

/** Once per minute that actually passes: diesel and lost minutes. */
export function tickPower(s: GameState): void {
  const p = s.power;
  if (!p) return;
  if (p.generator.running) {
    const fuel = s.tuning.fuelPerHour / 60;
    s.cash -= fuel;
    s.ledger.electricity += fuel;
  }
  if (p.off && !p.generator.running) p.minutesLost += 1;
}

/** Machines need power (QC and cutting are by hand); the flood afternoon closes everything. */
export function powerStops(s: GameState, machine: string): boolean {
  const p = s.power;
  if (!p) return false;
  if (s.minute >= p.closedFrom && s.minute < p.closedUntil) return true;
  return p.off && !p.generator.running && machine !== 'qc' && machine !== 'cutting';
}

export function generatorDecision(s: GameState, optionId: string): void {
  if (s.power && optionId === 'start') s.power.generator.startAt = s.minute + s.tuning.generatorStartMinutes;
}

export function leaderOf(s: GameState, line: number) {
  return workerById(s, s.lines[line]?.leaderId ?? null);
}
