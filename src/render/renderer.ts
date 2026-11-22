import { MACHINE_LABEL, PRODUCTS } from '../data/products';
import { activeOrder, has, isLunch, isWorking, opDef, orderById, stationEfficiency, workerById } from '../sim/selectors';
import type { Agent, Bundle, GameState, Station, Worker } from '../sim/types';
import { benchSlot, computeLayout, contains, officeSpot, type Layout, type Rect } from './layout';

/** Canvas renderer. Reads state, never writes it. */

const C = {
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
    this.layout = computeLayout(1, 1, 1);
  }

  resize(n: number): void {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.max(1, Math.round(r.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(r.height * this.dpr));
    this.layout = computeLayout(Math.max(1, r.width), Math.max(1, r.height), n);
  }

  addFlight(s: GameState, from: number, to: number | null, now: number): void {
    const l = this.layout;
    const a = l.stations[from]?.table;
    if (!a) return;
    const dest = to === null ? l.done : l.stations[to]!.pile;
    const p = PRODUCTS[activeOrder(s)?.product ?? 'shorts']!;
    this.flights.push({ from: { x: a.x + a.w / 2, y: a.y + a.h / 2 }, to: { x: dest.x + dest.w / 2, y: dest.y + dest.h / 2 }, t0: now, fabric: p.fabric, tie: p.tie });
    if (this.flights.length > 40) this.flights.shift();
  }

  /** Workers drawn on the floor (mechanics are drawn as agents; absent workers are at home). */
  private floorWorkers(s: GameState): Worker[] {
    return s.workers.filter((w) => w.role !== 'mechanic' && !w.absent);
  }

  hitTest(s: GameState, x: number, y: number, frac: number): Hit {
    const l = this.layout;
    for (const w of this.floorWorkers(s)) {
      const p = this.workerPos(s, w, frac);
      if (Math.hypot(p.x - x, p.y - y) <= l.radius * 1.35) return { kind: 'worker', id: w.id };
    }
    for (let i = 0; i < l.stations.length; i++) if (contains(l.stations[i]!.cell, x, y)) return { kind: 'station', index: i };
    if (contains(l.bench, x, y)) return { kind: 'bench' };
    return null;
  }

  workerPos(s: GameState, w: Worker, frac: number): { x: number; y: number } {
    const list = this.floorWorkers(s);
    const benchers = list.filter((x) => x.station === null);
    const at = (st: number | null) => {
      if (st !== null) return this.layout.stations[st]!.seat;
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
      if (p < 0) return officeSpot(l, k);
      const t = l.stations[p]!.table;
      return l.stations[p]!.horizontal ? { x: t.x + l.radius * 0.6, y: t.y + t.h * 0.2 } : { x: t.x + t.w * 0.2, y: t.y + l.radius * 0.3 };
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

  draw(s: GameState, view: ViewState, frac: number, timeMs: number): void {
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

    const lunch = isLunch(s);
    for (const st of s.stations) this.drawStation(s, st, view, frac, timeMs, lunch);

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

    if (lunch && s.phase === 'shift') {
      ctx.fillStyle = 'rgba(243,234,215,0.55)';
      ctx.fillRect(0, 0, l.width, l.height);
      ctx.fillStyle = C.ink;
      ctx.font = `bold ${Math.round(l.radius * 1.1)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('Lunch · rice from the tin boxes', l.width / 2, l.height / 2);
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
      ctx.fillStyle = n >= 7 ? C.danger : n >= 4 ? '#8a5800' : C.muted;
      ctx.font = `${n >= 4 ? 'bold ' : ''}10px system-ui, sans-serif`;
      ctx.textAlign = 'right';
      ctx.fillText(`${n >= 7 ? '!! ' : ''}${n}`, r.x + r.w, r.y + 9);
    }
  }

  private drawCut(s: GameState): void {
    const r = this.layout.cut;
    this.zone(r, 'Cut fabric');
    const o = activeOrder(s);
    const p = PRODUCTS[o?.product ?? 'shorts']!;
    const inner = { x: r.x + 6, y: r.y + 18, w: r.w - 12, h: r.h - 22 };
    const cut = o?.cut ?? 0;
    const n = !o || !o.sampled ? 0 : Math.min(cut, 3 * Math.max(1, Math.floor((inner.h - 16) / 9)));
    for (let i = 0; i < n; i++) this.bundleRect(inner.x + (i % 3) * (inner.w / 3), inner.y + inner.h - 9 * (Math.floor(i / 3) + 1), inner.w / 3 - 2, 8, p.fabric, p.tie);
    const ctx = this.ctx;
    ctx.fillStyle = C.ink;
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(o ? (o.sampled ? `${cut} bundles` : 'Sample first') : 'No order', r.x + 6, r.y + 28);
  }

  private drawDone(s: GameState): void {
    const r = this.layout.done;
    this.zone(r, 'Packed');
    const ctx = this.ctx;
    const o = activeOrder(s);
    const finished = o?.finished ?? 0;
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
    ctx.fillText(o ? `${finished} / ${o.qty}` : '—', r.x + 6, r.y + 30);
  }

  private drawStation(s: GameState, st: Station, view: ViewState, frac: number, timeMs: number, lunch: boolean): void {
    const ctx = this.ctx;
    const cell = this.layout.stations[st.index]!;
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
    ctx.fillStyle = st.machine === 'qc' ? '#e9e3d0' : C.table;
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
    if (st.machine === 'qc') {
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
      const bob = working ? Math.abs(Math.sin(timeMs / 70 + st.index)) * mh * 0.25 : 0;
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
    let status: string;
    if (st.broken) status = s.agents.some((a) => a.target === st.index) || s.repairQueue.includes(st.index) ? 'Being fixed' : 'Broken: tap';
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
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
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
      ctx.strokeStyle = eff >= 0.8 ? '#2e7d32' : eff >= 0.6 ? C.warn : C.danger;
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

function fit(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
  return `${t}…`;
}
