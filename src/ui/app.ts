import { OPERATIONS } from '../data/prototype';
import { Renderer, WORKER_COLORS, type ViewState } from '../render/renderer';
import { applyCommand, type Command } from '../sim/commands';
import {
  OP_BY_ID,
  clockLabel,
  isWorking,
  lineEfficiency,
  projection,
  stars,
  stationEfficiency,
  workerById,
} from '../sim/selectors';
import { step } from '../sim/sim';
import { createState } from '../sim/state';
import type { GameState, SimEvent } from '../sim/types';
import { LineAudio } from './audio';

const SPEEDS = [0, 1, 2, 4] as const;

interface Tip {
  title: string;
  body: string;
  button: string;
}

export class App {
  private s: GameState;
  private renderer: Renderer;
  private audio: LineAudio;
  private view: ViewState = { selectedWorker: null, selectedStation: null };
  private speed = 1;
  private acc = 0;
  private last = 0;
  private tip: Tip | null = null;
  private seen = new Set<string>();
  private lastPanel = '';
  private lastTop = '';
  private reportShown = false;

  private top = document.getElementById('topbar')!;
  private panel = document.getElementById('panel')!;
  private overlay = document.getElementById('overlay')!;
  private toasts = document.getElementById('toasts')!;
  private canvas = document.getElementById('floor') as HTMLCanvasElement;

  /** Read-only access for the e2e smoke test. */
  get state(): GameState {
    return this.s;
  }

  /** Canvas position of a worker (CSS pixels), for the e2e smoke test. */
  workerScreenPos(id: string): { x: number; y: number } {
    const w = workerById(this.s, id)!;
    return this.renderer.workerPos(this.s, w, 0);
  }

  constructor(private seed: number) {
    this.s = createState(seed);
    this.renderer = new Renderer(this.canvas, this.s.stations.length);
    this.audio = new LineAudio(
      (i) => {
        const st = this.s.stations[i];
        return !!st && isWorking(this.s, st);
      },
      () => this.speed > 0 && !this.tip && !this.s.ended,
    );
    this.bind();
    this.renderer.resize();
    this.showTip('start', {
      title: 'Chào con! Welcome to the workshop.',
      body:
        `Cô Mai needs <b>${this.s.tuning.stars[0]} school shorts</b> by 16:30. Bundles of cut fabric go down the line, one operation at a time. ` +
        `The line only goes as fast as its slowest seamstress, so <b>watch for the tallest pile</b>.<br><br>` +
        `Lan is on the bench. Pockets are her speciality. <b>Tap her, then tap a machine.</b>`,
      button: 'Start the shift',
    });
    requestAnimationFrame((t) => this.frame(t));
  }

  // ───────────────────────────── loop

  private frame(t: number): void {
    const dt = this.last ? Math.min(100, t - this.last) : 0;
    this.last = t;
    const running = !this.tip && !this.s.ended && this.speed > 0;
    if (running) {
      this.acc += (dt / 1000) * this.speed * this.s.tuning.gameMinutesPerSecond;
      while (this.acc >= 1 && !this.s.ended) {
        this.acc -= 1;
        this.handle(step(this.s), t);
      }
    }
    this.renderer.draw(this.s, this.view, running ? this.acc : 0, t);
    this.renderTop();
    this.renderPanel();
    if (this.s.ended && !this.reportShown) this.showReport();
    requestAnimationFrame((n) => this.frame(n));
  }

  private handle(events: SimEvent[], now: number): void {
    for (const e of events) {
      switch (e.kind) {
        case 'bundleDone':
          this.renderer.addFlight(e.station, e.to, now);
          if (e.to === null) this.audio.thunk();
          break;
        case 'broke': {
          this.audio.twang();
          const op = this.s.stations[e.station]!.opId;
          this.showTip('broke', {
            title: 'Snap! A needle broke.',
            body: `The machine on <b>${op ? OP_BY_ID[op]!.name : 'the spare table'}</b> has stopped. Tap it and press <b>Fix</b>: you walk over and change the needle. Bundles pile up while it is down.`,
            button: 'Got it',
          });
          this.toast(`Needle broke at ${op ? OP_BY_ID[op]!.name : 'the spare machine'}`);
          break;
        }
        case 'fixed':
          this.audio.fixed();
          break;
        case 'lunch':
          this.toast(e.start ? 'Lunch! Rice from the tin boxes. You can still plan moves.' : 'Back to work.');
          break;
        case 'ended':
          break;
      }
    }
    if (!this.seen.has('pile')) {
      const big = this.s.stations.find((st) => st.pile.length >= 5);
      if (big && big.opId) {
        this.showTip('pile', {
          title: 'That pile is your bottleneck.',
          body: `Bundles are waiting in front of <b>${OP_BY_ID[big.opId]!.name}</b>. Move a faster seamstress there, or tap the <b>spare machine</b> and give it the same job. Watch the coloured ring around each worker: green is fast, red is slow. People get faster as they learn an operation.`,
          button: 'Let me fix it',
        });
      }
    }
  }

  // ───────────────────────────── input

  private bind(): void {
    window.addEventListener('resize', () => this.renderer.resize());
    new ResizeObserver(() => this.renderer.resize()).observe(this.canvas);

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
      if (!el) return;
      this.audio.unlock();
      this.action(el.dataset.action!, el.dataset.arg ?? '');
    });

    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === ' ') {
        e.preventDefault();
        this.action('speed', this.speed === 0 ? '1' : '0');
      } else if (e.key === '1' || e.key === '2') this.action('speed', e.key);
      else if (e.key === '3' || e.key === '4') this.action('speed', '4');
      else if (e.key === 'Escape') this.clearSelection();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.speed > 0 && !this.s.ended) this.action('speed', '0');
    });
  }

  private tapAt(x: number, y: number): void {
    if (this.tip || this.s.ended) return;
    const hit = this.renderer.hitTest(this.s, x, y, this.acc);
    if (!hit) return this.clearSelection();
    if (hit.kind === 'worker') {
      this.view.selectedStation = null;
      this.view.selectedWorker = this.view.selectedWorker === hit.id ? null : hit.id;
      return;
    }
    if (hit.kind === 'station') {
      if (this.view.selectedWorker) {
        this.command({ type: 'assign', workerId: this.view.selectedWorker, station: hit.index });
        this.clearSelection();
      } else {
        this.view.selectedStation = this.view.selectedStation === hit.index ? null : hit.index;
      }
      return;
    }
    if (hit.kind === 'bench' && this.view.selectedWorker) {
      this.command({ type: 'assign', workerId: this.view.selectedWorker, station: null });
      this.clearSelection();
    }
  }

  private clearSelection(): void {
    this.view.selectedStation = null;
    this.view.selectedWorker = null;
  }

  private command(c: Command): boolean {
    const r = applyCommand(this.s, c);
    if (!r.ok) this.toast(r.error);
    return r.ok;
  }

  private action(name: string, arg: string): void {
    switch (name) {
      case 'speed':
        this.speed = Number(arg);
        break;
      case 'sound':
        this.audio.setEnabled(!this.audio.enabled);
        break;
      case 'tipOk':
        this.tip = null;
        this.overlay.innerHTML = '';
        this.overlay.hidden = true;
        if (this.speed === 0) this.speed = 1;
        break;
      case 'fix':
        this.command({ type: 'fix', station: Number(arg) });
        break;
      case 'setOp': {
        const st = this.view.selectedStation;
        if (st !== null) this.command({ type: 'setOp', station: st, opId: arg || null });
        break;
      }
      case 'seat': {
        const st = this.view.selectedStation;
        if (st !== null && this.command({ type: 'assign', workerId: arg, station: st })) this.clearSelection();
        break;
      }
      case 'bench':
        if (this.command({ type: 'assign', workerId: arg, station: null })) this.clearSelection();
        break;
      case 'close':
        this.clearSelection();
        break;
      case 'again':
        this.restart(this.seed);
        break;
      case 'next':
        this.restart(this.seed + 1);
        break;
    }
  }

  private restart(seed: number): void {
    this.seed = seed;
    const url = new URL(location.href);
    url.searchParams.set('seed', String(seed));
    history.replaceState(null, '', url);
    this.s = createState(seed);
    this.clearSelection();
    this.acc = 0;
    this.reportShown = false;
    this.overlay.hidden = true;
    this.overlay.innerHTML = '';
    this.speed = 1;
  }

  // ───────────────────────────── DOM views

  private renderTop(): void {
    const s = this.s;
    const proj = projection(s);
    const goal = s.tuning.stars[0];
    const st = stars(s);
    const html =
      `<div class="clock" aria-label="Time">${clockLabel(Math.min(s.minute, s.tuning.shiftEnd))}</div>` +
      `<div class="goal"><span class="stars" aria-label="${st} of 3 stars">${'★'.repeat(st)}${'☆'.repeat(3 - st)}</span> ${s.finished}/${goal}</div>` +
      `<div class="proj ${proj >= goal ? 'ok' : 'bad'}" title="Projected at 16:30 at the current pace">→ ${proj}${proj >= goal ? ' ✓' : ''}</div>` +
      `<div class="speeds" role="group" aria-label="Speed">` +
      SPEEDS.map((v) => `<button data-action="speed" data-arg="${v}" aria-pressed="${this.speed === v}" aria-label="${v === 0 ? 'Pause' : `${v}× speed`}">${v === 0 ? '⏸' : `${v}×`}</button>`).join('') +
      `</div><button class="sound" data-action="sound" aria-pressed="${this.audio.enabled}" aria-label="Sound">${this.audio.enabled ? '♪' : '♪̸'}</button>`;
    if (html !== this.lastTop) {
      this.top.innerHTML = html;
      this.lastTop = html;
    }
  }

  private renderPanel(): void {
    const html = this.panelHtml();
    if (html !== this.lastPanel) {
      this.panel.innerHTML = html;
      this.lastPanel = html;
    }
  }

  private panelHtml(): string {
    const s = this.s;
    const wid = this.view.selectedWorker;
    if (wid) {
      const w = workerById(s, wid)!;
      const known = OPERATIONS.filter((o) => (w.learn[o.id] ?? 0) > s.tuning.learnStart + 0.01)
        .map((o) => `${o.name} ${Math.round((w.learn[o.id] ?? 0) * 100)}%`)
        .join(' · ');
      return (
        `<div class="row"><span class="dot" style="background:${WORKER_COLORS[w.id]}"></span><b>${w.name}</b> <span class="muted">${w.note}</span></div>` +
        `<div class="row">Lockstitch ${pips(w.skill.lockstitch)} &nbsp; Overlock ${pips(w.skill.overlock)}</div>` +
        `<div class="row muted">Knows: ${known || 'nothing yet: new operations start at 50% speed'}</div>` +
        `<div class="row hint">Now tap a machine to move ${w.name} there.</div>` +
        `<div class="row buttons">${w.station !== null ? `<button data-action="bench" data-arg="${w.id}">Send to bench</button>` : ''}<button data-action="close">Cancel</button></div>`
      );
    }
    const si = this.view.selectedStation;
    if (si !== null) {
      const st = s.stations[si]!;
      const w = workerById(s, st.workerId);
      const opName = st.opId ? OP_BY_ID[st.opId]!.name : 'Spare machine';
      const rate = w && st.opId ? Math.round((60 * stationEfficiency(s, st)) / OP_BY_ID[st.opId]!.smv) : 0;
      const ops = OPERATIONS.filter((o) => o.machine === st.machine);
      const fixing = s.director.target === si || s.director.queue.includes(si);
      return (
        `<div class="row"><b>${opName}</b> <span class="muted">${st.machine} machine · ${st.pile.length} bundles waiting${w ? ` · ${w.name} ${rate}/h` : ''}</span></div>` +
        (st.broken
          ? `<div class="row buttons">${fixing ? '<span class="hint">You are on your way…</span>' : `<button class="primary" data-action="fix" data-arg="${si}">Fix the machine</button>`}</div>`
          : '') +
        `<div class="row"><span class="muted">Job:</span> ${ops
          .map((o) => `<button class="chip" data-action="setOp" data-arg="${o.id}" aria-pressed="${st.opId === o.id}">${o.name} <small>${o.smv} min</small></button>`)
          .join('')}</div>` +
        `<div class="row"><span class="muted">Seat here:</span> ${s.workers
          .filter((x) => x.id !== st.workerId)
          .map((x) => `<button class="chip" data-action="seat" data-arg="${x.id}"><span class="dot" style="background:${WORKER_COLORS[x.id]}"></span>${x.name} ${pips(x.skill[st.machine])}</button>`)
          .join('')}</div>` +
        `<div class="row buttons"><button data-action="close">Close</button></div>`
      );
    }
    return (
      `<div class="row"><b>${s.finished >= s.tuning.stars[0] ? 'Order done! Every extra piece is a bonus.' : 'Tap a seamstress, then tap a machine to move her.'}</b></div>` +
      `<div class="row muted">Tap a machine to change its job or fix it. Efficiency today: ${Math.round(lineEfficiency(s) * 100)}% · Breakdowns: ${s.breakdowns}</div>`
    );
  }

  private showTip(id: string, tip: Tip): void {
    if (this.seen.has(id)) return;
    this.seen.add(id);
    this.tip = tip;
    this.overlay.hidden = false;
    this.overlay.innerHTML =
      `<div class="card" role="dialog" aria-labelledby="tip-title"><div class="mentor" aria-hidden="true">Bác Tư</div>` +
      `<h2 id="tip-title">${tip.title}</h2><p>${tip.body}</p>` +
      `<button class="primary" data-action="tipOk" autofocus>${tip.button}</button></div>`;
    (this.overlay.querySelector('button') as HTMLButtonElement | null)?.focus();
  }

  private showReport(): void {
    this.reportShown = true;
    const s = this.s;
    const n = stars(s);
    const best = [...s.stations].filter((st) => st.opId).sort((a, b) => b.output - a.output)[0]!;
    const bestW = workerById(s, best.workerId);
    const verdict =
      n === 0 ? 'Cô Mai will have to wait until tomorrow.' : n === 1 ? 'Cô Mai has her shorts. Well done!' : n === 2 ? 'Cô Mai is delighted: extra shorts for the new pupils.' : 'A legendary day. The whole street is talking about your line.';
    this.overlay.hidden = false;
    this.overlay.innerHTML =
      `<div class="card report" role="dialog" aria-labelledby="rep-title"><div class="notebook">` +
      `<h2 id="rep-title">Shift report · 16:30</h2>` +
      `<div class="bigstars" aria-label="${n} of 3 stars">${'★'.repeat(n)}${'☆'.repeat(3 - n)}</div>` +
      `<p>${verdict}</p><table>` +
      `<tr><td>Shorts packed</td><td><b>${s.finished}</b> (★ ${s.tuning.stars[0]} · ★★ ${s.tuning.stars[1]} · ★★★ ${s.tuning.stars[2]})</td></tr>` +
      `<tr><td>Line efficiency</td><td>${Math.round(lineEfficiency(s) * 100)}%</td></tr>` +
      `<tr><td>Breakdowns</td><td>${s.breakdowns}</td></tr>` +
      `<tr><td>Busiest machine</td><td>${OP_BY_ID[best.opId!]!.name}${bestW ? ` (${bestW.name})` : ''}: ${Math.round(best.output)} pieces</td></tr>` +
      `</table></div><div class="buttons"><button data-action="again">Replay this day</button><button class="primary" data-action="next">Next day</button></div>` +
      `<p class="muted small">Day #${s.seed}: same number, same breakdowns. Share it with a friend.</p></div>`;
  }

  private toast(text: string): void {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    this.toasts.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }
}

function pips(v: number): string {
  const n = Math.round(v * 5);
  return `<span class="pips" aria-label="${n} of 5">${'●'.repeat(n)}${'○'.repeat(5 - n)}</span>`;
}
