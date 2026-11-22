import { OP_BY_ID, isLunch, isWorking, stationEfficiency, workerById } from '../sim/selectors';
import type { GameState, Station, Worker } from '../sim/types';
import { benchSlot, computeLayout, contains, officeSpot, type Layout, type Rect } from './layout';

/** Canvas renderer. Reads state, never writes it. */

const C = {
  floor: '#f3ead7',
  wall: '#dfe8d8',
  ink: '#2b2a26',
  muted: '#6f6a5e',
  table: '#c9a571',
  tableEdge: '#9c7a48',
  machine: '#3b4a5a',
  overlock: '#5a4a6a',
  broken: '#c0392b',
  fabric: '#2f4b7c',
  fabricTie: '#e8c547',
  warn: '#d98a00',
  danger: '#c0392b',
  select: '#1f7a5c',
  carton: '#b08850',
  director: '#1f7a5c',
};

export const WORKER_COLORS: Record<string, string> = {
  hoa: '#c2185b',
  thao: '#1565c0',
  huong: '#6a8f00',
  linh: '#e65100',
  ngan: '#7b1fa2',
  trang: '#00838f',
  lan: '#ad1457',
};

export type Hit = { kind: 'worker'; id: string } | { kind: 'station'; index: number } | { kind: 'bench' } | null;

interface Flight {
  from: { x: number; y: number };
  to: { x: number; y: number };
  t0: number;
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

  constructor(private canvas: HTMLCanvasElement, private stationCount: number) {
    this.ctx = canvas.getContext('2d')!;
    this.layout = computeLayout(1, 1, stationCount);
  }

  resize(): void {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(r.width * this.dpr);
    this.canvas.height = Math.round(r.height * this.dpr);
    this.layout = computeLayout(r.width, r.height, this.stationCount);
  }

  /** A finished bundle flies to the next pile (or to the cartons). */
  addFlight(from: number, to: number | null, now: number): void {
    const l = this.layout;
    const a = l.stations[from]!.table;
    const dest = to === null ? l.done : l.stations[to]!.pile;
    this.flights.push({
      from: { x: a.x + a.w / 2, y: a.y + a.h / 2 },
      to: { x: dest.x + dest.w / 2, y: dest.y + dest.h / 2 },
      t0: now,
    });
  }

  hitTest(s: GameState, x: number, y: number, frac: number): Hit {
    const l = this.layout;
    for (const w of s.workers) {
      const p = this.workerPos(s, w, frac);
      if (Math.hypot(p.x - x, p.y - y) <= l.radius * 1.35) return { kind: 'worker', id: w.id };
    }
    for (let i = 0; i < l.stations.length; i++) if (contains(l.stations[i]!.cell, x, y)) return { kind: 'station', index: i };
    if (contains(l.bench, x, y)) return { kind: 'bench' };
    return null;
  }

  workerPos(s: GameState, w: Worker, frac: number): { x: number; y: number } {
    const idx = s.workers.indexOf(w);
    const at = (st: number | null) => (st === null ? benchSlot(this.layout, idx, s.workers.length) : this.layout.stations[st]!.seat);
    const now = s.minute + frac;
    if (w.arriveAt > now && w.arriveAt > w.leftAt) {
      const t = Math.max(0, Math.min(1, (now - w.leftAt) / (w.arriveAt - w.leftAt)));
      const a = at(w.from);
      const b = at(w.station);
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    return at(w.station);
  }

  private directorPos(s: GameState, frac: number): { x: number; y: number } {
    const l = this.layout;
    const d = s.director;
    const spot = (p: number) => {
      if (p < 0) return officeSpot(l);
      const t = l.stations[p]!.table;
      return l.portrait ? { x: t.x - l.radius * 0.2, y: t.y + t.h * 0.15 } : { x: t.x + t.w * 0.15, y: t.y - l.radius * 0.2 };
    };
    if (d.target === null) return spot(d.pos);
    const now = s.minute + frac;
    if (d.fixUntil === 0 && d.arriveAt > now && d.arriveAt > d.leftAt) {
      const t = Math.max(0, Math.min(1, (now - d.leftAt) / (d.arriveAt - d.leftAt)));
      const a = spot(d.pos);
      const b = spot(d.target);
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    return spot(d.target);
  }

  draw(s: GameState, view: ViewState, frac: number, timeMs: number): void {
    const ctx = this.ctx;
    const l = this.layout;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = C.floor;
    ctx.fillRect(0, 0, l.width, l.height);

    this.drawZone(l.office, 'Office');
    this.drawZone(l.bench, 'Bench');
    this.drawCut(s);
    this.drawDone(s);

    const lunch = isLunch(s);
    for (const st of s.stations) this.drawStation(s, st, view, frac, timeMs, lunch);

    // flights
    const dur = 450;
    this.flights = this.flights.filter((f) => timeMs - f.t0 < dur);
    for (const f of this.flights) {
      const t = (timeMs - f.t0) / dur;
      const x = f.from.x + (f.to.x - f.from.x) * t;
      const y = f.from.y + (f.to.y - f.from.y) * t - Math.sin(t * Math.PI) * 14;
      this.bundle(x - 7, y - 4, 14, 8);
    }

    for (const w of s.workers) this.drawWorker(s, w, view, frac, timeMs);
    this.drawDirector(s, frac, timeMs);

    if (lunch) {
      ctx.fillStyle = 'rgba(243,234,215,0.55)';
      ctx.fillRect(0, 0, l.width, l.height);
      ctx.fillStyle = C.ink;
      ctx.font = `bold ${Math.round(l.radius * 1.1)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('Lunch break · 11:30–12:00', l.width / 2, l.height / 2);
    }
  }

  private drawZone(r: Rect, label: string): void {
    const ctx = this.ctx;
    ctx.fillStyle = C.wall;
    roundRect(ctx, r.x, r.y, r.w, r.h, 8);
    ctx.fill();
    ctx.fillStyle = C.muted;
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(label, r.x + 6, r.y + 13);
  }

  private bundle(x: number, y: number, w: number, h: number): void {
    const ctx = this.ctx;
    ctx.fillStyle = C.fabric;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = C.fabricTie;
    ctx.fillRect(x + w * 0.45, y, Math.max(2, w * 0.1), h);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  private drawPile(r: Rect, n: number): void {
    const ctx = this.ctx;
    const bw = Math.max(12, Math.min(22, r.w / 5));
    const bh = Math.max(6, Math.min(10, r.h / 6));
    const cols = Math.max(1, Math.floor(r.w / (bw + 2)));
    const rows = Math.max(1, Math.floor((r.h - 14) / (bh + 1)));
    const shown = Math.min(n, cols * rows);
    for (let i = 0; i < shown; i++) {
      const c = Math.floor(i / rows);
      const k = i % rows;
      this.bundle(r.x + c * (bw + 2), r.y + r.h - (k + 1) * (bh + 1), bw, bh);
    }
    if (n >= 4) {
      const danger = n >= 7;
      ctx.strokeStyle = danger ? C.danger : C.warn;
      ctx.lineWidth = danger ? 3 : 2;
      ctx.setLineDash(danger ? [] : [5, 4]);
      roundRect(ctx, r.x - 3, r.y - 3, r.w + 6, r.h + 6, 6);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (n > 0) {
      ctx.fillStyle = n >= 7 ? C.danger : n >= 4 ? '#8a5800' : C.muted;
      ctx.font = `${n >= 4 ? 'bold ' : ''}11px system-ui, sans-serif`;
      ctx.textAlign = 'right';
      ctx.fillText(`${n >= 7 ? '!! ' : ''}${n} waiting`, r.x + r.w, r.y + 10);
    }
  }

  private drawCut(s: GameState): void {
    const r = this.layout.cut;
    this.drawZone(r, 'Cut fabric');
    const inner = { x: r.x + 6, y: r.y + 18, w: r.w - 12, h: r.h - 22 };
    const n = Math.min(s.cutStack, 3 * Math.max(1, Math.floor((inner.h - 16) / 9)));
    for (let i = 0; i < n; i++) this.bundle(inner.x + (i % 3) * (inner.w / 3), inner.y + inner.h - 9 * (Math.floor(i / 3) + 1), inner.w / 3 - 2, 8);
    const ctx = this.ctx;
    ctx.fillStyle = C.ink;
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${s.cutStack} bundles`, r.x + 6, r.y + 28);
  }

  private drawDone(s: GameState): void {
    const r = this.layout.done;
    this.drawZone(r, 'Packed');
    const ctx = this.ctx;
    const cartons = Math.floor(s.finished / 50);
    const cw = Math.min(26, r.w / 8);
    const portrait = this.layout.portrait;
    const x0 = portrait ? r.x + 80 : r.x + 6;
    const perRow = portrait ? Math.max(1, Math.floor((r.w - 86) / (cw + 3))) : 3;
    const maxShown = portrait ? perRow : perRow * Math.max(1, Math.floor((r.h - 40) / (cw * 0.7 + 3)));
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
    ctx.fillText(`${s.finished} / ${s.tuning.stars[0]}`, r.x + 6, r.y + 30);
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

    this.drawPile(cell.pile, st.pile.length);

    // table and machine
    const t = cell.table;
    ctx.fillStyle = C.table;
    roundRect(ctx, t.x, t.y, t.w, t.h, 5);
    ctx.fill();
    ctx.strokeStyle = C.tableEdge;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    const mw = Math.min(t.w * 0.42, 40);
    const mh = Math.min(t.h * 0.55, 26);
    const mx = this.layout.portrait ? t.x + t.w * 0.08 : t.x + (t.w - mw) / 2;
    const my = this.layout.portrait ? t.y + (t.h - mh) / 2 : t.y + t.h * 0.1;
    ctx.fillStyle = st.broken ? C.broken : st.machine === 'overlock' ? C.overlock : C.machine;
    if (st.machine === 'lockstitch') {
      // arm shape: base + pillar + arm
      ctx.fillRect(mx, my + mh * 0.65, mw, mh * 0.35);
      ctx.fillRect(mx + mw * 0.75, my, mw * 0.25, mh);
      ctx.fillRect(mx + mw * 0.1, my, mw * 0.9, mh * 0.3);
    } else {
      roundRect(ctx, mx, my + mh * 0.15, mw, mh * 0.85, 6);
      ctx.fill();
      ctx.fillStyle = '#d9d2e9';
      ctx.beginPath();
      ctx.arc(mx + mw * 0.7, my + mh * 0.5, mh * 0.18, 0, Math.PI * 2);
      ctx.fill();
    }
    const working = isWorking(s, st);
    // needle bobbing in time with the work
    const nx = mx + mw * 0.2;
    const bob = working ? Math.abs(Math.sin(timeMs / 70 + st.index)) * mh * 0.25 : 0;
    ctx.strokeStyle = '#ddd';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(nx, my + mh * 0.3);
    ctx.lineTo(nx, my + mh * 0.45 + bob);
    ctx.stroke();

    if (st.current) {
      const rate = working ? stationEfficiency(s, st) / OP_BY_ID[st.opId!]!.smv : 0;
      const p = Math.min(1, (st.current.done + rate * frac) / st.current.pieces);
      this.bundle(mx + mw * 0.05, my + mh * 0.48, mw * 0.5, mh * 0.2);
      ctx.fillStyle = 'rgba(0,0,0,0.15)';
      ctx.fillRect(t.x + 4, t.y + t.h - 6, t.w - 8, 3);
      ctx.fillStyle = C.select;
      ctx.fillRect(t.x + 4, t.y + t.h - 6, (t.w - 8) * p, 3);
    }

    if (st.broken) {
      // warning triangle (shape, not only colour)
      const cx = mx + mw / 2;
      const cy = my - 2;
      ctx.fillStyle = C.danger;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 14);
      ctx.lineTo(cx + 9, cy + 2);
      ctx.lineTo(cx - 9, cy + 2);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('!', cx, cy);
      if (s.director.target === st.index && s.director.fixUntil > 0) {
        const p = 1 - (s.director.fixUntil - s.minute - frac) / s.tuning.fixMinutes;
        ctx.strokeStyle = C.director;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy - 5, 13, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, Math.min(1, p)));
        ctx.stroke();
      }
    }

    // label
    const lb = cell.label;
    ctx.textAlign = 'left';
    ctx.fillStyle = C.ink;
    ctx.font = 'bold 12px system-ui, sans-serif';
    const op = st.opId ? OP_BY_ID[st.opId]!.name : 'Spare machine';
    ctx.fillText(op, lb.x, lb.y + 14);
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillStyle = C.muted;
    const w = workerById(s, st.workerId);
    let status: string;
    if (st.broken) status = s.director.target === st.index ? 'Being fixed' : 'Broken: tap to fix';
    else if (st.opId === null) status = 'Tap to set a job';
    else if (!w) status = 'Nobody here';
    else if (w.arriveAt > s.minute) status = `${w.name} is walking`;
    else if (lunch) status = `${w.name} · lunch`;
    else if (!st.current) status = `${w.name} · waiting`;
    else status = `${w.name} · ${Math.round((60 * stationEfficiency(s, st)) / OP_BY_ID[st.opId]!.smv)}/h`;
    ctx.fillStyle = st.broken ? C.danger : C.muted;
    wrapText(ctx, status, lb.x, lb.y + 29, lb.w, 13);
    if (lb.h >= 60) {
      ctx.fillStyle = C.muted;
      ctx.fillText(st.machine === 'overlock' ? 'Overlock' : 'Lockstitch', lb.x, lb.y + lb.h - 4);
    }
  }

  private drawWorker(s: GameState, w: Worker, view: ViewState, frac: number, timeMs: number): void {
    const ctx = this.ctx;
    const r = this.layout.radius;
    const p = this.workerPos(s, w, frac);
    const selected = view.selectedWorker === w.id;
    if (selected) {
      ctx.fillStyle = 'rgba(31,122,92,0.25)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 1.55 + Math.sin(timeMs / 200) * 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = WORKER_COLORS[w.id] ?? '#555';
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    // efficiency ring for seated workers
    if (w.station !== null && w.arriveAt <= s.minute) {
      const st = s.stations[w.station]!;
      const eff = stationEfficiency(s, st);
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
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.round(r * 0.8)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(w.name.slice(0, 2), p.x, p.y + 1);
    ctx.textBaseline = 'alphabetic';
    if (w.station === null && w.arriveAt <= s.minute) {
      ctx.fillStyle = C.ink;
      ctx.font = '10px system-ui, sans-serif';
      ctx.fillText(w.name, p.x, p.y + r + 12);
    }
  }

  private drawDirector(s: GameState, frac: number, timeMs: number): void {
    const ctx = this.ctx;
    const r = this.layout.radius * 0.8;
    const p = this.directorPos(s, frac);
    const fixing = s.director.fixUntil > 0;
    const jig = fixing ? Math.sin(timeMs / 60) * 1.5 : 0;
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

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number): void {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineH;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, yy);
}
