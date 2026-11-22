import { MACHINE_LABEL, PRODUCTS } from '../data/products';
import { activeOrder, bottleneck, chapterOf, has, isLunch, isWorking, opCapacities, opDef, orderById, stationEfficiency, stationRate, workerById } from '../sim/selectors';
import type { Agent, Bundle, GameState, Station, Worker } from '../sim/types';
import { benchSlot, computeLayout, contains, officeSpot, type Layout, type Rect } from './layout';
import { tr } from '../ui/i18n';

/** Canvas renderer. Reads state, never writes it. */

const COLOUR = {
  floor: '#f3ead7',
  tile: '#ebe0c8',
  wall: '#dfe8d8',
  ink: '#2b2a26',
  muted: '#6f6a5e',
  table: '#c9a571',
  tableEdge: '#9c7a48',
  lockstitch: '#3b4a5a',
  overlock: '#5a4a6a',
  buttonhole: '#2f5d62',
  bartack: '#6d4c41',
  cutting: '#8d6e63',
  broken: '#c0392b',
  warn: '#d98a00',
  danger: '#c0392b',
  select: '#1f7a5c',
  carton: '#b08850',
  director: '#1f7a5c',
  mechanic: '#d35400',
  skin: '#e7c19a',
  hair: '#2b2320',
};

/** E-ink: pure greys; meaning is carried by shape, border and pattern. */
const EINK: typeof COLOUR = {
  floor: '#ffffff',
  tile: '#f2f2f2',
  wall: '#e6e6e6',
  ink: '#000000',
  muted: '#444444',
  table: '#d9d9d9',
  tableEdge: '#000000',
  lockstitch: '#333333',
  overlock: '#555555',
  buttonhole: '#222222',
  bartack: '#444444',
  cutting: '#666666',
  broken: '#000000',
  warn: '#555555',
  danger: '#000000',
  select: '#000000',
  carton: '#bbbbbb',
  director: '#000000',
  mechanic: '#333333',
  skin: '#dddddd',
  hair: '#000000',
};
let C = COLOUR;
let einkOn = false;

export function setEink(on: boolean): void {
  einkOn = on;
  C = on ? EINK : COLOUR;
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
  private floorWorkers(s: GameState): Worker[] {
    const onScreen = (st: number | null) => st === null || !!this.layout.byIndex[st];
    return s.workers.filter(
      (w) => w.role !== 'mechanic' && w.role !== 'leader' && w.role !== 'electrician' && w.role !== 'planner' && w.role !== 'merchandiser' && !w.absent && onScreen(w.station),
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

  draw(s: GameState, view: ViewState, frac: number, timeMs: number, overlay: Overlay = 'none'): void {
    const ctx = this.ctx;
    const l = this.layout;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = C.floor;
    ctx.fillRect(0, 0, l.width, l.height);
    // floor tiles
    ctx.fillStyle = C.tile;
    const tile = 28;
    for (let y = 0; y < l.height; y += tile) for (let x = (y / tile) % 2 ? tile : 0; x < l.width; x += tile * 2) ctx.fillRect(x, y, tile, tile);

    this.zone(l.office, 'Office');
    this.zone(l.bench, 'Bench');
    this.drawCut(s);
    this.drawDone(s);
    this.drawLines(s);

    const lunch = isLunch(s);
    for (const st of s.stations) this.drawStation(s, st, view, frac, timeMs, lunch);
    if (overlay !== 'none') this.drawOverlay(s, overlay);

    const dur = 450;
    this.flights = this.flights.filter((f) => timeMs - f.t0 < dur);
    for (const f of this.flights) {
      const t = (timeMs - f.t0) / dur;
      const x = f.from.x + (f.to.x - f.from.x) * t;
      const y = f.from.y + (f.to.y - f.from.y) * t - Math.sin(t * Math.PI) * 14;
      this.bundleRect(x - 7, y - 4, 14, 8, f.fabric, f.tie);
    }

    for (const w of this.floorWorkers(s)) this.drawWorker(s, w, view, frac, timeMs);
    s.agents.forEach((a, k) => this.drawAgent(s, a, k, frac, timeMs));
    this.drawStaff(s);
    this.drawCalendar(s);
    this.drawCat(s, timeMs);
    this.drawWeather(s, timeMs);

    if (lunch && s.phase === 'shift') {
      ctx.fillStyle = 'rgba(243,234,215,0.55)';
      ctx.fillRect(0, 0, l.width, l.height);
      ctx.fillStyle = C.ink;
      ctx.font = `bold ${Math.round(l.radius * 1.1)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('Lunch · rice from the tin boxes', l.width / 2, l.height / 2);
    }
  }

  /** Tint and label each line when there are several. */
  private drawLines(s: GameState): void {
    const ctx = this.ctx;
    this.layout.lineRects.forEach((r, k) => {
      const i = this.layout.lineIds[k] ?? k;
      if (!einkOn) {
        ctx.fillStyle = i % 2 ? 'rgba(47,75,124,0.06)' : 'rgba(194,24,91,0.05)';
        roundRect(ctx, r.x + 1, r.y + 1, r.w - 2, r.h - 2, 8);
        ctx.fill();
      }
      const o = activeOrder(s, i);
      const label = `${s.lines[i]!.name}${o ? ` · ${PRODUCTS[o.product]!.plural} ${o.finished}/${o.qty}` : ' · idle'}`;
      ctx.font = 'bold 10px system-ui, sans-serif';
      const w = ctx.measureText(label).width + 10;
      ctx.fillStyle = einkOn ? '#000' : i % 2 ? '#2f4b7c' : '#c2185b';
      roundRect(ctx, r.x + 4, r.y + 1, w, 14, 7);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'left';
      ctx.fillText(label, r.x + 9, r.y + 12);
    });
  }

  /** Line leaders stand by their line's label; electricians wait in the office. */
  private drawStaff(s: GameState): void {
    const r = this.layout.radius * 0.8;
    s.workers.forEach((w) => {
      if (w.absent) return;
      if (w.role === 'leader') {
        const line = s.lines.findIndex((l) => l.leaderId === w.id);
        const rect = line >= 0 ? this.layout.lineRects[this.layout.lineIds.indexOf(line)] : undefined;
        if (line >= 0 && !rect && this.layout.lineIds.length < s.lines.length) return; // leads a line that is not on screen
        const p = rect ? { x: rect.x + rect.w - r - 4, y: rect.y + 8 } : officeSpot(this.layout, 1.4);
        this.body(p.x, p.y, r, einkOn ? '#222' : '#6a1b9a', 'L', false);
      } else if (w.role === 'electrician') {
        const p = officeSpot(this.layout, 2);
        this.body(p.x, p.y, r, einkOn ? '#222' : '#f9a825', 'E', false);
      }
    });
  }

  /** Rain streaks, power cut shade, generator badge. */
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

  private zone(r: Rect, label: string): void {
    const ctx = this.ctx;
    ctx.fillStyle = C.wall;
    roundRect(ctx, r.x, r.y, r.w, r.h, 8);
    ctx.fill();
    ctx.fillStyle = C.muted;
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label, r.x + 6, r.y + 13);
  }

  private bundleRect(x: number, y: number, w: number, h: number, fabric: string, tie: string): void {
    const ctx = this.ctx;
    if (einkOn) {
      // pattern instead of colour: stripes for rework, hatch for everything else
      ctx.fillStyle = '#fff';
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = -h; i < w; i += fabric === '#e57373' ? 3 : 5) {
        ctx.moveTo(x + Math.max(0, i), y + Math.max(0, -i));
        ctx.lineTo(x + Math.min(w, i + h), y + Math.min(h, h - (i + h - Math.min(w, i + h))));
      }
      ctx.stroke();
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      return;
    }
    ctx.fillStyle = fabric;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = tie;
    ctx.fillRect(x + w * 0.45, y, Math.max(2, w * 0.1), h);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
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
      this.bundleRect(r.x + c * (bw + 2), r.y + r.h - (k + 1) * (bh + 1), bw, bh, f, t);
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
    this.zone(r, 'Cut fabric');
    const actives = s.lines.map((_, i) => activeOrder(s, i)).filter((x) => !!x);
    const o = actives[0];
    const p = PRODUCTS[o?.product ?? 'shorts']!;
    const inner = { x: r.x + 6, y: r.y + 18, w: r.w - 12, h: r.h - 22 };
    const cut = actives.reduce((a, x) => a + (x?.cut ?? 0), 0);
    const n = !o || !o.sampled ? 0 : Math.min(cut, 3 * Math.max(1, Math.floor((inner.h - 16) / 9)));
    for (let i = 0; i < n; i++) this.bundleRect(inner.x + (i % 3) * (inner.w / 3), inner.y + inner.h - 9 * (Math.floor(i / 3) + 1), inner.w / 3 - 2, 8, p.fabric, p.tie);
    const ctx = this.ctx;
    ctx.fillStyle = C.ink;
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'left';
    const rolls = s.warehouse.filter((x) => !x.rejected && x.metres > 0).length;
    ctx.fillText(o ? (o.sampled ? `${cut} bundles` : 'Sample first') : 'No order', r.x + 6, r.y + 28);
    if (has(s, 'sourcing') && r.h > 50) {
      ctx.font = '10px system-ui, sans-serif';
      ctx.fillStyle = C.muted;
      ctx.fillText(`${rolls} rolls in store${s.pallets ? ' · pallets' : ''}`, r.x + 6, r.y + 41);
    }
  }

  private drawDone(s: GameState): void {
    const r = this.layout.done;
    this.zone(r, 'Packed');
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
      ctx.fillStyle = C.carton;
      ctx.fillRect(x, y, cw, cw * 0.7);
      ctx.strokeStyle = '#7d5f33';
      ctx.strokeRect(x + 0.5, y + 0.5, cw - 1, cw * 0.7 - 1);
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

  private drawStation(s: GameState, st: Station, view: ViewState, frac: number, timeMs: number, lunch: boolean): void {
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

    const t = cell.table;
    ctx.fillStyle = st.machine === 'qc' ? (einkOn ? '#ffffff' : '#e9e3d0') : C.table;
    roundRect(ctx, t.x, t.y, t.w, t.h, 5);
    ctx.fill();
    ctx.strokeStyle = C.tableEdge;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const mw = Math.min(t.w * 0.42, 38);
    const mh = Math.min(t.h * 0.55, 24);
    const mx = cell.horizontal ? t.x + t.w * 0.06 : t.x + (t.w - mw) / 2;
    const my = cell.horizontal ? t.y + (t.h - mh) / 2 : t.y + t.h * 0.08;
    const working = isWorking(s, st);
    if (st.machine === 'cutting') {
      // cutting table: a fabric roll and scissors
      ctx.fillStyle = einkOn ? '#bbb' : '#9fb3c8';
      ctx.fillRect(mx, my + mh * 0.2, mw * 0.55, mh * 0.5);
      ctx.fillStyle = einkOn ? '#888' : '#7d93ab';
      ctx.beginPath();
      ctx.ellipse(mx + mw * 0.55, my + mh * 0.45, mh * 0.12, mh * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2;
      const sx = mx + mw * 0.8;
      const sy = my + mh * 0.45;
      const snip = working && !einkOn ? Math.sin(timeMs / 90) * 0.25 : 0.2;
      ctx.beginPath();
      ctx.moveTo(sx - 8, sy - 6 * snip - 2);
      ctx.lineTo(sx + 6, sy + 2);
      ctx.moveTo(sx - 8, sy + 6 * snip + 2);
      ctx.lineTo(sx + 6, sy - 2);
      ctx.stroke();
    } else if (st.machine === 'qc') {
      // QC table: a lamp and a magnifier
      ctx.strokeStyle = C.ink;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(mx + mw * 0.35, my + mh * 0.45, mh * 0.28, 0, Math.PI * 2);
      ctx.moveTo(mx + mw * 0.35 + mh * 0.2, my + mh * 0.45 + mh * 0.2);
      ctx.lineTo(mx + mw * 0.75, my + mh * 0.95);
      ctx.stroke();
    } else {
      ctx.fillStyle = st.broken ? C.broken : C[st.machine];
      if (st.machine === 'lockstitch') {
        ctx.fillRect(mx, my + mh * 0.65, mw, mh * 0.35);
        ctx.fillRect(mx + mw * 0.75, my, mw * 0.25, mh);
        ctx.fillRect(mx + mw * 0.1, my, mw * 0.9, mh * 0.3);
      } else if (st.machine === 'overlock') {
        roundRect(ctx, mx, my + mh * 0.15, mw, mh * 0.85, 6);
        ctx.fill();
        ctx.fillStyle = '#d9d2e9';
        ctx.beginPath();
        ctx.arc(mx + mw * 0.7, my + mh * 0.5, mh * 0.18, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(mx, my + mh * 0.2, mw, mh * 0.8);
        ctx.fillStyle = '#cfe8e6';
        ctx.fillRect(mx + mw * 0.15, my + mh * 0.35, mw * 0.3, mh * 0.12);
        ctx.fillRect(mx + mw * 0.15, my + mh * 0.6, mw * 0.3, mh * 0.12);
      }
      const nx = mx + mw * 0.2;
      const bob = working && !einkOn ? Math.abs(Math.sin(timeMs / 70 + st.index)) * mh * 0.25 : 0;
      ctx.strokeStyle = '#ddd';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(nx, my + mh * 0.3);
      ctx.lineTo(nx, my + mh * 0.45 + bob);
      ctx.stroke();
    }

    if (st.current && st.opId) {
      const rate = working ? stationEfficiency(s, st) / opDef(st.opId).smv : 0;
      const p = Math.min(1, (st.current.done + rate * frac) / st.current.pieces);
      const [f, tie] = this.bundleColours(s, st.current);
      this.bundleRect(mx + mw * 0.05, my + mh * 0.48, mw * 0.5, mh * 0.2, f, tie);
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillRect(t.x + 4, t.y + t.h - 6, t.w - 8, 3);
      ctx.fillStyle = C.select;
      ctx.fillRect(t.x + 4, t.y + t.h - 6, (t.w - 8) * p, 3);
    }

    if (st.broken || st.serviceUntil > s.minute) {
      const cx = mx + mw / 2;
      const cy = my - 1;
      ctx.fillStyle = st.broken ? C.danger : C.mechanic;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 13);
      ctx.lineTo(cx + 8, cy + 2);
      ctx.lineTo(cx - 8, cy + 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(st.broken ? '!' : 'n', cx, cy);
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
  private drawCat(s: GameState, timeMs: number): void {
    if (!this.cosmetics.collar) return;
    const ctx = this.ctx;
    const b = this.layout.bench;
    const r = this.layout.radius * 0.55;
    const asleep = isLunch(s) || s.phase !== 'shift';
    const t = asleep ? 0 : timeMs / 7000;
    const x = b.x + b.w * (0.55 + 0.38 * Math.sin(t));
    const y = b.y + b.h - r * 1.6;
    const dir = Math.cos(t) >= 0 ? 1 : -1;
    const fur = einkOn ? '#666' : '#e08a2e';
    ctx.fillStyle = fur;
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.3, r * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();
    // tail
    ctx.strokeStyle = fur;
    ctx.lineWidth = r * 0.3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - dir * r * 1.2, y);
    ctx.quadraticCurveTo(x - dir * r * 2.1, y - r * (asleep ? 0.2 : 1.2 + 0.2 * Math.sin(timeMs / 300)), x - dir * r * 1.7, y - r * (asleep ? -0.4 : 1.6));
    ctx.stroke();
    // head and ears
    const hx = x + dir * r * 1.15;
    const hy = y - r * (asleep ? 0.1 : 0.55);
    ctx.beginPath();
    ctx.arc(hx, hy, r * 0.62, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(hx - r * 0.5, hy - r * 0.3);
    ctx.lineTo(hx - r * 0.35, hy - r * 0.95);
    ctx.lineTo(hx - r * 0.05, hy - r * 0.5);
    ctx.moveTo(hx + r * 0.05, hy - r * 0.5);
    ctx.lineTo(hx + r * 0.35, hy - r * 0.95);
    ctx.lineTo(hx + r * 0.5, hy - r * 0.3);
    ctx.fill();
    // collar
    ctx.strokeStyle = einkOn ? '#000' : this.cosmetics.collar;
    ctx.lineWidth = Math.max(1.5, r * 0.18);
    ctx.beginPath();
    ctx.arc(hx, hy, r * 0.62, Math.PI * 0.25, Math.PI * 0.75);
    ctx.stroke();
    if (asleep) {
      ctx.fillStyle = C.muted;
      ctx.font = `${Math.round(r)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('z', hx + dir * r, hy - r * 1.1);
    }
    ctx.lineCap = 'butt';
  }

  /** The supplier's wall calendar in the office. */
  private drawCalendar(s: GameState): void {
    const cal = this.cosmetics.calendar;
    if (!cal) return;
    const ctx = this.ctx;
    const o = this.layout.office;
    const w = Math.min(26, o.w * 0.18);
    const h = w * 1.25;
    const x = o.x + o.w - w - 6;
    const y = o.y + 6;
    ctx.fillStyle = '#fffdf6';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = einkOn ? '#444' : cal.colour;
    ctx.fillRect(x, y, w, h * 0.45);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    ctx.fillStyle = C.ink;
    ctx.font = `bold ${Math.round(w * 0.32)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(String(chapterOf(s).year), x + w / 2, y + h * 0.85);
  }

  private body(x: number, y: number, r: number, coat: string, label: string, hairCap = true): void {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.85, r * 0.9, r * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = coat;
    ctx.beginPath();
    ctx.ellipse(x, y + r * 0.2, r, r * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.skin;
    ctx.beginPath();
    ctx.arc(x, y - r * 0.45, r * 0.52, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.hair;
    ctx.beginPath();
    ctx.arc(x, y - r * 0.55, r * 0.52, Math.PI, Math.PI * 2);
    ctx.fill();
    if (hairCap) {
      ctx.fillStyle = einkOn ? 'rgba(255,255,255,0.85)' : this.cosmetics.cap;
      ctx.fillRect(x - r * 0.5, y - r * 0.95, r, r * 0.16);
    }
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.max(8, Math.round(r * 0.62))}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y + r * 0.42);
    ctx.textBaseline = 'alphabetic';
  }

  private drawWorker(s: GameState, w: Worker, view: ViewState, frac: number, timeMs: number): void {
    const ctx = this.ctx;
    const r = this.layout.radius;
    const p = this.workerPos(s, w, frac);
    if (view.selectedWorker === w.id) {
      ctx.fillStyle = 'rgba(31,122,92,0.25)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 1.6 + Math.sin(timeMs / 200) * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    if (w.station !== null && w.arriveAt <= s.minute) {
      const eff = stationEfficiency(s, s.stations[w.station]!);
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = einkOn ? C.ink : eff >= 0.8 ? '#2e7d32' : eff >= 0.6 ? C.warn : C.danger;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r + 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, eff));
      ctx.stroke();
    }
    this.body(p.x, p.y, r, workerColor(w), w.role === 'qc' ? 'QC' : w.name.slice(0, 2));
    if (w.fatigue > 0.55) {
      ctx.fillStyle = C.muted;
      ctx.font = `bold ${Math.round(r * 0.7)}px system-ui, sans-serif`;
      ctx.fillText('z', p.x + r * 0.9, p.y - r * 0.9 - Math.sin(timeMs / 400) * 2);
    }
    if (w.station === null && w.arriveAt <= s.minute) {
      ctx.fillStyle = C.ink;
      ctx.font = '10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(w.name, p.x, p.y + r + 11);
    }
  }

  private drawAgent(s: GameState, a: Agent, k: number, frac: number, timeMs: number): void {
    if (a.kind === 'mechanic' && workerById(s, a.id)?.absent) return;
    const ctx = this.ctx;
    const r = this.layout.radius * 0.85;
    const p = this.agentPos(s, a, k, frac);
    const jig = a.until > 0 ? Math.sin(timeMs / 60) * 1.5 : 0;
    if (a.kind === 'director') {
      ctx.fillStyle = C.director;
      ctx.beginPath();
      ctx.moveTo(p.x + jig, p.y - r);
      ctx.lineTo(p.x + r + jig, p.y);
      ctx.lineTo(p.x + jig, p.y + r);
      ctx.lineTo(p.x - r + jig, p.y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = `bold ${Math.round(r * 0.7)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('You', p.x + jig, p.y + 1);
      ctx.textBaseline = 'alphabetic';
    } else {
      this.body(p.x + jig, p.y, r, C.mechanic, 'M', false);
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
