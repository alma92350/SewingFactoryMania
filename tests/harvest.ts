/**
 * Harvest every visible string: play each chapter with the bot and, at regular moments, render all
 * views (pure functions) and the canvas (through a recording stub context).
 */
import { CHAPTERS } from '../src/data/chapters';
import { TIPS } from '../src/data/handbook';
import { computeLayout } from '../src/render/layout';
import { Renderer, type Overlay } from '../src/render/renderer';
import { makeBot } from '../src/sim/autopilot';
import { endDay, step } from '../src/sim/sim';
import { createChapter } from '../src/sim/state';
import type { GameState } from '../src/sim/types';
import { segmentsOfHtml } from '../src/ui/i18n';
import {
  bookTabHtml,
  chapterEndHtml,
  decisionHtml,
  fabricTabHtml,
  introHtml,
  lineTabHtml,
  ordersTabHtml,
  reportHtml,
  tabsHtml,
  teamTabHtml,
  titleHtml,
  topbarHtml,
} from '../src/ui/views';

function stubCanvas(sink: string[]): HTMLCanvasElement {
  const ctx = new Proxy({} as Record<string, unknown>, {
    get(target, prop: string) {
      if (prop === 'fillText') return (t: string) => sink.push(String(t));
      if (prop === 'measureText') return () => ({ width: 0 }); // never truncate: harvest whole labels
      if (prop in target) return target[prop];
      return () => undefined;
    },
    set(target, prop: string, v) {
      target[prop] = v;
      return true;
    },
  });
  return { getContext: () => ctx } as unknown as HTMLCanvasElement;
}

export function harvest(): { html: string[]; canvas: string[] } {
  const html: string[] = [];
  const canvas: string[] = [];
  const add = (h: string) => html.push(...segmentsOfHtml(h));
  const renderer = new Renderer(stubCanvas(canvas));
  const progress = { stars: { ch0: 3, ch1: 2, ch2: 1, ch3: 1 }, campaign: {}, difficulty: 'seamstress' as const, sound: true, seenTips: Object.keys(TIPS) };
  add(titleHtml(progress, true, 'The First Fax · Mon · day 2'));
  // Bác Tư's tips and the handbook tips use whole-text Vietnamese (VI_TIPS), tested separately
  add(bookTabHtml([]));

  const snapshot = (s: GameState) => {
    add(topbarHtml(s, 1, true));
    add(tabsHtml(s, 'line'));
    add(lineTabHtml(s, { selectedWorker: null, selectedStation: null }));
    const w = s.workers.find((x) => x.role === 'operator');
    if (w) add(lineTabHtml(s, { selectedWorker: w.id, selectedStation: null }));
    for (const st of [s.stations[0], s.stations[1], s.stations.at(-1)]) if (st) add(lineTabHtml(s, { selectedWorker: null, selectedStation: st.index }));
    add(ordersTabHtml(s));
    add(fabricTabHtml(s));
    add(teamTabHtml(s));
    const counts = s.lines.map((_, i) => s.stations.filter((st) => st.line === i).length);
    for (const [wd, ht] of [
      [390, 600],
      [1280, 560],
    ] as const) {
      renderer.layout = computeLayout(wd, ht, counts);
      for (const o of ['none', 'bottleneck', 'quality'] as Overlay[]) renderer.draw(s, { selectedWorker: null, selectedStation: null }, 0, 0, o);
    }
  };

  for (const ch of CHAPTERS) {
    add(introHtml(ch.id));
    for (const family of [undefined, 'second']) {
      const s = createChapter(ch.id, 7);
      const bot = makeBot(family && ch.family ? { family: { [ch.family.flag]: ch.family.options[1]!.id } } : {});
      for (let i = 0; i < 40000 && s.phase !== 'done'; i++) {
        for (const d of s.decisions) add(decisionHtml(s, d));
        bot(s);
        if (s.phase === 'report') {
          add(reportHtml(s));
          snapshot(s);
          endDay(s);
          continue;
        }
        if (s.minute === 10 * 60 || s.minute === 14 * 60 + 15) snapshot(s);
        step(s);
      }
      for (const d of s.decisions) add(decisionHtml(s, d));
      add(chapterEndHtml(s, true));
    }
  }
  return { html, canvas };
}
