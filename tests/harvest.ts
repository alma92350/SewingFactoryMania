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
import { applyCommand } from '../src/sim/commands';
import { createChapter } from '../src/sim/state';
import type { GameState } from '../src/sim/types';
import { segmentsOfHtml } from '../src/ui/i18n';
import { scrapbookHtml, scrapPage } from '../src/ui/scrapbook';
import { scenarioEditorHtml } from '../src/ui/editor';
import { DEFAULT_SCENARIO, SCENARIO_BUYERS, scenarioDef } from '../src/data/scenario';
import { prepareScenario } from '../src/sim/meta';
import { prepareDaily, shareLine } from '../src/sim/meta';
import { ensureChapter } from '../src/data/generated';
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
  const daily = prepareDaily(20261201);
  add(titleHtml({ ...progress, achievements: ['doors'], sandboxBest: 12, dailyBest: { [daily.id]: 300 }, log: true }, true, 'The First Fax · Mon · day 2', false, {
    dailyId: daily.id,
    dailyName: daily.name,
    dailyPlace: `${daily.place} · ★ ${daily.scoreStars![0]} · ★★ ${daily.scoreStars![1]} · ★★★ ${daily.scoreStars![2]}`,
    dailyBest: 300,
    d1: { days: 3, returned: 2 },
  }));
  // Bác Tư's tips and the handbook tips use whole-text Vietnamese (VI_TIPS), tested separately
  add(bookTabHtml([]));
  // a veteran's title screen: every chapter, the cat, cosmetics unlocked, the hardest difficulty
  const vet = { ...progress, stars: { ch0: 3, ch1: 3, ch2: 3, ch3: 3, ch4: 3, ch5: 3, ch6: 3, ch7: 3 }, campaign: { cat: 'adopt' }, cosmetics: { cap: 'pink', radio: 'peach' } };
  add(titleHtml(vet, false, '', false, { dailyId: daily.id, dailyName: daily.name, dailyPlace: daily.place, dailyBest: undefined, d1: { days: 1, returned: 0 } }));
  add(titleHtml({ ...progress, stars: {} }, false, ''));

  const pages: Record<string, ReturnType<typeof scrapPage>> = {};
  const campaign: Record<string, string> = {};
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
      for (let first = 0; first < s.lines.length; first += 2) {
        renderer.setVisible(s, s.lines.map((_, i) => i).filter((i) => i >= first && i < first + 2));
        renderer.relayout(s, wd, ht);
        for (const o of ['none', 'bottleneck', 'quality'] as Overlay[]) renderer.draw(s, { selectedWorker: null, selectedStation: null }, 0, 0, o);
      }
      void counts;
    }
  };

  // generated chapters: today's daily and a sandbox
  const modern = { ...DEFAULT_SCENARIO, era: '2007' as const, buyers: SCENARIO_BUYERS, season: 'christmas' as const, days: 3, seed: 5 };
  const extra = [
    prepareDaily(20261201),
    prepareDaily(20261202),
    ensureChapter('sandbox-2-4')!,
    ensureChapter('sandbox-1-9-tet')!,
    ensureChapter('sandbox-2-9-monsoon')!,
    prepareScenario(scenarioDef(modern), 5),
    prepareScenario(scenarioDef({ ...DEFAULT_SCENARIO, days: 0, season: 'midautumn', seed: 6 }), 6),
  ];
  // the scenario editor in its states (player-typed text sits in input values, which are never translated)
  add(scenarioEditorHtml(DEFAULT_SCENARIO));
  add(scenarioEditorHtml({ ...modern, modifiers: ['breakdowns', 'learning', 'power'], custom: [{ name: 'X', contact: 'Y', origin: 'Z', inspection: 'strict', habit: '', product: 'yukata' }] }, 'A scenario was shared with you. Check it, then press Play.'));
  add(scenarioEditorHtml({ ...DEFAULT_SCENARIO, season: 'tet', custom: [] }, 'That scenario code is damaged or incomplete.'));
  add(scenarioEditorHtml({ ...DEFAULT_SCENARIO, season: 'monsoon' }, 'Scenario loaded.'));
  add(scenarioEditorHtml({ ...DEFAULT_SCENARIO, season: 'midautumn' }));
  for (const ch of [...CHAPTERS, ...extra]) {
    add(introHtml(ch.id));
    // the first cards of the chapter, before anyone (a merchandiser) answers them
    const peek = createChapter(ch.id, 7);
    peek.workers = peek.workers.filter((w) => w.role !== 'merchandiser' && w.role !== 'planner');
    for (let i = 0; i < 4; i++) {
      step(peek);
      for (const d of peek.decisions) add(decisionHtml(peek, d));
      // a family scene at the start freezes the world: answer it to reach the first faxes
      for (const d of [...peek.decisions]) if (d.kind === 'family') applyCommand(peek, { type: 'decide', decision: d.id, option: d.options[0]!.id });
    }
    for (const family of [undefined, 'second']) {
      const s = createChapter(ch.id, 7);
      const alt: Record<string, string> = {};
      if (family && ch.family) alt[ch.family.flag] = ch.family.options[1]!.id;
      if (family && ch.family2) alt[ch.family2.flag] = ch.family2.options[1]!.id;
      if (family) alt.cat = 'shoo';
      const bot = makeBot(family ? { family: alt } : {});
      for (let i = 0; i < (ch.generator ? 12000 : 40000) && s.phase !== 'done'; i++) {
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
      add(chapterEndHtml(s, true, ['doors', 'sharp', 'storm', 'nobody', 'cat', 'thursday'], ch.scoreStars ? shareLine(s) : ''));
      if (!ch.generator && !ch.scoreStars) pages[ch.id] = scrapPage(s);
      Object.assign(campaign, s.campaign);
    }
  }
  add(scrapbookHtml({}, {}));
  add(scrapbookHtml(pages, campaign));
  add(scrapbookHtml(pages, { ...campaign, 'ch7.ma': 'keep', 'ch7.leung': 'rest', 'ch2.ut': 'osaka', 'ch4.flood': 'help', cat: 'adopt' }));
  return { html, canvas };
}
