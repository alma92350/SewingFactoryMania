import { CHAPTERS } from '../data/chapters';
import { TIPS } from '../data/handbook';
import { Renderer, type ViewState } from '../render/renderer';
import { applyCommand, type Command } from '../sim/commands';
import { stars } from '../sim/objectives';
import { activeOrder, chapterOf, dayLabel, has, isWorking, projectedFinishDay } from '../sim/selectors';
import { step } from '../sim/sim';
import { createChapter } from '../sim/state';
import type { GameState, SimEvent } from '../sim/types';
import { LineAudio } from './audio';
import { playSpotTheDefect } from './minigame';
import { clearGame, loadGame, loadProgress, saveGame, saveProgress, type Progress } from './storage';
import {
  bookTabHtml,
  chapterEndHtml,
  decisionHtml,
  introHtml,
  lineTabHtml,
  ordersTabHtml,
  reportHtml,
  tabsHtml,
  teamTabHtml,
  tipHtml,
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
    this.bind();
    this.showTitle();
    requestAnimationFrame((t) => this.frame(t));
  }

  // ───────────────────────────── screens

  private showTitle(): void {
    if (this.s && this.s.phase !== 'done') saveGame(this.s);
    this.s = null;
    document.body.classList.add('at-title');
    const save = loadGame();
    const label = save ? `${CHAPTERS.find((c) => c.id === save.chapterId)?.name ?? ''} · ${dayLabel(save.day)}` : '';
    this.overlay.hidden = false;
    this.overlay.innerHTML = titleHtml(this.progress, !!save && save.phase !== 'done', label);
    this.renders.overlay = '';
  }

  private startChapter(id: string): void {
    const ch = CHAPTERS.find((c) => c.id === id)!;
    const today = new Date();
    const seed = (today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate()) * 10 + ch.index;
    const seedParam = Number(new URLSearchParams(location.search).get('seed'));
    this.begin(createChapter(id, seedParam > 0 ? seedParam : seed, { difficulty: this.progress.difficulty, campaign: this.progress.campaign }));
    this.intro = true;
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
    this.renderer.resize(s.stations.length);
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
      this.renderer.draw(s, this.view, running ? this.acc : 0, t);
      this.renderTop();
      this.renderPanel();
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
  }

  // ───────────────────────────── input

  private bind(): void {
    const resize = () => this.s && this.renderer.resize(this.s.stations.length);
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
        if (save) this.begin(save);
        return;
      }
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
    }
    if (!s) return;
    switch (name) {
      case 'decide': {
        const [id, option] = arg.split(':');
        const d = s.decisions.find((x) => x.id === Number(id));
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
    this.progress.stars[s.chapterId] = Math.max(this.progress.stars[s.chapterId] ?? 0, n);
    this.progress.campaign = { ...this.progress.campaign, ...s.campaign };
    saveProgress(this.progress);
    clearGame();
  }

  // ───────────────────────────── DOM rendering (only when the markup changes, so taps are never lost)

  private renderTop(): void {
    const html = topbarHtml(this.s!, this.speed, this.progress.sound);
    if (html !== this.renders.top) {
      this.top.innerHTML = html;
      this.renders.top = html;
    }
  }

  private renderPanel(): void {
    const s = this.s!;
    let body: string;
    if (this.tab === 'orders' && has(s, 'orders')) body = ordersTabHtml(s);
    else if (this.tab === 'team' && has(s, 'hiring')) body = teamTabHtml(s);
    else if (this.tab === 'book') body = bookTabHtml(this.progress.seenTips);
    else body = lineTabHtml(s, this.view);
    const html = tabsHtml(s, this.tab) + `<div class="tabbody">${body}</div>`;
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
    else if (this.tip) html = tipHtml(TIPS[this.tip]!);
    else if (s.decisions.length) html = decisionHtml(s, s.decisions[0]!);
    else if (s.phase === 'report') html = reportHtml(s);
    else if (s.phase === 'done') html = chapterEndHtml(s, chapterOf(s).index + 1 < CHAPTERS.length);
    if (html === this.renders.overlay) return;
    this.renders.overlay = html;
    this.overlay.hidden = !html;
    this.overlay.innerHTML = html;
    this.overlay.querySelector<HTMLButtonElement>('button.primary, button')?.focus({ preventScroll: true });
  }

  private toast(text: string): void {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    this.toasts.appendChild(el);
    while (this.toasts.children.length > 3) this.toasts.firstElementChild?.remove();
    setTimeout(() => el.remove(), 3200);
  }
}
