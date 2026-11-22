import { MACHINE_LABEL, PRODUCTS } from '../data/products';
import { activeOrder, bottleneck, chapterOf, has, isLunch, isWorking, opCapacities, opDef, orderById, stationEfficiency, stationRate, workerById } from '../sim/selectors';
import type { Agent, Bundle, GameState, Station, Worker } from '../sim/types';
import { benchSlot, computeLayout, contains, officeSpot, type Layout, type Rect } from './layout';
import { tr } from '../ui/i18n';
import * as A from './art';
import { PAL, PAL_EINK, type Palette } from './art';

/** Canvas renderer. Reads state, never writes it. */

const COLOUR: Palette = PAL;
/** E-ink: pure greys; meaning is carried by shape, border and pattern. */
const EINK: Palette = PAL_EINK;
let C: Palette = COLOUR;
let einkOn = false;
/** Animation runs only with colour screens and without "reduce motion" (docs/ART.md §0.3). */
let motionOn = true;
const reduceMotion = typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
const syncMotion = () => {
  motionOn = !einkOn && !(reduceMotion?.matches ?? false);
};
reduceMotion?.addEventListener?.('change', syncMotion);

export function setEink(on: boolean): void {
  einkOn = on;
  C = on ? EINK : COLOUR;
  syncMotion();
}
export function isEink(): boolean {
  return einkOn;
}

export type Overlay = 'none' | 'bottleneck' | 'quality';

export const WORKER_COLORS: Record<string, string> = {
  hoa: '#c2185b',
  thao: '#1565c0',
  huong: '#6a8f00',
  linh: '#e65100',
  ngan: '#7b1fa2',
  trang: '#00838f',
  lan: '#ad1457',
  ut: '#5d4037',
};
const HIRE_COLORS = ['#3949ab', '#00897b', '#8e24aa', '#f4511e', '#43a047', '#6d4c41', '#1e88e5', '#c0ca33', '#d81b60', '#546e7a'];

export function workerColor(w: Worker): string {
  if (einkOn) return '#4d4d4d';
  if (WORKER_COLORS[w.id]) return WORKER_COLORS[w.id]!;
  let h = 0;
  for (const ch of w.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return HIRE_COLORS[h % HIRE_COLORS.length]!;
}

export type Hit = { kind: 'worker'; id: string } | { kind: 'station'; index: number } | { kind: 'bench' } | null;

interface Flight {
  from: { x: number; y: number };
  to: { x: number; y: number };
  t0: number;
  fabric: string;
  tie: string;
}

export interface ViewState {
  selectedWorker: string | null;
  selectedStation: number | null;
}

export class Renderer {
  layout: Layout;
  private ctx: CanvasRenderingContext2D;
  private flights: Flight[] = [];
  private dpr = 1;

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    // every label goes through the translator (a no-op in English)
    const fill = this.ctx.fillText.bind(this.ctx);
    const measure = this.ctx.measureText.bind(this.ctx);
    this.ctx.fillText = ((t: string, x: number, y: number, w?: number) => (w === undefined ? fill(tr(t), x, y) : fill(tr(t), x, y, w))) as typeof this.ctx.fillText;
    this.ctx.measureText = ((t: string) => measure(tr(t))) as typeof this.ctx.measureText;
    this.layout = computeLayout(1, 1, [1]);
  }

  private visible: number[] = [0];
  private size = { w: 1, h: 1 };

  /** Measure the canvas, then lay out the visible lines (all of them when there are one or two). */
  resize(s: GameState, visible?: number[]): void {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.max(1, Math.round(r.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(r.height * this.dpr));
    this.size = { w: Math.max(1, r.width), h: Math.max(1, r.height) };
    if (visible) this.visible = visible;
    this.relayout(s);
  }

  /** Choose which lines are on screen (3+ lines: one pair at a time). */
  setVisible(s: GameState, visible: number[]): void {
    this.visible = visible;
    this.relayout(s);
  }

  relayout(s: GameState, w = this.size.w, h = this.size.h): void {
    const vis = this.visible.filter((l) => l < s.lines.length);
    if (vis.length === 0) vis.push(0);
    this.layout = computeLayout(w, h, vis.map((l) => s.stations.filter((st) => st.line === l).length));
    this.layout.lineIds = vis;
    this.layoutGen += 1;
    const shown = vis.flatMap((l) => s.stations.filter((st) => st.line === l));
    shown.forEach((st, k) => (this.layout.byIndex[st.index] = this.layout.stations[k]));
    if (vis.length === 1 && s.lines.length > 1) {
      // a single visible line out of several still gets its label band
      this.layout.lineRects = [];
    }
  }

  addFlight(s: GameState, from: number, to: number | null, now: number): void {
    if (einkOn) return;
    const l = this.layout;
    const a = l.byIndex[from]?.table;
    if (!a) return;
    const dest = to === null ? l.done : l.byIndex[to]?.pile;
    if (!dest) return;
    const p = PRODUCTS[activeOrder(s, s.stations[from]?.line ?? 0)?.product ?? 'shorts']!;
    this.flights.push({ from: { x: a.x + a.w / 2, y: a.y + a.h / 2 }, to: { x: dest.x + dest.w / 2, y: dest.y + dest.h / 2 }, t0: now, fabric: p.fabric, tie: p.tie });
    if (this.flights.length > 40) this.flights.shift();
  }

  /** Workers drawn on the floor (mechanics are drawn as agents; absent workers are at home). */
  /** The city on screen (two cities, Chapter 9+): the site of the first visible line. */
  private screenSite(s: GameState): string | null {
    if (!s.director) return null;
    return s.lines[this.layout.lineIds[0] ?? 0]?.site ?? null;
  }

  private floorWorkers(s: GameState): Worker[] {
    const site = this.screenSite(s);
    const onScreen = (w: Worker) => (w.station === null ? site === null || (w.site ?? s.lines[0]?.site) === site : !!this.layout.byIndex[w.station]);
    return s.workers.filter(
      (w) => w.role !== 'mechanic' && w.role !== 'leader' && w.role !== 'electrician' && w.role !== 'planner' && w.role !== 'merchandiser' && !w.absent && onScreen(w),
    );
  }

  hitTest(s: GameState, x: number, y: number, frac: number): Hit {
    const l = this.layout;
    for (const w of this.floorWorkers(s)) {
      const p = this.workerPos(s, w, frac);
      if (Math.hypot(p.x - x, p.y - y) <= l.radius * 1.35) return { kind: 'worker', id: w.id };
    }
    for (const st of s.stations) {
      const cell = l.byIndex[st.index];
      if (cell && contains(cell.cell, x, y)) return { kind: 'station', index: st.index };
    }
    if (contains(l.bench, x, y)) return { kind: 'bench' };
    return null;
  }

  workerPos(s: GameState, w: Worker, frac: number): { x: number; y: number } {
    const list = this.floorWorkers(s);
    const benchers = list.filter((x) => x.station === null);
    const at = (st: number | null) => {
      const seat = st !== null ? this.layout.byIndex[st]?.seat : undefined;
      if (seat) return seat;
      const i = Math.max(0, benchers.indexOf(w));
      return benchSlot(this.layout, i, Math.max(benchers.length, 1));
    };
    const now = s.minute + frac;
    if (w.arriveAt > now && w.arriveAt > w.leftAt) {
      const t = Math.max(0, Math.min(1, (now - w.leftAt) / (w.arriveAt - w.leftAt)));
      const a = at(w.from);
      const b = at(w.station);
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    return at(w.station);
  }

  private agentPos(s: GameState, a: Agent, k: number, frac: number): { x: number; y: number } {
    const l = this.layout;
    const spot = (p: number) => {
      const c = p >= 0 ? l.byIndex[p] : undefined;
      if (!c) return officeSpot(l, k);
      const t = c.table;
      return c.horizontal ? { x: t.x + l.radius * 0.6, y: t.y + t.h * 0.2 } : { x: t.x + t.w * 0.2, y: t.y + l.radius * 0.3 };
    };
    if (a.target === null) return spot(a.pos);
    const now = s.minute + frac;
    if (a.until === 0 && a.arriveAt > now && a.arriveAt > a.leftAt) {
      const t = Math.max(0, Math.min(1, (now - a.leftAt) / (a.arriveAt - a.leftAt)));
      const p0 = spot(a.pos);
      const p1 = spot(a.target);
      return { x: p0.x + (p1.x - p0.x) * t, y: p0.y + (p1.y - p0.y) * t };
    }
    return spot(a.target);
  }

  /** The static layer (floor, walls, zones, furniture, tables, stools, lanes): rebuilt only when its key changes. */
  private bg: HTMLCanvasElement | null = null;
  private bgKey = '';
  private layoutGen = 0;

  private staticKey(s: GameState): string {
    return [this.layoutGen, this.size.w, this.size.h, this.dpr, einkOn, this.cosmetics.calendar?.colour ?? '', chapterOf(s).year, s.stations.map((st) => st.machine).join('')].join('|');
  }

  private drawStatic(ctx: CanvasRenderingContext2D, s: GameState): void {
    const l = this.layout;
    A.terrazzo(ctx, l.width, l.height, C, einkOn);
    if (!einkOn) for (const r of l.lineRects.length ? l.lineRects : [bounds(l.stations.map((c) => c.cell))]) A.lightPool(ctx, r);
    A.wallFrame(ctx, l.width, l.height, 8, C, false);
    A.zoneBase(ctx, l.office, C.zoneOffice, C);
    if (!einkOn) A.parquet(ctx, l.office, C);
    A.officeDesk(ctx, l.office, l.portrait, C);
    A.zoneBase(ctx, l.bench, C.zoneBench, C);
    A.zoneBase(ctx, l.cut, C.zoneCut, C);
    A.zoneBase(ctx, l.done, C.zonePacked, C);
    // painted lanes only on wide layouts: in portrait the lanes would run through the labels
    if (!l.portrait) l.lineRects.forEach((r, k) => A.lineFloor(ctx, r, C.line[(l.lineIds[k] ?? k) % 4]!, C, einkOn));
    for (const st of s.stations) {
      const cell = l.byIndex[st.index];
      if (!cell) continue;
      A.machineTable(ctx, cell.table, st.machine, C);
      if (st.machine !== 'cutting') A.stool(ctx, cell.seat.x, cell.seat.y, l.radius, C);
      if (st.machine === 'qc' && !einkOn) {
        const t = cell.table;
        const L2 = Math.min(t.h * 0.2, 7);
        A.lightPool(ctx, { x: t.x + t.w * 0.74 - 2.4 * L2, y: t.y + t.h * 0.35 - 2.4 * L2, w: 4.8 * L2, h: 4.8 * L2 }, 0.45, '255,240,190');
      }
    }
    const cal = this.cosmetics.calendar;
    if (cal && !l.portrait) {
      const o = l.office;
      const w = Math.min(26, o.w * 0.18);
      A.calendar(ctx, o.x + o.w - w - 6, o.y + 8, w, cal.colour, chapterOf(s).year, C, einkOn);
    }
  }

  private blitStatic(s: GameState): void {
    const ctx = this.ctx;
    if (typeof document === 'undefined' || typeof document.createElement !== 'function') {
      this.drawStatic(ctx, s); // tests and headless harvests: draw straight onto the canvas
      return;
    }
    const key = this.staticKey(s);
    if (!this.bg || key !== this.bgKey) {
      this.bg ??= document.createElement('canvas');
      this.bg.width = Math.max(1, Math.round(this.layout.width * this.dpr));
      this.bg.height = Math.max(1, Math.round(this.layout.height * this.dpr));
      const b = this.bg.getContext('2d');
      if (!b) {
        this.drawStatic(ctx, s);
        return;
      }
      b.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.drawStatic(b, s);
      this.bgKey = key;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.bg, 0, 0);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  draw(s: GameState, view: ViewState, frac: number, timeMs: number, overlay: Overlay = 'none'): void {
    const ctx = this.ctx;
    const l = this.layout;
    const T = motionOn ? timeMs : 0;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.blitStatic(s);

    this.zoneLabel(l.office, 'Office');
    this.zoneLabel(l.bench, 'Bench');
    this.drawCut(s);
    this.drawDone(s);
    this.drawLines(s);
    this.drawBenchPlanks(s);

    const lunch = isLunch(s);
    for (const st of s.stations) this.drawStation(s, st, view, frac, T, lunch);
    if (overlay !== 'none') this.drawOverlay(s, overlay);

    const dur = 450;
    this.flights = this.flights.filter((f) => timeMs - f.t0 < dur);
    for (const f of this.flights) {
      const t = (timeMs - f.t0) / dur;
      const xl = f.from.x + (f.to.x - f.from.x) * t;
      const yl = f.from.y + (f.to.y - f.from.y) * t;
      A.ell(ctx, xl, yl + 4, 6, 2, 'rgba(0,0,0,0.12)');
      this.bundleRect(xl - 7, yl - 4 - Math.sin(t * Math.PI) * 14, 14, 8, f.fabric, f.tie);
    }

    this.drawFans(s, T);
    for (const w of this.floorWorkers(s)) this.drawWorker(s, w, view, frac, T);
    s.agents.forEach((a, k) => this.drawAgent(s, a, k, frac, T));
    this.drawStaff(s, T);
    this.drawCat(s, T);
    this.drawWeather(s, T);

    if (lunch && s.phase === 'shift') {
      ctx.fillStyle = einkOn ? 'rgba(255,255,255,0.6)' : 'rgba(243,234,215,0.55)';
      ctx.fillRect(0, 0, l.width, l.height);
      for (const st of s.stations) {
        const cell = l.byIndex[st.index];
        if (!cell || !st.workerId || st.machine === 'cutting') continue;
        A.tiffin(ctx, cell.table.x + cell.table.w - 0.6 * l.radius, cell.table.y + 0.6 * l.radius, l.radius, C);
      }
      const fs = Math.round(l.radius * 1.1);
      ctx.font = `bold ${fs}px system-ui, sans-serif`;
      const text = 'Lunch · rice from the tin boxes';
      const tw = ctx.measureText(text).width;
      A.rr(ctx, l.width / 2 - tw / 2 - 10, l.height / 2 - fs, tw + 20, fs * 1.5, fs * 0.75, 'rgba(255,250,240,0.92)');
      ctx.fillStyle = C.ink;
      ctx.textAlign = 'center';
      ctx.fillText(text, l.width / 2, l.height / 2);
    }
  }

  /** A ceiling fan's turning shadow over each line, once fans are bought (they stop in a power cut). */
  private drawFans(s: GameState, T: number): void {
    if (!s.welfare.fans || einkOn) return;
    const off = !!s.power && s.power.off && !s.power.generator.running;
    const l = this.layout;
    const rects = l.lineRects.length ? l.lineRects : [bounds(l.stations.map((c) => c.cell))];
    for (const r of rects) {
      const c0 = l.stations[0]?.cell;
      const Rf = Math.min(46, 1.4 * Math.min(c0?.w ?? 40, c0?.h ?? 40));
      A.fanShadow(this.ctx, r.x + r.w / 2, r.y + r.h / 2, Rf, off ? 0 : T);
    }
  }

  /** Wooden planks under the people waiting on the bench. */
  private drawBenchPlanks(s: GameState): void {
    const l = this.layout;
    const benchers = this.floorWorkers(s).filter((w) => w.station === null);
    if (!benchers.length) return;
    const rows = new Map<number, number[]>();
    benchers.forEach((_, i) => {
      const p = benchSlot(l, i, benchers.length);
      const key = Math.round(p.y);
      rows.set(key, [...(rows.get(key) ?? []), p.x]);
    });
    for (const [y, xs] of rows) {
      const x0 = Math.max(l.bench.x + 4, Math.min(...xs) - l.radius);
      const x1 = Math.min(l.bench.x + l.bench.w - 4, Math.max(...xs) + l.radius);
      A.benchPlank(this.ctx, x0, y + 0.3 * l.radius, Math.max(10, x1 - x0), l.radius, C);
    }
  }

  /** Line tags (the tint and the painted lanes are in the static layer). */
  private drawLines(s: GameState): void {
    const ctx = this.ctx;
    this.layout.lineRects.forEach((r, k) => {
      const i = this.layout.lineIds[k] ?? k;
      const o = activeOrder(s, i);
      const label = `${s.lines[i]!.name}${o ? ` · ${PRODUCTS[o.product]!.plural} ${o.finished}/${o.qty}` : ' · idle'}`;
      ctx.font = 'bold 10px system-ui, sans-serif';
      const w = ctx.measureText(label).width + 10;
      if (!einkOn) A.rr(ctx, r.x + 4, r.y + 2.5, w, 14, 4, 'rgba(0,0,0,0.18)');
      A.rr(ctx, r.x + 4, r.y + 1, w, 14, 4, C.line[i % 4]!);
      if (!einkOn) {
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        A.rrPath(ctx, r.x + 4.5, r.y + 1.5, w - 1, 13, 4);
        ctx.stroke();
      }
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'left';
      ctx.fillText(label, r.x + 9, r.y + 12);
    });
  }

  /** Line leaders stand by their line's label; electricians wait in the office. */
  private drawStaff(s: GameState, T: number): void {
    const r = this.layout.radius * 0.8;
    s.workers.forEach((w) => {
      if (w.absent) return;
      if (w.role === 'leader') {
        const line = s.lines.findIndex((l) => l.leaderId === w.id);
        const rect = line >= 0 ? this.layout.lineRects[this.layout.lineIds.indexOf(line)] : undefined;
        if (line >= 0 && !rect && this.layout.lineIds.length < s.lines.length) return; // leads a line that is not on screen
        const p = rect ? { x: rect.x + rect.w - r - 4, y: rect.y + 8 } : officeSpot(this.layout, 1.4);
        A.body(this.ctx, p.x, p.y, r, { coat: C.leader, label: 'L', facing: 'down', pose: 'stand', prop: 'clipboard' }, T, C, einkOn);
      } else if (w.role === 'electrician') {
        const p = officeSpot(this.layout, 2);
        A.body(this.ctx, p.x, p.y, r, { coat: C.electrician, label: 'E', facing: 'down', pose: 'stand', hat: 'helmet', prop: 'cable' }, T, C, einkOn);
      }
    });
  }

  private drawWeather(s: GameState, timeMs: number): void {
    const p = s.power;
    if (!p) return;
    const ctx = this.ctx;
    const l = this.layout;
    if (p.rain && !einkOn) {
      ctx.strokeStyle = 'rgba(80,120,190,0.25)';
      ctx.lineWidth = 1;
      const off = (timeMs / 20) % 24;
      for (let x = -40; x < l.width; x += 24) {
        ctx.beginPath();
        ctx.moveTo(x + off, 0);
        ctx.lineTo(x + off + 10, 26);
        ctx.stroke();
      }
    }
    const closed = s.minute >= p.closedFrom && s.minute < p.closedUntil;
    if ((p.off && !p.generator.running) || closed) {
      ctx.fillStyle = einkOn ? 'rgba(0,0,0,0.25)' : 'rgba(10,15,30,0.45)';
      ctx.fillRect(0, 0, l.width, l.height);
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.round(l.radius * 1.1)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText(closed ? 'Closed: everyone is helping in the flood' : p.generator.startAt > 0 ? 'Power cut · starting the generator…' : 'Power cut', l.width / 2, l.height / 2);
    } else if (p.generator.running) {
      ctx.font = 'bold 11px system-ui, sans-serif';
      const label = 'Generator running';
      const w = ctx.measureText(label).width + 12;
      ctx.fillStyle = einkOn ? '#000' : '#f9a825';
      roundRect(ctx, l.office.x + 4, l.office.y + l.office.h - 20, w, 16, 8);
      ctx.fill();
      ctx.fillStyle = einkOn ? '#fff' : '#2b2a26';
      ctx.textAlign = 'left';
      ctx.fillText(label, l.office.x + 10, l.office.y + l.office.h - 8);
    }
  }

  /** Bottleneck: red = the slowest operation of its line, green = spare capacity. Quality: defects made today. */
  private drawOverlay(s: GameState, overlay: Overlay): void {
    const ctx = this.ctx;
    for (const st of s.stations) {
      if (!st.opId || st.machine === 'cutting' || st.machine === 'qc') continue;
      const sc = this.layout.byIndex[st.index];
      if (!sc) continue;
      const cell = sc.cell;
      let colour = '';
      let label = '';
      if (overlay === 'bottleneck') {
        const cap = opCapacities(s, st.line);
        const neck = bottleneck(s, st.line);
        if (!(st.opId in cap) || !neck) continue;
        const ratio = cap[st.opId]! / Math.max(1, cap[neck]!);
        colour = st.opId === neck ? 'rgba(192,57,43,0.35)' : ratio < 1.2 ? 'rgba(217,138,0,0.28)' : 'rgba(46,125,50,0.22)';
        label = st.opId === neck ? 'SLOWEST' : `${Math.round(stationRate(s, st))}/h`;
      } else {
        const d = st.defects;
        colour = d >= 6 ? 'rgba(192,57,43,0.35)' : d >= 2 ? 'rgba(217,138,0,0.28)' : 'rgba(46,125,50,0.18)';
        label = `${d} defect${d === 1 ? '' : 's'}`;
      }
      ctx.fillStyle = einkOn ? 'rgba(0,0,0,0.12)' : colour;
      roundRect(ctx, cell.x + 2, cell.y + 2, cell.w - 4, cell.h - 4, 8);
      ctx.fill();
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.fillStyle = C.ink;
      ctx.textAlign = 'left';
      ctx.fillText(label, cell.x + 6, cell.y + 11);
    }
  }

  private zoneLabel(r: Rect, label: string): void {
    const ctx = this.ctx;
    ctx.fillStyle = C.zoneLabel;
    ctx.font = '600 11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label, r.x + 6, r.y + 13);
  }

  private bundleRect(x: number, y: number, w: number, h: number, fabric: string, tie: string): void {
    A.bundle(this.ctx, x, y, w, h, fabric, tie, einkOn);
  }

  private bundleColours(s: GameState, b: Bundle): [string, string] {
    const p = PRODUCTS[orderById(s, b.orderId)?.product ?? 'shorts']!;
    return b.rework ? ['#e57373', '#fff'] : [p.fabric, p.tie];
  }

  private drawPile(s: GameState, r: Rect, pile: Bundle[]): void {
    const ctx = this.ctx;
    const n = pile.length;
    const bw = Math.max(10, Math.min(20, r.w / 5));
    const bh = Math.max(5, Math.min(9, r.h / 6));
    const cols = Math.max(1, Math.floor(r.w / (bw + 2)));
    const rows = Math.max(1, Math.floor((r.h - 12) / (bh + 1)));
    const shown = Math.min(n, cols * rows);
    for (let i = 0; i < shown; i++) {
      const c = Math.floor(i / rows);
      const k = i % rows;
      const [f, t] = this.bundleColours(s, pile[i]!);
      if (k === 0) {
        ctx.fillStyle = C.tableShadow;
        ctx.fillRect(r.x + c * (bw + 2), r.y + r.h - 1, bw, 2);
      }
      this.bundleRect(r.x + c * (bw + 2) + (((i * 7 + k) % 3) - 1), r.y + r.h - (k + 1) * (bh + 1), bw, bh, f, t);
    }
    if (n >= 4) {
      const danger = n >= 7;
      ctx.strokeStyle = danger ? C.danger : C.warn;
      ctx.lineWidth = danger ? 3 : 2;
      ctx.setLineDash(danger ? [] : [5, 4]);
      roundRect(ctx, r.x - 2, r.y - 2, r.w + 4, r.h + 4, 6);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (n > 0) {
      ctx.fillStyle = n >= 7 ? C.danger : n >= 4 ? (einkOn ? C.ink : '#8a5800') : C.muted;
      ctx.font = `${n >= 4 ? 'bold ' : ''}10px system-ui, sans-serif`;
      ctx.textAlign = 'right';
      ctx.fillText(`${n >= 7 ? '!! ' : ''}${n}`, r.x + r.w, r.y + 9);
    }
  }


  private drawCut(s: GameState): void {
    const r = this.layout.cut;
    this.zoneLabel(r, 'Cut fabric');
    const actives = s.lines.map((_, i) => activeOrder(s, i)).filter((x) => !!x);
    const o = actives[0];
    const p = PRODUCTS[o?.product ?? 'shorts']!;
    const inner = { x: r.x + 6, y: r.y + 18, w: r.w - 12, h: r.h - 22 };
    const cut = actives.reduce((a, x) => a + (x?.cut ?? 0), 0);
    const rolls = s.warehouse.filter((x) => !x.rejected && x.metres > 0).length;
    // fabric rolls in store (never over the two text lines)
    const portrait = this.layout.portrait;
    const nRolls = Math.min(rolls, portrait ? 2 : 6);
    const colourOf = (i: number) => (i === 0 ? p.fabric : i % 2 ? C.greige : A.shade(p.fabric, 0.15));
    if (portrait) {
      if (r.w >= 150) for (let i = 0; i < nRolls; i++) A.rollEnd(this.ctx, r.x + r.w - 8 - i * 13, r.y + 9, colourOf(i), einkOn);
    }
    else {
      const rh = Math.max(4, Math.min(9, (r.h * 0.3) / 6));
      for (let i = 0; i < nRolls; i++) {
        const y = r.y + 46 + i * (rh + 3);
        if (y + rh > r.y + r.h * 0.45) break;
        A.rollLying(this.ctx, r.x + 6, y, r.w - 12, rh, colourOf(i), einkOn);
      }
    }
    const n = !o || !o.sampled ? 0 : Math.min(cut, 3 * Math.max(1, Math.floor((inner.h - 16) / 9)));
    for (let i = 0; i < n; i++) this.bundleRect(inner.x + (i % 3) * (inner.w / 3), inner.y + inner.h - 9 * (Math.floor(i / 3) + 1), inner.w / 3 - 2, 8, p.fabric, p.tie);
    const ctx = this.ctx;
    ctx.fillStyle = C.ink;
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(o ? (o.sampled ? `${cut} bundles` : 'Sample first') : 'No order', r.x + 6, r.y + 28);
    if (has(s, 'sourcing') && r.h > 50) {
      ctx.font = '10px system-ui, sans-serif';
      ctx.fillStyle = C.muted;
      ctx.fillText(`${rolls} rolls in store${s.pallets ? ' · pallets' : ''}`, r.x + 6, r.y + 41);
    }
  }

  private drawDone(s: GameState): void {
    const r = this.layout.done;
    this.zoneLabel(r, 'Packed');
    const ctx = this.ctx;
    const actives = s.lines.map((_, i) => activeOrder(s, i));
    const o = actives[0];
    const finished = actives.reduce((a, x) => a + (x?.finished ?? 0), 0);
    const cartons = Math.floor(finished / 50);
    const cw = Math.min(24, r.w / 8);
    const portrait = this.layout.portrait;
    const x0 = portrait ? r.x + 92 : r.x + 6;
    const perRow = portrait ? Math.max(1, Math.floor((r.w - 98) / (cw + 3))) : 3;
    const maxShown = portrait ? perRow : perRow * Math.max(1, Math.floor((r.h - 44) / (cw * 0.7 + 3)));
    for (let i = 0; i < Math.min(cartons, maxShown); i++) {
      const x = x0 + (i % perRow) * (cw + 3);
      const y = r.y + r.h - 6 - (Math.floor(i / perRow) + 1) * (cw * 0.7 + 3);
      A.carton(ctx, x, y, cw, cw * 0.7, C, einkOn);
    }
    ctx.fillStyle = C.ink;
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'left';
    if (s.lines.length > 1) {
      ctx.font = 'bold 11px system-ui, sans-serif';
      const parts = actives.map((x, i) => `${s.lines[i]!.name.slice(-1)} ${x ? `${Math.min(x.finished, x.qty)}/${x.qty}` : '—'}`);
      if (this.layout.portrait) ctx.fillText(parts.join(' · '), r.x + 6, r.y + 30);
      else parts.forEach((t, i) => ctx.fillText(t, r.x + 6, r.y + 28 + i * 13));
    } else ctx.fillText(o ? `${Math.min(finished, o.qty)} / ${o.qty}` : '—', r.x + 6, r.y + 30);
  }

  private drawStation(s: GameState, st: Station, view: ViewState, frac: number, T: number, lunch: boolean): void {
    const ctx = this.ctx;
    const cell = this.layout.byIndex[st.index];
    if (!cell) return;
    const sel = view.selectedStation === st.index;
    if (sel || view.selectedWorker) {
      ctx.strokeStyle = C.select;
      ctx.lineWidth = sel ? 3 : 1;
      ctx.setLineDash(sel ? [] : [3, 4]);
      roundRect(ctx, cell.cell.x + 1, cell.cell.y + 1, cell.cell.w - 2, cell.cell.h - 2, 8);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    this.drawPile(s, cell.pile, st.pile);

    // the table and the stool are in the static layer
    const t = cell.table;
    const mw = Math.min(t.w * 0.42, 38);
    const mh = Math.min(t.h * 0.55, 24);
    const mx = cell.horizontal ? t.x + t.w * 0.06 : t.x + (t.w - mw) / 2;
    const my = cell.horizontal ? t.y + (t.h - mh) / 2 : t.y + t.h * 0.08;
    const working = isWorking(s, st);
    const order = activeOrder(s, st.line);
    const prod = PRODUCTS[order?.product ?? 'shorts']!;
    if (st.machine === 'cutting') A.cuttingTable(ctx, t, prod.fabric, !!st.current, working, T, st.index, C, einkOn);
    else if (st.machine === 'qc') A.qcTable(ctx, t, order ? prod.fabric : null, C, einkOn);
    else {
      A.machine(ctx, { kind: st.machine, mx, my, mw, mh, tc: einkOn ? '#ffffff' : prod.tie, running: working, T, index: st.index, spare: st.opId === null }, C, einkOn);
      if (st.broken) A.brokenFx(ctx, mx, my, mw, mh, T, st.index, einkOn);
    }

    if (st.current && st.opId && st.machine !== 'cutting') {
      const rate = working ? stationEfficiency(s, st) / opDef(st.opId).smv : 0;
      const p = Math.min(1, (st.current.done + rate * frac) / st.current.pieces);
      const [f, tie] = this.bundleColours(s, st.current);
      if (st.machine !== 'qc') this.bundleRect(mx + mw * 0.05, my + mh * 0.48, mw * 0.5, mh * 0.2, f, tie);
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillRect(t.x + 4, t.y + t.h - 6, t.w - 8, 3);
      ctx.fillStyle = C.select;
      ctx.fillRect(t.x + 4, t.y + t.h - 6, (t.w - 8) * p, 3);
    }

    if (st.broken || st.serviceUntil > s.minute) {
      const cx = mx + mw / 2;
      const cy = my - 1;
      if (st.broken) A.hazardBadge(ctx, cx, cy, C, einkOn);
      else A.wrenchBadge(ctx, cx, cy, C, einkOn);
      const agent = s.agents.find((a) => a.target === st.index && a.until > 0);
      if (agent) {
        const total = agent.task === 'needle' ? s.tuning.needleChangeMinutes : agent.kind === 'mechanic' ? s.tuning.mechanicFixMinutes : s.tuning.fixMinutes;
        const p = 1 - (agent.until - s.minute - frac) / total;
        ctx.strokeStyle = agent.kind === 'mechanic' ? C.mechanic : C.director;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy - 5, 12, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, Math.min(1, p)));
        ctx.stroke();
      }
    }

    // label
    const lb = cell.label;
    ctx.textAlign = 'left';
    ctx.fillStyle = C.ink;
    const big = lb.w > 90;
    ctx.font = `bold ${big ? 12 : 10}px system-ui, sans-serif`;
    const opName = st.opId ? opDef(st.opId).name : 'Spare machine';
    ctx.fillText(fit(ctx, opName, lb.w), lb.x, lb.y + 12);
    ctx.font = `${big ? 11 : 10}px system-ui, sans-serif`;
    const w = workerById(s, st.workerId);
    let status = '';
    if (st.machine === 'cutting') {
      const cw = workerById(s, st.workerId);
      status = !cw ? 'Nobody here' : st.current ? `${cw.name} cutting` : `${cw.name} · no fabric`;
    } else if (st.broken) status = s.agents.some((a) => a.target === st.index) || s.repairQueue.includes(st.index) ? 'Being fixed' : 'Broken: tap';
    else if (st.serviceUntil > s.minute) status = 'New needle';
    else if (st.opId === null) status = 'Tap: set a job';
    else if (!w) status = 'Nobody here';
    else if (w.arriveAt > s.minute) status = `${w.name} walking`;
    else if (lunch) status = `${w.name} · lunch`;
    else if (!st.current) status = `${w.name} · waiting`;
    else status = `${w.name} · ${Math.round((60 * stationEfficiency(s, st)) / opDef(st.opId).smv)}/h`;
    ctx.fillStyle = st.broken || (!w && st.opId) ? C.danger : C.muted;
    ctx.fillText(fit(ctx, status, lb.w), lb.x, lb.y + (big ? 27 : 24));
    if (lb.h >= 44) {
      ctx.fillStyle = C.muted;
      ctx.fillText(fit(ctx, MACHINE_LABEL[st.machine], lb.w), lb.x, lb.y + lb.h - 3);
    }
  }


  /** Cosmetics chosen on the title screen (looks only). */
  cosmetics: { cap: string; collar: string | null; calendar: { colour: string } | null } = { cap: 'rgba(255,255,255,0.85)', collar: null, calendar: null };

  /** The factory cat wanders along the bench and sleeps through lunch. */
  private drawCat(s: GameState, T: number): void {
    if (!this.cosmetics.collar) return;
    const b = this.layout.bench;
    const c = this.layout.radius * 0.55;
    const asleep = isLunch(s) || s.phase !== 'shift';
    const t = asleep ? 0 : T / 7000;
    // in portrait the right end of the bench holds the line picker: walk on the left half
    const x = this.layout.portrait ? b.x + b.w * (0.22 + 0.14 * Math.sin(t)) : b.x + b.w * (0.55 + 0.38 * Math.sin(t));
    const y = b.y + b.h - c * 1.6;
    const dir = Math.cos(t) >= 0 ? 1 : -1;
    A.cat(this.ctx, x, y, c, dir, asleep, this.cosmetics.collar, T, C, einkOn);
  }

  /** Which way a seated worker faces: towards the machine. */
  private facingAt(station: number | null): A.Facing {
    const cell = station !== null ? this.layout.byIndex[station] : undefined;
    if (!cell) return 'down';
    return cell.horizontal ? 'left' : 'up';
  }

  private drawWorker(s: GameState, w: Worker, view: ViewState, frac: number, T: number): void {
    const ctx = this.ctx;
    const r = this.layout.radius;
    const p = this.workerPos(s, w, frac);
    if (view.selectedWorker === w.id) {
      ctx.fillStyle = 'rgba(31,122,92,0.25)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 1.6 + Math.sin(T / 200) * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    const walking = w.arriveAt > s.minute + frac && w.arriveAt > w.leftAt;
    const seated = w.station !== null && !walking;
    if (seated) {
      const eff = stationEfficiency(s, s.stations[w.station!]!);
      ctx.strokeStyle = 'rgba(43,42,38,0.15)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = einkOn ? C.ink : eff >= 0.8 ? C.ok : eff >= 0.6 ? C.warn : C.danger;
      if (einkOn) ctx.setLineDash(eff >= 0.8 ? [] : eff >= 0.6 ? [6, 3] : [2, 3]);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, eff));
      ctx.stroke();
      ctx.lineCap = 'butt';
      ctx.setLineDash([]);
    }
    let facing: A.Facing = 'down';
    if (walking) {
      const to = this.workerPosAt(s, w, w.station);
      const from = this.workerPosAt(s, w, w.from);
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      facing = Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down';
    } else if (seated) facing = this.facingAt(w.station);
    const phase = (w.id.charCodeAt(0) * 37) % 360;
    A.body(ctx, p.x, p.y, r, {
      coat: workerColor(w),
      label: w.role === 'qc' ? 'QC' : w.name.slice(0, 2),
      facing,
      pose: walking ? 'walk' : seated ? 'seated' : 'stand',
      cap: this.cosmetics.cap,
      prop: w.role === 'qc' ? 'magnifier' : null,
      phase,
    }, T, C, einkOn);
    // one mood cue: sweat (hot) > tired > happy
    const hot = (!!s.power && s.power.off && !s.power.generator.running) || (has(s, 'morale') && !s.welfare.fans && w.fatigue > 0.4);
    if (hot && r >= 9) A.sweat(ctx, p.x, p.y, r, T, phase / 360, C);
    else if (w.fatigue > 0.55) {
      ctx.fillStyle = C.muted;
      ctx.font = `bold ${Math.round(r * 0.7)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('z', p.x + r * 0.9, p.y - r * 0.9 - Math.sin(T / 400) * 2);
    } else if (has(s, 'morale') && w.morale >= 0.8 && w.fatigue < 0.4 && r >= 9 && (T === 0 ? r >= 12 : (T + phase * 997) % 6000 < 1200)) A.heart(ctx, p.x, p.y, r, C);
    if (w.station === null && !walking) {
      ctx.fillStyle = C.ink;
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(w.name, p.x, p.y + r + 11);
    }
  }

  /** Where a worker sits (or waits on the bench) for a given station, without the walking interpolation. */
  private workerPosAt(s: GameState, w: Worker, station: number | null): { x: number; y: number } {
    const seat = station !== null ? this.layout.byIndex[station]?.seat : undefined;
    if (seat) return seat;
    const benchers = this.floorWorkers(s).filter((x) => x.station === null);
    const i = Math.max(0, benchers.indexOf(w));
    return benchSlot(this.layout, i, Math.max(benchers.length, 1));
  }

  private drawAgent(s: GameState, a: Agent, k: number, frac: number, T: number): void {
    if (a.kind === 'mechanic' && workerById(s, a.id)?.absent) return;
    const site = this.screenSite(s);
    if (site !== null) {
      if (a.kind === 'director' && (s.director!.flightUntil > 0 || s.director!.site !== site)) return;
      if (a.kind === 'mechanic') {
        const w = workerById(s, a.id);
        const home = w ? (w.station !== null ? s.lines[s.stations[w.station]!.line]?.site : w.site) : null;
        if (home && home !== site) return;
      }
    }
    const r = this.layout.radius * 0.85;
    const p = this.agentPos(s, a, k, frac);
    const jig = a.until > 0 ? Math.sin(T / 60) * 1.5 : 0;
    const moving = a.target !== null && a.until === 0 && a.arriveAt > s.minute + frac;
    if (a.kind === 'director') {
      A.body(this.ctx, p.x + jig, p.y, r, { coat: C.shirt, label: 'You', labelInk: C.director, facing: 'down', pose: moving ? 'walk' : 'stand', outline: true, diamond: C.director }, T, C, einkOn);
    } else {
      A.body(this.ctx, p.x + jig, p.y, r, { coat: C.mechanicSuit, label: 'M', facing: 'down', pose: moving ? 'walk' : 'stand', straps: true, prop: 'toolbox' }, T, C, einkOn);
    }
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fit(ctx: CanvasRenderingContext2D, raw: string, maxW: number): string {
  const text = tr(raw); // translate first, then truncate
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
  return `${t}…`;
}

function bounds(rs: Rect[]): Rect {
  if (!rs.length) return { x: 0, y: 0, w: 1, h: 1 };
  const x0 = Math.min(...rs.map((r) => r.x));
  const y0 = Math.min(...rs.map((r) => r.y));
  const x1 = Math.max(...rs.map((r) => r.x + r.w));
  const y1 = Math.max(...rs.map((r) => r.y + r.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
