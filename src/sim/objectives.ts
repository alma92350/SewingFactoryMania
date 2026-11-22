import { chapterOf } from './selectors';
import { newCustomers } from './macro';
import type { GameState, Order } from './types';

/** Chapter goals (★ / ★★ / ★★★). Each entry says whether that star is earned. */
export function starChecks(s: GameState): [boolean, boolean, boolean] {
  const byTag = (tag: string): Order | undefined => s.orders.find((o) => o.tag === tag);
  const ch = chapterOf(s);
  if (ch.scoreStars) {
    const n = s.orders.reduce((a, o) => a + o.finished, 0);
    const alive = !s.failed;
    return [alive && n >= ch.scoreStars[0], alive && n >= ch.scoreStars[1], alive && n >= ch.scoreStars[2]];
  }
  if (ch.generator) {
    const days = s.history.length;
    return [days >= 5, days >= 10, days >= 20];
  }
  switch (s.chapterId) {
    case 'ch0': {
      const n = byTag('comai')?.finished ?? 0;
      return [n >= 290, n >= 340, n >= 370];
    }
    case 'ch1': {
      const hanil = byTag('hanil');
      const one = !!hanil && hanil.status === 'shipped' && hanil.onTime === true;
      const two = one && s.cash >= 950;
      const golden = byTag('golden');
      const all = s.orders.every((o) => o.status === 'shipped' && o.onTime === true);
      const three = two && !!golden && all && s.stats.overtimeDays === 0;
      return [one, two, three];
    }
    case 'ch2': {
      const sk = byTag('sakuraya');
      const one = !!sk && sk.status === 'shipped' && sk.discount === 0 && sk.inspections.some((i) => i.passed);
      const two = one && sk!.inspections[0]!.passed && s.cash >= 1400;
      const reorder = byTag('hanil2');
      const three = two && sk!.inspections.every((i) => i.found === 0) && !!reorder && reorder.status === 'shipped' && reorder.onTime === true && s.stats.overtimeDays === 0;
      return [one, two, three];
    }
    case 'ch3': {
      const g = byTag('golden');
      const one = !!g && g.status === 'shipped' && g.onTime === true;
      const two = one && s.cash >= 1500;
      const h = byTag('hanil3');
      const three = two && (g!.causes.fabric?.count ?? 0) === 0 && !!h && h.onTime === true && s.stats.overtimeDays === 0;
      return [one, two, three];
    }
    case 'ch4': {
      const f = byTag('formosa');
      const g = byTag('golden');
      const one = !!f && !!g && f.onTime === true && g.onTime === true;
      const two = one && s.cash >= 2200;
      const sk = byTag('sakuraya');
      const three = two && (s.power?.minutesLost ?? 0) < 60 && s.stats.overtimeDays === 0 && !!sk && sk.onTime === true;
      return [one, two, three];
    }
    case 'ch5': {
      const main = ['hanil', 'formosa', 'golden'].map(byTag);
      const one = main.every((o) => !!o && o.status === 'shipped' && o.onTime === true);
      const back = s.tet ? s.tet.returned / Math.max(1, s.tet.returned + s.tet.left.length) : 0;
      const two = one && back >= 0.9 && s.cash >= 2500;
      const sk = byTag('sakuraya');
      const three = two && s.stats.quits === 0 && s.stats.overtimeDays === 0 && !!sk && sk.onTime === true;
      return [one, two, three];
    }
    case 'ch6': {
      const main = ['padded', 'yukata', 'baby'].map(byTag);
      const one = main.every((o) => !!o && o.status === 'shipped' && o.onTime === true && o.discount === 0);
      const two = one && s.cash >= 4500;
      const three = two && s.orders.every((o) => o.status === 'shipped' && o.onTime === true) && s.stats.overtimeDays === 0 && s.stats.quits === 0;
      return [one, two, three];
    }
    case 'ch7': {
      const one = s.failed === null && s.cash >= 3000;
      const two = one && s.orders.every((o) => o.status === 'shipped' && o.onTime === true) && newCustomers(s) >= 2;
      const three = two && (s.stats.layoffs ?? 0) === 0 && s.stats.overtimeDays === 0 && s.cash >= 4500;
      return [one, two, three];
    }
  }
  return [false, false, false];
}

export function stars(s: GameState): number {
  const c = starChecks(s);
  return c[0] ? (c[1] ? (c[2] ? 3 : 2) : 1) : 0;
}

export function starTexts(s: GameState): [string, string, string] {
  return chapterOf(s).starText;
}
