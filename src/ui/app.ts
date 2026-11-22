import { CHAPTERS } from '../data/chapters';
import { TIPS } from '../data/handbook';
import { Renderer, isEink, setEink, type Overlay, type ViewState } from '../render/renderer';
import { applyCommand, type Command } from '../sim/commands';
import { stars } from '../sim/objectives';
import { activeOrder, chapterOf, dayLabel, has, isWorking, projectedFinishDay } from '../sim/selectors';
import { step } from '../sim/sim';
import { createChapter } from '../sim/state';
import type { GameState, SimEvent } from '../sim/types';
import { LineAudio } from './audio';
import { setLang, tr, trHtml, type Lang } from './i18n';
import { d1Return, exportLog, logEvent, readLog } from './telemetry';
import { newAchievements, prepareDaily, shareLine } from '../sim/meta';
import { ensureChapter, sandboxDef } from '../data/generated';
import { CHAPTER_BY_ID } from '../data/chapters';
import { cosmetic, type CosmeticSlot } from '../data/cosmetics';
import { isCampaignChapter, scrapbookHtml, scrapPage } from './scrapbook';
import { playFabricInspection, playMarker, playSpotTheDefect } from './minigame';
import { PRODUCTS } from '../data/products';
import { shipmentRolls } from '../sim/sourcing';
import { clearGame, loadGame, loadProgress, saveGame, saveProgress, type Progress } from './storage';
import {
  bookTabHtml,
  fabricTabHtml,
  chapterEndHtml,
  decisionHtml,
  introHtml,
  lineTabHtml,
  ordersTabHtml,
  reportHtml,
  tabsHtml,
  teamTabHtml,
  tipHtml,
  tipText,
  titleHtml,
  topbarHtml,
  type Tab,
} from './views';

export class App {
  private progress: Progress = loadProgress();
  private s: GameState | null = null;
  private renderer: Renderer;
  private audio: LineAudio;
  private view: ViewState = { selectedWorker: null, selectedStation: null };
  private tab: Tab = 'line';
  private speed = 1;
  private acc = 0;
  private last = 0;
  private tip: string | null = null;
  private intro = false;
  private minigame = false;
  private lastProduct: string | null = null;
  private overlayMode: Overlay = 'none';
  private visibleLines: number[] = [0];
  private unlocked: string[] = [];
  private share = '';
  private lastDraw = 0;
  private renders = { top: '', panel: '', overlay: '' };

  private top = document.getElementById('topbar')!;
  private panel = document.getElementById('panel')!;
  private overlay = document.getElementById('overlay')!;
  private toasts = document.getElementById('toasts')!;
  private canvas = document.getElementById('floor') as HTMLCanvasElement;

  /** Read-only access for the e2e smoke test. */
  get state(): GameState | null {
    return this.s;
  }
  get rendererForTests(): Renderer {
    return this.renderer;
  }

  constructor() {
    this.renderer = new Renderer(this.canvas);
    this.audio = new LineAudio(
      (i) => {
        const st = this.s?.stations[i];
        return !!st && !!this.s && isWorking(this.s, st);
      },
      (i) => this.s?.stations[i]?.machine ?? 'lockstitch',
      () => !!this.s && this.speed > 0 && !this.paused(),
    );
    this.audio.setEnabled(this.progress.sound);
    const nav = navigator.language?.toLowerCase() ?? '';
    setLang(this.progress.lang ?? (nav.startsWith('vi') ? 'vi' : nav.startsWith('fr') ? 'fr' : 'en'));
    logEvent(!!this.progress.log, { e: 'session' });
    const q = new URLSearchParams(location.search).get('eink');
    const auto = window.matchMedia?.('(update: slow), (monochrome)').matches ?? false;
    const eink = q === '1' || (q !== '0' && (this.progress.eink ?? auto));
    setEink(eink);
    document.body.classList.toggle('eink', eink);
    this.bind();
    this.showTitle();
    requestAnimationFrame((t) => this.frame(t));
  }

  // ───────────────────────────── screens

  private showTitle(): void {
    if (this.s && this.s.phase !== 'done') saveGame(this.s);
    if (this.s && CHAPTER_BY_ID[this.s.chapterId]?.generator) {
      this.progress.sandboxBest = Math.max(this.progress.sandboxBest ?? 0, this.s.history.length);
      saveProgress(this.progress);
    }
    this.s = null;
    document.body.classList.add('at-title');
    const save = loadGame();
    if (save) ensureChapter(save.chapterId);
    const label = save ? `${CHAPTER_BY_ID[save.chapterId]?.name ?? ''} · ${dayLabel(save.day)}` : '';
    this.overlay.hidden = false;
    const daily = prepareDaily(todayKey());
    this.overlay.innerHTML = trHtml(
      titleHtml(this.progress, !!save && save.phase !== 'done', label, isEink(), {
        dailyId: daily.id,
        dailyName: daily.name,
        dailyPlace: `${daily.place} · ★ ${daily.scoreStars![0]} · ★★ ${daily.scoreStars![1]} · ★★★ ${daily.scoreStars![2]}`,
        dailyBest: this.progress.dailyBest?.[daily.id],
        d1: d1Return(readLog()),
      }),
    );
    this.renders.overlay = '';
  }

  private startChapter(id: string, seedOverride?: number): void {
    const ch = CHAPTER_BY_ID[id] ?? ensureChapter(id)!;
    const today = new Date();
    const seed = (today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate()) * 10 + ch.index;
    const seedParam = Number(new URLSearchParams(location.search).get('seed'));
    this.begin(createChapter(id, seedOverride ?? (seedParam > 0 ? seedParam : seed), { difficulty: this.progress.difficulty, campaign: this.progress.campaign }));
    this.intro = true;
    this.unlocked = [];
    this.share = '';
    logEvent(!!this.progress.log, { e: 'chapterStart', ch: id });
  }

  /** Looks only: caps, the cat's collar (if she was adopted), the calendar, the radio song. */
  private applyCosmetics(): void {
    const c = this.progress.cosmetics ?? {};
    const campaign = { ...this.progress.campaign, ...(this.s?.campaign ?? {}) };
    const ch = this.s ? CHAPTER_BY_ID[this.s.chapterId] : undefined;
    const catHere = campaign.cat === 'adopt' && !!ch && ch.index >= 3 && ch.index < 100;
    this.renderer.cosmetics = {
      cap: cosmetic('cap', c.cap).colour!,
      collar: catHere ? cosmetic('collar', c.collar).colour! : null,
      calendar: ch && ch.index >= 1 ? { colour: cosmetic('calendar', c.calendar).colour! } : null,
    };
    const song = cosmetic('radio', c.radio ?? 'riverside').id;
    this.audio.setSong(song === 'off' ? null : song);
  }

  private begin(s: GameState): void {
    this.s = s;
    document.body.classList.remove('at-title');
    this.overlay.hidden = true;
    this.overlay.innerHTML = '';
    this.renders = { top: '', panel: '', overlay: '' };
    this.view = { selectedWorker: null, selectedStation: null };
    this.tab = 'line';
    this.speed = 1;
    this.acc = 0;
    this.intro = false;
    this.lastProduct = activeOrder(s)?.product ?? null;
    this.visibleLines = s.lines.length > 2 ? [0, 1] : s.lines.map((_, i) => i);
    this.renderer.resize(s, this.visibleLines);
    this.applyCosmetics();
    this.renderLinePicker();
    this.renderOverlayButton();
  }

  /** With three or more lines, the map shows one pair at a time; chips switch between them. */
  private renderLinePicker(): void {
    const el = document.getElementById('linePicker');
    if (!el) return;
    const s = this.s;
    if (!s || s.lines.length <= 2) {
      el.hidden = true;
      el.innerHTML = '';
      return;
    }
    const groups: number[][] = [];
    for (let i = 0; i < s.lines.length; i += 2) groups.push(s.lines.slice(i, i + 2).map((_, k) => i + k));
    const alarm = (l: number) =>
      s.stations.some((st) => st.line === l && (st.broken || st.pile.length >= 7 || (st.opId && st.machine !== 'qc' && st.machine !== 'cutting' && !st.workerId && !s.stations.some((x) => x.line === l && x.opId === st.opId && x.workerId))));
    el.hidden = false;
    el.innerHTML = trHtml(
      groups
        .map((g) => {
          const label = g.map((l) => s.lines[l]!.name.slice(-1)).join(' + ');
          const on = g.join(',') === this.visibleLines.join(',');
          return `<button data-action="lines" data-arg="${g.join(',')}" aria-pressed="${on}" aria-label="Show lines ${label}">${label}${g.some(alarm) ? '<span class="alarm" aria-hidden="true"></span>' : ''}</button>`;
        })
        .join(''),
    );
  }

  private renderOverlayButton(): void {
    const btn = document.getElementById('overlayBtn');
    if (!btn) return;
    const s = this.s;
    btn.hidden = !s || !has(s, 'quality');
    btn.textContent = tr(this.overlayMode === 'none' ? '◐' : this.overlayMode === 'bottleneck' ? '◐ slowest' : '◐ defects');
    btn.setAttribute('aria-label', tr(`Map view: ${this.overlayMode === 'none' ? 'normal' : this.overlayMode} (O)`));
  }

  private paused(): boolean {
    const s = this.s;
    return !s || this.intro || this.tip !== null || this.minigame || s.decisions.length > 0 || s.phase !== 'shift';
  }

  // ───────────────────────────── loop

  private frame(t: number): void {
    const dt = this.last ? Math.min(100, t - this.last) : 0;
    this.last = t;
    const s = this.s;
    if (s) {
      const running = !this.paused() && this.speed > 0;
      if (running) {
        this.acc += (dt / 1000) * this.speed * s.tuning.gameMinutesPerSecond;
        while (this.acc >= 1 && !this.paused()) {
          this.acc -= 1;
          this.handle(step(s), t);
        }
      }
      this.checkTips();
      // e-ink screens redraw at most twice a second and never animate
      if (!isEink() || t - this.lastDraw > 500) {
        this.renderer.draw(s, this.view, running && !isEink() ? this.acc : 0, t, this.overlayMode);
        this.lastDraw = t;
      }
      this.renderTop();
      this.renderPanel();
      if (s.lines.length > 2 && Math.floor(t / 1000) !== Math.floor((t - dt) / 1000)) this.renderLinePicker();
      this.renderOverlay();
    }
    requestAnimationFrame((n) => this.frame(n));
  }

  private handle(events: SimEvent[], now: number): void {
    const s = this.s!;
    for (const e of events) {
      switch (e.kind) {
        case 'bundleDone':
          this.renderer.addFlight(s, e.station, e.to, now);
          if (e.to === null) this.audio.thunk();
          break;
        case 'broke':
          this.audio.twang();
          this.queueTip(has(s, 'mechanic') && !s.workers.some((w) => w.role === 'mechanic') ? 'mechanic' : 'broke');
          break;
        case 'fixed':
          this.audio.fixed();
          break;
        case 'decision':
          if (s.decisions.some((d) => d.kind === 'fax')) this.audio.fax();
          break;
        case 'shipped':
          this.audio.cash();
          this.toast(`Shipped! ${e.amount >= 0 ? '+' : '−'}$${Math.abs(e.amount)}`);
          break;
        case 'lunch':
          this.toast(e.start ? 'Lunch: rice from the tin boxes. You can still plan.' : 'Back to work.');
          break;
        case 'shiftEnd':
          saveGame(s);
          logEvent(!!this.progress.log, { e: 'shiftEnd', ch: s.chapterId, day: s.day });
          break;
        case 'note':
          this.toast(e.text);
          break;
      }
    }
  }

  private queueTip(id: string): void {
    if (this.tip || this.progress.seenTips.includes(id) || !TIPS[id]) return;
    this.tip = id;
    this.progress.seenTips.push(id);
    saveProgress(this.progress);
  }

  private checkTips(): void {
    const s = this.s!;
    if (this.intro || this.tip || s.decisions.length) return;
    if (s.chapterId === 'ch0') this.queueTip('welcome');
    if (s.stations.some((st) => st.pile.length >= 5)) this.queueTip('pile');
    if (has(s, 'orders') && s.orders.length) this.queueTip('fax');
    if (has(s, 'hiring') && s.stations.some((st) => st.opId && st.machine !== 'qc' && !st.workerId)) this.queueTip('hire');
    if (has(s, 'quality')) this.queueTip('quality');
    const o = activeOrder(s);
    if (o && this.lastProduct && o.product !== this.lastProduct) this.queueTip('changeover');
    if (o) this.lastProduct = o.product;
    if (o && has(s, 'orders') && o.dueDay === s.day && s.minute >= 13 * 60 && projectedFinishDay(s, o) > o.dueDay) this.queueTip('vessel');
    if (s.orders.some((x) => x.inspections.length > 0)) this.queueTip('inspection');
    if (has(s, 'sourcing') && s.orders.some((x) => x.mode === 'fob')) this.queueTip('sourcing');
    if (has(s, 'cutting') && s.orders.length) this.queueTip('cutting');
    if (has(s, 'power')) this.queueTip('power');
    if (has(s, 'leaders') && s.minute > 7 * 60 + 30) this.queueTip('leaders');
    if (has(s, 'quality') && s.day >= 2) this.queueTip('overlay');
    if (has(s, 'morale')) this.queueTip('morale');
    if (has(s, 'training') && s.day >= 2) this.queueTip('mentor');
    if (has(s, 'merchandising')) this.queueTip('office');
    if (s.lines.length > 2) this.queueTip('lines');
    if (has(s, 'macro') && s.macro) this.queueTip('macro');
    if (has(s, 'diversify') && s.macro && s.minute > 7 * 60 + 20) this.queueTip('diversify');
    if (s.campaign.cat === 'adopt' && has(s, 'sourcing')) this.queueTip('cat');
  }

  // ───────────────────────────── input

  private bind(): void {
    const resize = () => this.s && this.renderer.resize(this.s);
    window.addEventListener('resize', resize);
    new ResizeObserver(resize).observe(this.canvas);

    let down: { x: number; y: number } | null = null;
    this.canvas.addEventListener('pointerdown', (e) => {
      this.audio.unlock();
      down = { x: e.clientX, y: e.clientY };
    });
    this.canvas.addEventListener('pointerup', (e) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 12) return;
      down = null;
      const r = this.canvas.getBoundingClientRect();
      this.tapAt(e.clientX - r.left, e.clientY - r.top);
    });

    document.addEventListener('click', (e) => {
      const el = (e.target as HTMLElement).closest<HTMLElement>('[data-action]');
      if (!el || (el as HTMLButtonElement).disabled) return;
      this.audio.unlock();
      this.action(el.dataset.action!, el.dataset.arg ?? '');
    });

    window.addEventListener('keydown', (e) => {
      if (!this.s) return;
      if (e.key === ' ' && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        this.action('speed', this.speed === 0 ? '1' : '0');
      } else if (e.key === '1' || e.key === '2') this.action('speed', e.key);
      else if (e.key === '3' || e.key === '4') this.action('speed', '4');
      else if (e.key === 'Escape') this.clearSelection();
      else if (e.key === 'o' || e.key === 'O') this.action('overlay', '');
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.s) {
        if (this.speed > 0) this.speed = 0;
        if (this.s.phase !== 'done') saveGame(this.s);
      }
    });
  }

  private tapAt(x: number, y: number): void {
    const s = this.s;
    if (!s || this.intro || this.tip || this.minigame || s.decisions.length) return;
    const hit = this.renderer.hitTest(s, x, y, this.acc);
    if (!hit) return this.clearSelection();
    this.tab = 'line';
    if (hit.kind === 'worker') {
      this.view.selectedStation = null;
      this.view.selectedWorker = this.view.selectedWorker === hit.id ? null : hit.id;
    } else if (hit.kind === 'station') {
      if (this.view.selectedWorker) {
        this.command({ type: 'assign', workerId: this.view.selectedWorker, station: hit.index });
        this.clearSelection();
      } else this.view.selectedStation = this.view.selectedStation === hit.index ? null : hit.index;
    } else if (hit.kind === 'bench' && this.view.selectedWorker) {
      this.command({ type: 'assign', workerId: this.view.selectedWorker, station: null });
      this.clearSelection();
    }
  }

  private clearSelection(): void {
    this.view.selectedStation = null;
    this.view.selectedWorker = null;
  }

  private command(c: Command): boolean {
    if (!this.s) return false;
    const r = applyCommand(this.s, c);
    if (!r.ok) this.toast(r.error);
    else this.handle(r.events, performance.now());
    return r.ok;
  }

  private action(name: string, arg: string): void {
    const s = this.s;
    switch (name) {
      case 'speed':
        this.speed = Number(arg);
        return;
      case 'sound':
        this.progress.sound = !this.progress.sound;
        this.audio.setEnabled(this.progress.sound);
        saveProgress(this.progress);
        return;
      case 'title':
        this.showTitle();
        return;
      case 'start':
        this.startChapter(arg);
        return;
      case 'continue': {
        const save = loadGame();
        if (save) {
          if (save.chapterId.startsWith('daily-')) prepareDaily(Number(save.chapterId.slice(6)));
          ensureChapter(save.chapterId);
          this.begin(save);
        }
        return;
      }
      case 'daily': {
        const def = prepareDaily(todayKey());
        this.startChapter(def.id, todayKey());
        return;
      }
      case 'sandbox': {
        const seed = Math.floor(Math.random() * 100000);
        const def = sandboxDef({ lines: Number(arg), seed });
        CHAPTER_BY_ID[def.id] = def;
        this.startChapter(def.id, seed);
        return;
      }
      case 'log':
        this.progress.log = arg === '1';
        saveProgress(this.progress);
        if (this.progress.log) logEvent(true, { e: 'session' });
        this.showTitle();
        return;
      case 'logExport':
        exportLog();
        return;
      case 'copyShare':
        navigator.clipboard?.writeText(this.share).then(
          () => this.toast('Copied: paste it to your friends.'),
          () => this.toast(this.share),
        );
        return;
      case 'cosmetic': {
        const [slot, id] = arg.split(':') as [CosmeticSlot, string];
        this.progress.cosmetics = { ...this.progress.cosmetics, [slot]: id };
        saveProgress(this.progress);
        this.applyCosmetics();
        this.showTitle();
        return;
      }
      case 'scrapbook':
        if (this.s && this.s.phase !== 'done') saveGame(this.s);
        this.s = null;
        document.body.classList.add('at-title');
        this.overlay.hidden = false;
        this.overlay.innerHTML = trHtml(scrapbookHtml(this.progress.scrapbook ?? {}, this.progress.campaign));
        this.renders.overlay = '';
        return;
      case 'difficulty':
        this.progress.difficulty = arg as Progress['difficulty'];
        saveProgress(this.progress);
        this.showTitle();
        return;
      case 'introOk':
        this.intro = false;
        return;
      case 'tipOk':
        this.tip = null;
        return;
      case 'tab':
        this.tab = arg as Tab;
        this.clearSelection();
        return;
      case 'eink':
        this.progress.eink = arg === '1';
        saveProgress(this.progress);
        setEink(this.progress.eink);
        document.body.classList.toggle('eink', this.progress.eink);
        this.showTitle();
        return;
      case 'lang':
        this.progress.lang = arg as Lang;
        saveProgress(this.progress);
        setLang(this.progress.lang);
        this.showTitle();
        return;
      case 'lines':
        if (this.s) {
          this.visibleLines = arg.split(',').map(Number);
          this.renderer.setVisible(this.s, this.visibleLines);
          this.clearSelection();
          this.renderLinePicker();
        }
        return;
      case 'overlay':
        this.overlayMode = this.overlayMode === 'none' ? 'bottleneck' : this.overlayMode === 'bottleneck' ? 'quality' : 'none';
        this.renderOverlayButton();
        return;
    }
    if (!s) return;
    switch (name) {
      case 'decide': {
        const [id, option] = arg.split(':');
        const d = s.decisions.find((x) => x.id === Number(id));
        if (d?.kind === 'marker' && option === 'play') {
          this.minigame = true;
          this.renders.overlay = '';
          playMarker(this.overlay, s.tuning.markerAuto, s.tuning.markerBest, (eff) => {
            this.minigame = false;
            this.command({ type: 'marker', decision: d.id, eff });
            this.renders.overlay = '';
          });
          return;
        }
        if (d?.kind === 'fabric' && option === 'play' && d.shipmentId !== undefined) {
          const rolls = shipmentRolls(s, d.shipmentId).map((r) => ({ id: r.id, condition: r.condition }));
          const o = s.orders.find((x) => x.id === d.orderId);
          this.minigame = true;
          this.renders.overlay = '';
          playFabricInspection(this.overlay, rolls, PRODUCTS[o?.product ?? 'shorts']!.fabric, (flagged) => {
            this.minigame = false;
            this.command({ type: 'fabricResult', decision: d.id, rolls: flagged });
            this.renders.overlay = '';
          });
          return;
        }
        if (d?.kind === 'sample' && option === 'play') {
          this.minigame = true;
          this.renders.overlay = '';
          playSpotTheDefect(this.overlay, (found) => {
            this.minigame = false;
            this.command({ type: 'sample', decision: d.id, found });
            this.renders.overlay = '';
          });
          return;
        }
        this.command({ type: 'decide', decision: Number(id), option: option! });
        if (s.phase === 'done' && s.decisions.length === 0) this.finishChapter();
        return;
      }
      case 'fix':
        this.command({ type: 'fix', station: Number(arg) });
        return;
      case 'setOp':
        if (this.view.selectedStation !== null) this.command({ type: 'setOp', station: this.view.selectedStation, opId: arg || null });
        return;
      case 'seat':
        if (this.view.selectedStation !== null && this.command({ type: 'assign', workerId: arg, station: this.view.selectedStation })) this.clearSelection();
        return;
      case 'bench':
        if (this.command({ type: 'assign', workerId: arg, station: null })) this.clearSelection();
        return;
      case 'close':
        this.clearSelection();
        return;
      case 'overtime':
        this.command({ type: 'overtime', on: !s.overtime });
        return;
      case 'hire':
        if (this.command({ type: 'hire', applicant: arg })) this.toast('Hired! She waits on the bench: tap her, then a machine.');
        return;
      case 'letGo':
        this.command({ type: 'letGo', workerId: arg });
        return;
      case 'welfare':
        this.command({ type: 'welfare', item: arg as 'fans' | 'canteen' | 'water' });
        return;
      case 'mentor': {
        const [junior, senior] = arg.split(':');
        this.command({ type: 'mentor', junior: junior!, senior: senior === 'none' ? null : senior! });
        return;
      }
      case 'prospect':
        this.command({ type: 'prospect', market: arg });
        return;
      case 'policy': {
        const [quote, extras] = arg.split(':');
        this.command({ type: 'policy', quote: Number(quote), extras: extras === 'true' });
        return;
      }
      case 'buy': {
        const [supplier, orderId, rolls] = arg.split(':');
        if (this.command({ type: 'buy', supplier: supplier!, orderId: Number(orderId), rolls: Number(rolls) })) this.toast(`Ordered ${rolls} rolls. Check the Fabric tab for the arrival day.`);
        return;
      }
      case 'pallets':
        this.command({ type: 'pallets' });
        return;
      case 'lead': {
        const [workerId, line] = arg.split(':');
        this.command({ type: 'lead', workerId: workerId!, line: Number(line) });
        return;
      }
      case 'sleep':
        this.command({ type: 'sleep' });
        if (s.phase === 'done' && s.decisions.length === 0) this.finishChapter();
        else saveGame(s);
        this.acc = 0;
        return;
      case 'replay':
        this.startChapter(s.chapterId);
        return;
      case 'next': {
        const next = CHAPTERS[chapterOf(s).index + 1];
        if (next) this.startChapter(next.id);
        return;
      }
    }
  }

  private finishChapter(): void {
    const s = this.s!;
    const n = stars(s);
    const ch = CHAPTER_BY_ID[s.chapterId]!;
    this.unlocked = newAchievements(s, this.progress.achievements ?? []);
    this.progress.achievements = [...(this.progress.achievements ?? []), ...this.unlocked];
    logEvent(!!this.progress.log, { e: 'chapterEnd', ch: s.chapterId, day: s.day, stars: n });
    if (ch.scoreStars) {
      const pieces = s.orders.reduce((a, o) => a + o.finished, 0);
      this.progress.dailyBest = { ...this.progress.dailyBest, [s.chapterId]: Math.max(this.progress.dailyBest?.[s.chapterId] ?? 0, pieces) };
      this.share = shareLine(s);
      saveProgress(this.progress);
      clearGame();
      return;
    }
    if (ch.generator) {
      this.progress.sandboxBest = Math.max(this.progress.sandboxBest ?? 0, s.history.length);
      saveProgress(this.progress);
      clearGame();
      return;
    }
    this.progress.stars[s.chapterId] = Math.max(this.progress.stars[s.chapterId] ?? 0, n);
    this.progress.campaign = { ...this.progress.campaign, ...s.campaign };
    if (isCampaignChapter(s.chapterId) && n > 0) this.progress.scrapbook = { ...this.progress.scrapbook, [s.chapterId]: scrapPage(s) };
    saveProgress(this.progress);
    clearGame();
  }

  // ───────────────────────────── DOM rendering (only when the markup changes, so taps are never lost)

  private renderTop(): void {
    const html = trHtml(topbarHtml(this.s!, this.speed, this.progress.sound));
    if (html !== this.renders.top) {
      this.top.innerHTML = html;
      this.renders.top = html;
    }
  }

  private renderPanel(): void {
    const s = this.s!;
    let body: string;
    if (this.tab === 'orders' && has(s, 'orders')) body = ordersTabHtml(s);
    else if (this.tab === 'fabric' && has(s, 'sourcing')) body = fabricTabHtml(s);
    else if (this.tab === 'team' && has(s, 'hiring')) body = teamTabHtml(s);
    else if (this.tab === 'book') body = bookTabHtml(this.progress.seenTips);
    else body = lineTabHtml(s, this.view);
    const html = trHtml(tabsHtml(s, this.tab) + `<div class="tabbody">${body}</div>`);
    if (html !== this.renders.panel) {
      const scroll = this.panel.querySelector('.tabbody')?.scrollTop ?? 0;
      this.panel.innerHTML = html;
      const tb = this.panel.querySelector('.tabbody');
      if (tb) tb.scrollTop = scroll;
      this.renders.panel = html;
    }
  }

  private renderOverlay(): void {
    if (this.minigame) return;
    const s = this.s!;
    let html = '';
    if (this.intro) html = introHtml(s.chapterId);
    else if (this.tip) html = tipHtml(tipText(this.tip));
    else if (s.decisions.length) html = decisionHtml(s, s.decisions[0]!);
    else if (s.phase === 'report') html = reportHtml(s);
    else if (s.phase === 'done') html = chapterEndHtml(s, chapterOf(s).index + 1 < CHAPTERS.length, this.unlocked, this.share);
    html = trHtml(html);
    if (html === this.renders.overlay) return;
    this.renders.overlay = html;
    this.overlay.hidden = !html;
    this.overlay.innerHTML = html;
    this.overlay.querySelector<HTMLButtonElement>('button.primary, button')?.focus({ preventScroll: true });
  }

  private toast(text: string): void {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = tr(text);
    this.toasts.appendChild(el);
    while (this.toasts.children.length > 3) this.toasts.firstElementChild?.remove();
    setTimeout(() => el.remove(), 3200);
  }
}


function todayKey(): number {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}
