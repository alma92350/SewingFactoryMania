/**
 * The game's artwork (docs/ART.md, "Art Bible"): palette tokens and pure Canvas 2D recipes.
 * Nothing here reads game state; the renderer decides what to draw and passes plain values.
 * Every animated value is a function of `T` (0 in e-ink and under reduced motion = rest pose).
 */

export type Ctx = CanvasRenderingContext2D;

export const PAL = {
  floor: '#efe4cc',
  floorJoint: '#ddd0b2',
  chips: ['#d6c7a6', '#d6c7a6', '#f8f1e0', '#c9b48f', '#bfcab2'],
  tile: '#ebe0c8',
  wall: '#cfe0c6',
  wallTrim: '#8fae86',
  window: '#bcd6e6',
  windowRain: '#9fb2c0',
  tube: '#fdfdf6',
  zoneOffice: '#e8d6b4',
  zoneOfficeLine: '#d6bf95',
  zoneBench: '#dfe8d8',
  zoneCut: '#e3e5dc',
  zonePacked: '#ead9b8',
  zoneEdge: 'rgba(90,70,40,0.18)',
  ink: '#2b2a26',
  muted: '#5f5a4f',
  zoneLabel: '#4a463d',
  table: '#cfa86f',
  tableHi: '#dfbf8c',
  tableEdge: '#8f6c3e',
  tableShadow: 'rgba(70,45,10,0.20)',
  cutTable: '#dcc79c',
  qcTable: '#ece6d3',
  stool: '#8a5f30',
  stoolTop: '#b88a50',
  wood: '#9c6b3c',
  woodTop: '#b07a45',
  woodEdge: '#6e4a28',
  lockstitch: '#2e3438',
  lockDecal: '#c9a24a',
  overlock: '#7fa596',
  overlockCover: '#e9efe9',
  buttonhole: '#cdc5ad',
  buttonholeClamp: '#5b6b78',
  bartack: '#4f6b5a',
  bartackBox: '#2b3a31',
  cutting: '#8d6e63',
  metal: '#b8bec2',
  metalDark: '#7d868c',
  needle: '#e6eaec',
  dustCover: '#d8ccb0',
  dustFold: '#bfae8a',
  broken: '#c0392b',
  warn: '#d98a00',
  warnSign: '#f2c230',
  danger: '#c0392b',
  ok: '#2e7d32',
  select: '#1f7a5c',
  carton: '#c09a62',
  cartonDark: '#8a6a3a',
  cartonTape: '#d9bd85',
  shipMark: '#2b2a26',
  greige: '#d8cfbd',
  skin: '#e2b48a',
  hair: '#2b2320',
  trousers: '#3b3a40',
  director: '#1f7a5c',
  shirt: '#f4f1e8',
  mechanicSuit: '#2f5f9e',
  mechanicStrap: '#5d86c0',
  mechanic: '#d35400',
  electrician: '#6f6a2e',
  helmet: '#f2c230',
  leader: '#6a1b9a',
  clip: '#a5773f',
  clipPaper: '#fffaf0',
  sweat: '#5aa9e6',
  heart: '#e0475b',
  catFur: '#e08a2e',
  catStripe: '#b5651d',
  catBelly: '#f6d7a8',
  phone: '#b23a3a',
  thermos: '#d64541',
  teaGlass: '#c98a2b',
  fax: '#e7e2d3',
  lane: 'rgba(217,179,16,0.55)',
  line: ['#8e2453', '#2f4b7c', '#1f6b6b', '#8a5a00'],
};
export type Palette = typeof PAL;

export const PAL_EINK: Palette = {
  ...PAL,
  floor: '#ffffff',
  floorJoint: '#e6e6e6',
  chips: [],
  tile: '#f2f2f2',
  wall: '#d9d9d9',
  wallTrim: '#000000',
  window: '#ffffff',
  windowRain: '#ffffff',
  tube: '#ffffff',
  zoneOffice: '#f2f2f2',
  zoneOfficeLine: '#d9d9d9',
  zoneBench: '#ececec',
  zoneCut: '#ffffff',
  zonePacked: '#f2f2f2',
  zoneEdge: '#000000',
  ink: '#000000',
  muted: '#333333',
  zoneLabel: '#000000',
  table: '#d9d9d9',
  tableHi: '#ffffff',
  tableEdge: '#000000',
  tableShadow: 'rgba(0,0,0,0.25)',
  cutTable: '#ececec',
  qcTable: '#ffffff',
  stool: '#000000',
  stoolTop: '#bbbbbb',
  wood: '#888888',
  woodTop: '#cccccc',
  woodEdge: '#000000',
  lockstitch: '#222222',
  lockDecal: '#ffffff',
  overlock: '#888888',
  overlockCover: '#ffffff',
  buttonhole: '#dddddd',
  buttonholeClamp: '#444444',
  bartack: '#555555',
  bartackBox: '#000000',
  cutting: '#666666',
  metal: '#bbbbbb',
  metalDark: '#444444',
  needle: '#000000',
  dustCover: '#ffffff',
  dustFold: '#000000',
  broken: '#000000',
  warn: '#555555',
  warnSign: '#ffffff',
  danger: '#000000',
  ok: '#000000',
  select: '#000000',
  carton: '#cccccc',
  cartonDark: '#000000',
  cartonTape: '#ffffff',
  shipMark: '#000000',
  greige: '#eeeeee',
  skin: '#dddddd',
  hair: '#000000',
  trousers: '#000000',
  director: '#000000',
  shirt: '#ffffff',
  mechanicSuit: '#444444',
  mechanicStrap: '#bbbbbb',
  mechanic: '#333333',
  electrician: '#444444',
  helmet: '#ffffff',
  leader: '#222222',
  clip: '#000000',
  clipPaper: '#ffffff',
  sweat: '#ffffff',
  heart: '#000000',
  catFur: '#888888',
  catStripe: '#000000',
  catBelly: '#ffffff',
  phone: '#444444',
  thermos: '#888888',
  teaGlass: '#bbbbbb',
  fax: '#ffffff',
  lane: '#000000',
  line: ['#000000', '#000000', '#000000', '#000000'],
};

// ───────────────────────────── helpers

const shadeMemo = new Map<string, string>();
/** Lighten (amt > 0) or darken (amt < 0) a #rrggbb colour. Memoised: never parses in the loop twice. */
export function shade(hex: string, amt: number): string {
  const key = `${hex}|${amt}`;
  const hit = shadeMemo.get(key);
  if (hit) return hit;
  let out = hex;
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (m) {
    const n = parseInt(m[1]!, 16);
    const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt));
    out = `#${ch.map((c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, '0')).join('')}`;
  }
  shadeMemo.set(key, out);
  return out;
}

const lumMemo = new Map<string, number>();
export function luminance(hex: string): number {
  const hit = lumMemo.get(hex);
  if (hit !== undefined) return hit;
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  let l = 0.2;
  if (m) {
    const n = parseInt(m[1]!, 16);
    const lin = (c: number) => {
      const v = c / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    };
    l = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  }
  lumMemo.set(hex, l);
  return l;
}

export function rrPath(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const k = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}
export function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  rrPath(ctx, x, y, w, h, r);
  ctx.fill();
}
export function circ(ctx: Ctx, x: number, y: number, r: number, fill: string): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.1, r), 0, Math.PI * 2);
  ctx.fill();
}
export function ell(ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: string, rot = 0): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
  ctx.fill();
}
export function seg(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, w: number, col: string): void {
  ctx.strokeStyle = col;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.lineCap = 'butt';
}

/** Small deterministic PRNG for the static floor (it must never shimmer between rebuilds). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

// ───────────────────────────── floor, walls, zones (static layer)

export function terrazzo(ctx: Ctx, w: number, h: number, P: Palette, eink: boolean): void {
  ctx.fillStyle = P.floor;
  ctx.fillRect(0, 0, w, h);
  const TILE = 32;
  if (!eink) {
    const rng = mulberry32(1990);
    for (let ty = 0; ty < h; ty += TILE) {
      for (let tx = 0; tx < w; tx += TILE) {
        if (((tx / TILE + ty / TILE) | 0) % 4 === 0) {
          ctx.fillStyle = 'rgba(255,255,255,0.10)';
          ctx.fillRect(tx, ty, TILE, TILE);
        }
        for (let k = 0; k < 6; k++) {
          const x = tx + rng() * TILE;
          const y = ty + rng() * TILE;
          const s = 0.8 + rng() * 1.4;
          ctx.fillStyle = P.chips[(rng() * P.chips.length) | 0]!;
          if (rng() < 0.5) ctx.fillRect(x, y, s, s);
          else {
            ctx.beginPath();
            ctx.arc(x, y, s * 0.6, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
    }
  }
  ctx.strokeStyle = P.floorJoint;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = TILE; x < w; x += TILE) {
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, h);
  }
  for (let y = TILE; y < h; y += TILE) {
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(w, y + 0.5);
  }
  ctx.stroke();
}

export function wallFrame(ctx: Ctx, w: number, h: number, pad: number, P: Palette, rain: boolean): void {
  ctx.fillStyle = P.wall;
  ctx.fillRect(0, 0, w, pad);
  ctx.fillRect(0, h - pad, w, pad);
  ctx.fillRect(0, 0, pad, h);
  ctx.fillRect(w - pad, 0, pad, h);
  ctx.strokeStyle = P.wallTrim;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(pad - 0.75, pad - 0.75, w - 2 * pad + 1.5, h - 2 * pad + 1.5);
  for (let x = 40; x + 30 < w; x += 140) {
    ctx.fillStyle = rain ? P.windowRain : P.window;
    ctx.fillRect(x, 1.5, 30, 4);
    ctx.strokeStyle = P.wallTrim;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, 1.5, 29, 4);
    if (x + 94 < w) {
      ctx.fillStyle = P.tube;
      ctx.fillRect(x + 70, 2, 24, 3);
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.strokeRect(x + 70.5, 2.5, 23, 2);
    }
  }
}

export function lightPool(ctx: Ctx, r: Box, alpha = 0.3, colour = '255,250,232'): void {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const rx = r.w * 0.55;
  const ry = r.h * 0.55;
  const m = Math.max(rx, ry, 1);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, m);
  if (!g || typeof g.addColorStop !== 'function') return; // headless test canvases
  g.addColorStop(0, `rgba(${colour},${alpha})`);
  g.addColorStop(1, `rgba(${colour},0)`);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(rx / m, ry / m);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, m, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function zoneBase(ctx: Ctx, r: Box, fill: string, P: Palette): void {
  ctx.globalAlpha = 0.5;
  rr(ctx, r.x, r.y + 2, r.w, r.h, 8, P.tableShadow);
  ctx.globalAlpha = 1;
  rr(ctx, r.x, r.y, r.w, r.h, 8, fill);
  ctx.strokeStyle = P.zoneEdge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  rrPath(ctx, r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1, 8);
  ctx.stroke();
}

export function parquet(ctx: Ctx, r: Box, P: Palette): void {
  ctx.save();
  ctx.beginPath();
  rrPath(ctx, r.x, r.y, r.w, r.h, 8);
  ctx.clip();
  ctx.strokeStyle = P.zoneOfficeLine;
  ctx.lineWidth = 1;
  ctx.beginPath();
  let row = 0;
  for (let y = r.y + 8; y < r.y + r.h; y += 8, row++) {
    ctx.moveTo(r.x, y + 0.5);
    ctx.lineTo(r.x + r.w, y + 0.5);
    for (let x = r.x + (row % 2 ? 12 : 0); x < r.x + r.w; x += 24) {
      ctx.moveTo(x + 0.5, y - 8);
      ctx.lineTo(x + 0.5, y);
    }
  }
  ctx.stroke();
  ctx.restore();
}

/** The office desk with a fax, a red telephone, a thermos and two glasses of tea. */
export function officeDesk(ctx: Ctx, o: Box, portrait: boolean, P: Palette): void {
  const landscape = !portrait && o.w >= 110;
  const D = landscape ? { x: o.x + o.w * 0.4, y: o.y + 18, w: o.w * 0.38, h: Math.min(o.h * 0.3, 26) } : { x: o.x + o.w * 0.42, y: o.y + 16, w: o.w * 0.52, h: Math.min(o.h * 0.28, 20) };
  if (D.h < 8 || D.w < 20) return;
  rr(ctx, D.x, D.y + 2, D.w, D.h, 3, P.tableShadow);
  rr(ctx, D.x, D.y, D.w, D.h, 3, P.woodTop);
  ctx.strokeStyle = P.woodEdge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  rrPath(ctx, D.x + 0.5, D.y + 0.5, D.w - 1, D.h - 1, 3);
  ctx.stroke();
  if (landscape) {
    const fw = D.h * 0.9;
    const fh = D.h * 0.6;
    const fx = D.x + 3;
    const fy = D.y + (D.h - fh) / 2;
    rr(ctx, fx, fy, fw, fh, 2, P.fax);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(fx + fw * 0.22, fy - fh * 0.25, fw * 0.56, fh * 0.35);
    ctx.fillStyle = P.ink;
    ctx.fillRect(fx + fw * 0.15, fy + fh * 0.3, fw * 0.7, 1.5);
    ctx.fillStyle = P.metalDark;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) ctx.fillRect(fx + fw * 0.2 + i * fw * 0.15, fy + fh * 0.62 + j * 2.5, 1.2, 1.2);
  }
  const s = D.h * 0.32;
  const px = D.x + D.w * (landscape ? 0.48 : 0.12);
  const py = D.y + D.h * 0.5;
  rr(ctx, px, py - s * 0.7, s * 2, s * 1.4, s * 0.35, P.phone);
  rr(ctx, px - s * 0.15, py - s * 0.95, s * 2.3, s * 0.5, s * 0.25, '#2b2320');
  circ(ctx, px + s, py + s * 0.15, s * 0.35, '#f0e6d2');
  const tx = D.x + D.w - D.h * 0.3;
  const ty = D.y + D.h * 0.5;
  circ(ctx, tx, ty, D.h * 0.24, P.thermos);
  circ(ctx, tx, ty, D.h * 0.13, '#f0e6d2');
  circ(ctx, tx, ty, D.h * 0.05, P.thermos);
  ctx.globalAlpha = 0.85;
  circ(ctx, tx - D.h * 0.45, ty - D.h * 0.15, D.h * 0.1, P.teaGlass);
  circ(ctx, tx - D.h * 0.45, ty + D.h * 0.18, D.h * 0.1, P.teaGlass);
  ctx.globalAlpha = 1;
}

/** Painted safety lanes and the line tint (static). */
export function lineFloor(ctx: Ctx, r: Box, colour: string, P: Palette, eink: boolean): void {
  if (!eink) {
    ctx.globalAlpha = 0.06;
    rr(ctx, r.x + 1, r.y + 1, r.w - 2, r.h - 2, 8, colour);
    ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = P.lane;
  ctx.lineWidth = eink ? 1 : 2;
  ctx.setLineDash(eink ? [4, 4] : [10, 6]);
  ctx.beginPath();
  const horiz = r.w >= r.h;
  if (horiz) {
    ctx.moveTo(r.x + 4, r.y + r.h - 2);
    ctx.lineTo(r.x + r.w - 4, r.y + r.h - 2);
  } else {
    ctx.moveTo(r.x + 2, r.y + 18);
    ctx.lineTo(r.x + 2, r.y + r.h - 4);
    ctx.moveTo(r.x + r.w - 2, r.y + 18);
    ctx.lineTo(r.x + r.w - 2, r.y + r.h - 4);
  }
  ctx.stroke();
  ctx.setLineDash([]);
}

export function machineTable(ctx: Ctx, t: Box, kind: string, P: Palette): void {
  rr(ctx, t.x, t.y + 2, t.w, t.h, 5, P.tableShadow);
  rr(ctx, t.x, t.y, t.w, t.h, 5, kind === 'cutting' ? P.cutTable : kind === 'qc' ? P.qcTable : P.table);
  ctx.strokeStyle = P.tableEdge;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  rrPath(ctx, t.x, t.y, t.w, t.h, 5);
  ctx.stroke();
  ctx.fillStyle = P.tableHi;
  ctx.fillRect(t.x + 4, t.y + 1.5, t.w - 8, 1);
}

export function stool(ctx: Ctx, x: number, y: number, R: number, P: Palette): void {
  circ(ctx, x, y + 0.35 * R, 0.55 * R, P.stool);
  circ(ctx, x, y + 0.3 * R, 0.42 * R, P.stoolTop);
}

// ───────────────────────────── machines

export interface MachineArgs {
  kind: string;
  mx: number;
  my: number;
  mw: number;
  mh: number;
  /** Thread colour (the active product's tie colour). */
  tc: string;
  running: boolean;
  T: number;
  index: number;
  spare: boolean;
}

export function machine(ctx: Ctx, a: MachineArgs, P: Palette, eink: boolean): void {
  const { kind, mx, my, mw, mh, tc, running, T, index } = a;
  const bob = running ? Math.abs(Math.sin(T / 70 + index)) * 0.12 * mh : 0;
  const outline = (col = '#000') => {
    if (!eink) return;
    ctx.strokeStyle = col;
    ctx.lineWidth = 1;
    ctx.stroke();
  };
  if (kind === 'lockstitch') {
    ctx.fillStyle = P.lockstitch;
    ctx.beginPath();
    rrPath(ctx, mx, my + 0.68 * mh, mw, 0.32 * mh, 0.08 * mh);
    rrPath(ctx, mx + 0.74 * mw, my + 0.08 * mh, 0.2 * mw, 0.7 * mh, 0.06 * mh);
    rrPath(ctx, mx + 0.1 * mw, my + 0.08 * mh, 0.84 * mw, 0.24 * mh, 0.12 * mh);
    rrPath(ctx, mx + 0.08 * mw, my + 0.08 * mh, 0.2 * mw, 0.5 * mh, 0.06 * mh);
    ctx.fill();
    outline();
    if (mh >= 14) {
      ctx.fillStyle = P.lockDecal;
      ctx.fillRect(mx + 0.34 * mw, my + 0.17 * mh, 0.32 * mw, Math.max(1, 0.05 * mh));
    }
    ell(ctx, mx + 0.97 * mw, my + 0.3 * mh, 0.07 * mw, 0.2 * mh, P.metal);
    seg(ctx, mx + 0.55 * mw, my + 0.08 * mh, mx + 0.55 * mw, my - 0.06 * mh, 1, P.metalDark);
    rr(ctx, mx + 0.5 * mw, my - 0.18 * mh, 0.1 * mw, 0.14 * mh, 1, tc);
    seg(ctx, mx + 0.18 * mw, my + 0.58 * mh, mx + 0.18 * mw, my + 0.7 * mh + bob, 1.5, P.needle);
    ctx.fillStyle = P.metalDark;
    ctx.fillRect(mx + 0.12 * mw, my + 0.66 * mh + bob * 0.3, 0.12 * mw, 1.5);
  } else if (kind === 'overlock') {
    ctx.fillStyle = P.metalDark;
    ctx.fillRect(mx + 0.12 * mw, my + 0.1 * mh, 0.76 * mw, 1);
    const cr = Math.min(mw, mh) * 0.11;
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = 0; k < 4; k++) {
      ctx.moveTo(mx + (0.2 + 0.2 * k) * mw, my + 0.1 * mh);
      ctx.lineTo(mx + 0.3 * mw, my + 0.32 * mh);
    }
    ctx.stroke();
    for (let k = 0; k < 4; k++) circ(ctx, mx + (0.2 + 0.2 * k) * mw, my + 0.1 * mh, cr, k % 2 ? '#f3ead7' : tc);
    ctx.fillStyle = P.overlock;
    ctx.beginPath();
    rrPath(ctx, mx + 0.05 * mw, my + 0.3 * mh, 0.9 * mw, 0.7 * mh, 0.3 * mh);
    ctx.fill();
    outline();
    rr(ctx, mx + 0.12 * mw, my + 0.5 * mh, 0.36 * mw, 0.4 * mh, 0.1 * mh, P.overlockCover);
    circ(ctx, mx + 0.82 * mw, my + 0.6 * mh, 0.14 * mh, P.metalDark);
    seg(ctx, mx + 0.3 * mw, my + 0.36 * mh, mx + 0.3 * mw, my + 0.48 * mh + bob, 1.5, P.needle);
  } else if (kind === 'buttonhole') {
    ctx.fillStyle = P.buttonhole;
    ctx.beginPath();
    rrPath(ctx, mx, my + 0.1 * mh, 0.86 * mw, 0.48 * mh, 0.06 * mh);
    rrPath(ctx, mx + 0.66 * mw, my + 0.1 * mh, 0.2 * mw, 0.76 * mh, 0.05 * mh);
    ctx.fill();
    ctx.strokeStyle = eink ? '#000' : '#8f8670';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#8f8670';
    ctx.fillRect(mx + 0.06 * mw, my + 0.22 * mh, 0.5 * mw, 1);
    rr(ctx, mx + 0.1 * mw, my - 0.06 * mh, 0.1 * mw, 0.14 * mh, 1, tc);
    const slide = running ? Math.sin(T / 260 + index) * 0.04 * mw : 0;
    rr(ctx, mx + 0.04 * mw + slide, my + 0.66 * mh, 0.56 * mw, 0.24 * mh, 0.05 * mh, P.buttonholeClamp);
    ctx.fillStyle = P.needle;
    ctx.fillRect(mx + 0.12 * mw + slide, my + 0.75 * mh, 0.4 * mw, 0.06 * mh);
    seg(ctx, mx + 0.3 * mw, my + 0.58 * mh, mx + 0.3 * mw, my + 0.66 * mh + bob * 0.6, 1.5, P.needle);
  } else if (kind === 'bartack') {
    ctx.fillStyle = P.bartack;
    ctx.beginPath();
    rrPath(ctx, mx, my + 0.64 * mh, mw, 0.36 * mh, 0.08 * mh);
    rrPath(ctx, mx + 0.7 * mw, my + 0.06 * mh, 0.26 * mw, 0.7 * mh, 0.06 * mh);
    rrPath(ctx, mx + 0.06 * mw, my + 0.06 * mh, 0.9 * mw, 0.34 * mh, 0.14 * mh);
    rrPath(ctx, mx + 0.04 * mw, my + 0.06 * mh, 0.28 * mw, 0.52 * mh, 0.06 * mh);
    ctx.fill();
    outline();
    rr(ctx, mx + 0.66 * mw, my - 0.16 * mh, 0.32 * mw, 0.22 * mh, 1.5, P.bartackBox);
    circ(ctx, mx + 0.92 * mw, my - 0.05 * mh, Math.max(1, 0.05 * mh), running && !eink ? '#e74c3c' : '#5a2a2a');
    rr(ctx, mx + 0.06 * mw, my + 0.6 * mh, 0.28 * mw, 0.14 * mh, 1, P.metalDark);
    seg(ctx, mx + 0.18 * mw, my + 0.58 * mh, mx + 0.18 * mw, my + 0.66 * mh + bob * 0.5, 1.5, P.needle);
  }
  if (a.spare) dustCover(ctx, mx, my, mw, mh, P);
}

export function dustCover(ctx: Ctx, mx: number, my: number, mw: number, mh: number, P: Palette): void {
  rr(ctx, mx - 1, my - 0.2 * mh, mw + 2, 1.2 * mh, 0.3 * mh, P.dustCover);
  ctx.strokeStyle = P.dustFold;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(mx + 0.3 * mw, my);
  ctx.quadraticCurveTo(mx + 0.35 * mw, my + 0.5 * mh, mx + 0.25 * mw, my + mh);
  ctx.moveTo(mx + 0.7 * mw, my);
  ctx.quadraticCurveTo(mx + 0.75 * mw, my + 0.5 * mh, mx + 0.65 * mw, my + mh);
  ctx.stroke();
}

export function brokenFx(ctx: Ctx, mx: number, my: number, mw: number, mh: number, T: number, index: number, eink: boolean): void {
  if (eink) {
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(mx + mw, my + mh);
    ctx.moveTo(mx + mw, my);
    ctx.lineTo(mx, my + mh);
    ctx.stroke();
    return;
  }
  rr(ctx, mx - 1, my - 1, mw + 2, mh + 2, 3, 'rgba(192,57,43,0.22)');
  for (let k = 0; k < 2; k++) {
    const ph = (T / 900 + index * 0.37 + k * 0.5) % 1;
    circ(ctx, mx + 0.2 * mw + k * 0.15 * mw, my - ph * 0.9 * mh, 0.12 * mh + ph * 0.18 * mh, `rgba(140,140,140,${(0.35 * (1 - ph)).toFixed(3)})`);
  }
  if (T > 0 && (((T / 150) | 0) + index) % 6 === 0) {
    const sx = mx + 0.2 * mw;
    const sy = my + 0.62 * mh;
    const L = 0.12 * mh + 2;
    ctx.strokeStyle = '#f2c230';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let k = 0; k < 4; k++) {
      const an = (k * Math.PI) / 2 + Math.PI / 4;
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.cos(an) * L, sy + Math.sin(an) * L);
    }
    ctx.stroke();
  }
}

export function hazardBadge(ctx: Ctx, cx: number, cy: number, P: Palette, eink: boolean): void {
  ctx.fillStyle = eink ? '#000' : P.warnSign;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 13);
  ctx.lineTo(cx + 8, cy + 2);
  ctx.lineTo(cx - 8, cy + 2);
  ctx.closePath();
  ctx.fill();
  if (!eink) {
    ctx.strokeStyle = P.broken;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.lineJoin = 'miter';
  }
  ctx.fillStyle = eink ? '#fff' : P.ink;
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('!', cx, cy);
}

export function wrenchBadge(ctx: Ctx, cx: number, cy: number, P: Palette, eink: boolean): void {
  circ(ctx, cx, cy - 5, 8, eink ? '#000' : P.mechanic);
  seg(ctx, cx - 3.5, cy - 1.5, cx + 2.5, cy - 7.5, 2.2, '#ffffff');
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx + 3.2, cy - 8.2, 2.6, 0.75 * Math.PI, 1.75 * Math.PI);
  ctx.stroke();
}

/** Cutting table contents: the fabric lay with chalked pattern pieces, the roll, the straight knife. */
export function cuttingTable(ctx: Ctx, t: Box, fabric: string, hasLay: boolean, running: boolean, T: number, index: number, P: Palette, eink: boolean): void {
  const lay = { x: t.x + 3, y: t.y + 3, w: t.w * 0.78, h: Math.max(4, t.h - 10) };
  if (hasLay) {
    ctx.fillStyle = eink ? '#bbb' : shade(fabric, -0.18);
    ctx.fillRect(lay.x, lay.y + 1, lay.w, lay.h);
    ctx.fillStyle = eink ? '#fff' : fabric;
    ctx.fillRect(lay.x, lay.y, lay.w, lay.h);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillRect(lay.x + 2, lay.y + 2, lay.w - 4, lay.h - 4);
    if (lay.h >= 12) {
      const u = lay.w;
      const v = lay.h;
      ctx.strokeStyle = '#8a8578';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(lay.x + 0.08 * u, lay.y + 0.2 * v);
      ctx.lineTo(lay.x + 0.4 * u, lay.y + 0.15 * v);
      ctx.lineTo(lay.x + 0.44 * u, lay.y + 0.8 * v);
      ctx.lineTo(lay.x + 0.1 * u, lay.y + 0.85 * v);
      ctx.closePath();
      ctx.moveTo(lay.x + 0.52 * u, lay.y + 0.15 * v);
      ctx.lineTo(lay.x + 0.86 * u, lay.y + 0.2 * v);
      ctx.quadraticCurveTo(lay.x + 0.92 * u, lay.y + 0.5 * v, lay.x + 0.86 * u, lay.y + 0.82 * v);
      ctx.lineTo(lay.x + 0.54 * u, lay.y + 0.85 * v);
      ctx.closePath();
      ctx.stroke();
    }
  }
  const rw = t.w * 0.14;
  rr(ctx, t.x + t.w * 0.82, t.y + 4, rw, Math.max(4, t.h - 12), rw / 2, eink ? '#ddd' : fabric);
  const kh = Math.min(t.h * 0.5, 14);
  const kx = lay.x + lay.w * (running ? 0.2 + 0.6 * (0.5 + 0.5 * Math.sin(T / 700 + index)) : 0.7);
  const ky = t.y + t.h * 0.45;
  rr(ctx, kx - kh * 0.35, ky - kh * 0.15, kh * 0.7, kh * 0.5, 2, P.metalDark);
  seg(ctx, kx, ky - kh * 0.55, kx, ky + kh * 0.25, 1.5, eink ? '#000' : P.needle);
  rr(ctx, kx - kh * 0.12, ky - kh * 0.75, kh * 0.24, kh * 0.25, 1, eink ? '#000' : '#c0392b');
}

/** QC table: an angle lamp, a magnifier and folded garments. */
export function qcTable(ctx: Ctx, t: Box, fabric: string | null, P: Palette, eink: boolean): void {
  const L = Math.min(t.h * 0.2, 7);
  ctx.strokeStyle = P.metalDark;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(t.x + t.w - 3, t.y + 3);
  ctx.lineTo(t.x + t.w * 0.86, t.y + t.h * 0.22);
  ctx.lineTo(t.x + t.w * 0.74, t.y + t.h * 0.35);
  ctx.stroke();
  circ(ctx, t.x + t.w * 0.74, t.y + t.h * 0.35, L, '#f4e9c8');
  circ(ctx, t.x + t.w * 0.74, t.y + t.h * 0.35, L * 0.45, '#fffbe8');
  const M = Math.min(t.h * 0.18, 6);
  const cx = t.x + t.w * 0.38;
  const cy = t.y + t.h * 0.45;
  circ(ctx, cx, cy, M, 'rgba(170,210,230,0.45)');
  ctx.strokeStyle = eink ? '#000' : '#6b5a3e';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, M, 0, Math.PI * 2);
  ctx.stroke();
  seg(ctx, cx + M * 0.7, cy + M * 0.7, cx + M * 1.8, cy + M * 1.8, 2, eink ? '#000' : '#6b5a3e');
  if (fabric) {
    const gw = t.w * 0.18;
    const gh = t.h * 0.18;
    for (let k = 0; k < 2; k++) {
      ctx.fillStyle = eink ? '#fff' : fabric;
      ctx.fillRect(t.x + 5 + k * 2, t.y + t.h * 0.55 + k * 2, gw, gh);
      ctx.strokeStyle = eink ? '#000' : shade(fabric, -0.2);
      ctx.lineWidth = 1;
      ctx.strokeRect(t.x + 5.5 + k * 2, t.y + t.h * 0.55 + k * 2 + 0.5, gw - 1, gh - 1);
    }
  }
}

// ───────────────────────────── bundles, cartons, rolls

export function bundle(ctx: Ctx, x: number, y: number, w: number, h: number, fabric: string, tie: string, eink: boolean): void {
  if (eink) {
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
    ctx.fillStyle = '#000';
    ctx.fillRect(x + w * 0.45, y, Math.max(2, w * 0.1), h);
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    return;
  }
  rr(ctx, x, y, w, h, 1.5, fabric);
  ctx.fillStyle = shade(fabric, -0.18);
  ctx.fillRect(x, y + h * 0.72, w, h * 0.28);
  ctx.fillStyle = tie;
  ctx.fillRect(x + w * 0.45, y, Math.max(2, w * 0.1), h);
  if (w >= 12) circ(ctx, x + w * 0.5, y + h * 0.5, Math.max(1, h * 0.16), shade(tie, -0.2));
  if (w >= 14) {
    ctx.fillStyle = '#fffaf0';
    ctx.fillRect(x + w * 0.78, y + 1, w * 0.14, h * 0.4);
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.30)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  rrPath(ctx, x + 0.5, y + 0.5, w - 1, h - 1, 1.5);
  ctx.stroke();
}

export function carton(ctx: Ctx, x: number, y: number, w: number, h: number, P: Palette, eink: boolean): void {
  ctx.fillStyle = P.tableShadow;
  ctx.fillRect(x + 1, y + 2, w, h);
  ctx.fillStyle = eink ? '#fff' : P.carton;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = P.cartonDark;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.fillStyle = P.cartonTape;
  ctx.fillRect(x + w * 0.44, y, w * 0.12, h);
  if (eink) ctx.strokeRect(x + w * 0.44 + 0.5, y + 0.5, w * 0.12 - 1, h - 1);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(x, y + h * 0.5, w, 1);
  if (w >= 16) {
    const cx = x + w * 0.22;
    const cy = y + h * 0.66;
    const dx = w * 0.1;
    const dy = h * 0.12;
    ctx.strokeStyle = P.shipMark;
    ctx.beginPath();
    ctx.moveTo(cx, cy - dy);
    ctx.lineTo(cx + dx, cy);
    ctx.lineTo(cx, cy + dy);
    ctx.lineTo(cx - dx, cy);
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = P.shipMark;
    ctx.fillRect(x + w * 0.1, y + h * 0.86, w * 0.24, 1);
  }
}

export function rollLying(ctx: Ctx, x: number, y: number, w: number, h: number, colour: string, eink: boolean): void {
  rr(ctx, x, y, w, h, h / 2, eink ? '#fff' : colour);
  if (eink) {
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.beginPath();
    rrPath(ctx, x + 0.5, y + 0.5, w - 1, h - 1, h / 2);
    ctx.stroke();
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(x + h / 2, y + h * 0.15, w - h, 1);
    ell(ctx, x + w - h / 2, y + h / 2, h * 0.28, h / 2, shade(colour, -0.15));
  }
  circ(ctx, x + w - h / 2, y + h / 2, h * 0.12, eink ? '#000' : '#fffaf0');
}

export function rollEnd(ctx: Ctx, cx: number, cy: number, colour: string, eink: boolean): void {
  circ(ctx, cx, cy, 5, eink ? '#fff' : colour);
  ctx.strokeStyle = eink ? '#000' : shade(colour, -0.2);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.stroke();
  circ(ctx, cx, cy, 1.6, eink ? '#000' : '#fffaf0');
}

// ───────────────────────────── people

export type Facing = 'up' | 'left' | 'down' | 'right';
export interface BodyOpts {
  coat: string;
  label: string;
  facing: Facing;
  pose: 'seated' | 'walk' | 'stand';
  cap?: string | null;
  hat?: 'helmet' | null;
  prop?: 'toolbox' | 'clipboard' | 'magnifier' | 'cable' | null;
  labelInk?: string;
  outline?: boolean;
  straps?: boolean;
  /** Draw the ground diamond instead of the shadow (the director). */
  diamond?: string;
  /** Phase offset for the walk cycle. */
  phase?: number;
}

export function body(ctx: Ctx, x: number, y: number, r: number, o: BodyOpts, T: number, P: Palette, eink: boolean): void {
  const detail = r >= 11;
  const f = o.pose === 'walk' ? (((T + (o.phase ?? 0)) / 180) | 0) & 1 : 0;
  // 1 shadow / diamond
  if (o.diamond) {
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = o.diamond;
    ctx.beginPath();
    ctx.moveTo(x, y + 0.4 * r);
    ctx.lineTo(x + 1.05 * r, y + 0.8 * r);
    ctx.lineTo(x, y + 1.2 * r);
    ctx.lineTo(x - 1.05 * r, y + 0.8 * r);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  } else ell(ctx, x, y + 0.8 * r, 0.9 * r, 0.3 * r, 'rgba(40,30,10,0.16)');
  // 2 legs
  if (o.pose === 'walk') {
    const s = f ? 0.15 * r : -0.15 * r;
    ell(ctx, x - 0.3 * r, y + 0.82 * r + s, 0.18 * r, 0.24 * r, P.trousers);
    ell(ctx, x + 0.3 * r, y + 0.82 * r - s, 0.18 * r, 0.24 * r, P.trousers);
  }
  const by = o.pose === 'walk' && f ? -0.06 * r : 0;
  const coatDark = eink ? '#000' : shade(o.coat, -0.18);
  // 3 arms
  const arms: [number, number, number, number][] = [];
  if (o.pose === 'seated' && o.facing === 'up') {
    arms.push([x - 0.72 * r, y - 0.05 * r, x - 0.6 * r, y - 0.8 * r], [x + 0.72 * r, y - 0.05 * r, x + 0.6 * r, y - 0.8 * r]);
  } else if (o.pose === 'seated' && (o.facing === 'left' || o.facing === 'right')) {
    const d = o.facing === 'left' ? -1 : 1;
    arms.push([x + d * 0.4 * r, y - 0.05 * r, x + d * 1.05 * r, y - 0.15 * r], [x - d * 0.3 * r, y + 0.12 * r, x + d * 1.0 * r, y + 0.22 * r]);
  } else if (o.pose === 'walk') {
    const sw = f ? 0.18 * r : -0.18 * r;
    arms.push([x - 0.82 * r, y + by, x - 0.86 * r, y + 0.45 * r - sw + by], [x + 0.82 * r, y + by, x + 0.86 * r, y + 0.45 * r + sw + by]);
  } else {
    arms.push([x - 0.8 * r, y, x - 0.74 * r, y + 0.5 * r], [x + 0.8 * r, y, x + 0.74 * r, y + 0.5 * r]);
  }
  ctx.strokeStyle = coatDark;
  ctx.lineWidth = 0.34 * r;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (const [x1, y1, x2, y2] of arms) {
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
  }
  ctx.stroke();
  ctx.lineCap = 'butt';
  if (detail) for (const a of arms) circ(ctx, a[2], a[3], 0.16 * r, P.skin);
  // 4 torso
  ell(ctx, x, y + 0.22 * r + by, 0.92 * r, 0.66 * r, eink ? '#4d4d4d' : o.coat);
  if (o.outline || eink) {
    ctx.strokeStyle = eink ? '#000' : 'rgba(43,42,38,0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(x, y + 0.22 * r + by, 0.92 * r, 0.66 * r, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (o.straps) {
    ctx.fillStyle = P.mechanicStrap;
    ctx.fillRect(x - 0.41 * r, y - 0.3 * r + by, 0.12 * r, 0.7 * r);
    ctx.fillRect(x + 0.29 * r, y - 0.3 * r + by, 0.12 * r, 0.7 * r);
  }
  if (detail && !eink) ell(ctx, x, y + 0.02 * r + by, 0.62 * r, 0.22 * r, 'rgba(255,255,255,0.14)');
  // 5 head
  const hx = x;
  const hy = y - 0.48 * r + by;
  const hr = 0.48 * r;
  if (o.facing === 'up') {
    circ(ctx, hx, hy, hr, P.hair);
    if (detail && !o.cap && !o.hat) circ(ctx, hx, y - 0.1 * r + by, 0.15 * r, P.hair);
  } else {
    circ(ctx, hx, hy, hr, P.skin);
    ctx.fillStyle = P.hair;
    ctx.beginPath();
    if (o.facing === 'down') ctx.arc(hx, hy - 0.08 * r, hr, Math.PI, Math.PI * 2);
    else {
      const d = o.facing === 'left' ? 1 : -1; // the back of the head shows hair
      ctx.arc(hx, hy, hr, -Math.PI / 2, Math.PI / 2, d < 0);
    }
    ctx.fill();
    if (o.facing !== 'down') {
      ctx.beginPath();
      ctx.arc(hx, hy - 0.06 * r, hr, Math.PI, Math.PI * 2);
      ctx.fill();
    }
    if (r >= 10) {
      if (o.facing === 'down') {
        circ(ctx, hx - 0.16 * r, hy + 0.06 * r, 0.06 * r, P.ink);
        circ(ctx, hx + 0.16 * r, hy + 0.06 * r, 0.06 * r, P.ink);
      } else circ(ctx, hx + (o.facing === 'left' ? -0.22 : 0.22) * r, hy + 0.04 * r, 0.06 * r, P.ink);
    }
  }
  // 6 cap / helmet
  if (o.hat === 'helmet') {
    ell(ctx, hx, hy - 0.16 * r, 0.52 * r, 0.34 * r, P.helmet);
    ctx.fillStyle = eink ? '#000' : shade(P.helmet, -0.2);
    ctx.fillRect(hx - 0.56 * r, hy + 0.02 * r, 1.12 * r, 0.08 * r);
  } else if (o.cap) {
    ell(ctx, hx, hy - 0.22 * r, 0.44 * r, 0.26 * r, o.cap);
    ctx.fillStyle = eink || !o.cap.startsWith('#') ? 'rgba(0,0,0,0.15)' : shade(o.cap, -0.15);
    ctx.fillRect(hx - 0.44 * r, hy - 0.1 * r, 0.88 * r, Math.max(1, 0.08 * r));
  }
  // 7 prop
  if (o.prop === 'toolbox') {
    rr(ctx, x + 0.7 * r, y + 0.2 * r, 0.7 * r, 0.45 * r, 0.08 * r, eink ? '#000' : P.mechanic);
    ctx.fillStyle = P.ink;
    ctx.fillRect(x + 0.85 * r, y + 0.16 * r, 0.4 * r, 1);
  } else if (o.prop === 'clipboard') {
    rr(ctx, x + 0.3 * r, y - 0.05 * r, 0.58 * r, 0.72 * r, 0.06 * r, P.clip);
    ctx.fillStyle = P.clipPaper;
    ctx.fillRect(x + 0.36 * r, y + 0.01 * r, 0.46 * r, 0.6 * r);
    ctx.fillStyle = P.metalDark;
    ctx.fillRect(x + 0.48 * r, y - 0.09 * r, 0.22 * r, 0.1 * r);
  } else if (o.prop === 'magnifier') {
    circ(ctx, x + 0.75 * r, y + 0.1 * r, 0.22 * r, 'rgba(170,210,230,0.5)');
    ctx.strokeStyle = eink ? '#000' : '#6b5a3e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(x + 0.75 * r, y + 0.1 * r, 0.22 * r, 0, Math.PI * 2);
    ctx.stroke();
  } else if (o.prop === 'cable') {
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 0.12 * r;
    ctx.beginPath();
    ctx.arc(x - 0.75 * r, y + 0.25 * r, 0.28 * r, 0, Math.PI * 2);
    ctx.stroke();
  }
  // 8 label
  ctx.fillStyle = o.labelInk ?? (eink ? '#fff' : luminance(o.coat) > 0.55 ? P.ink : '#ffffff');
  ctx.font = `bold ${Math.max(8, Math.round(r * 0.62))}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(o.label, x, y + 0.42 * r + by);
  ctx.textBaseline = 'alphabetic';
}

/** Mood cues: sweat when hot, a heart when happy (one per person). */
export function sweat(ctx: Ctx, x: number, y: number, r: number, T: number, phase: number, P: Palette): void {
  if (r < 9) return;
  const d = 0.24 * r;
  const cx = x + 0.66 * r;
  const cy = y - 0.92 * r + (T > 0 ? ((T / 600 + phase) % 1) * 0.25 * r : 0);
  ctx.fillStyle = P.sweat;
  ctx.beginPath();
  ctx.moveTo(cx, cy - d);
  ctx.quadraticCurveTo(cx + 0.9 * d, cy + 0.4 * d, cx, cy + 0.8 * d);
  ctx.quadraticCurveTo(cx - 0.9 * d, cy + 0.4 * d, cx, cy - d);
  ctx.fill();
  ctx.strokeStyle = P === PAL_EINK ? '#000' : '#ffffff';
  ctx.lineWidth = 1;
  ctx.stroke();
}

export function heart(ctx: Ctx, x: number, y: number, r: number, P: Palette): void {
  const hx = x - 0.66 * r;
  const cy = y - 0.92 * r;
  const h = 0.2 * r;
  ctx.fillStyle = P.heart;
  ctx.beginPath();
  ctx.moveTo(hx, cy + 0.9 * h);
  ctx.bezierCurveTo(hx - 1.6 * h, cy - 0.2 * h, hx - 0.6 * h, cy - 1.3 * h, hx, cy - 0.4 * h);
  ctx.bezierCurveTo(hx + 0.6 * h, cy - 1.3 * h, hx + 1.6 * h, cy - 0.2 * h, hx, cy + 0.9 * h);
  ctx.fill();
}

// ───────────────────────────── life: fans, lunch tins, cat, calendar, bench

export function fanShadow(ctx: Ctx, cx: number, cy: number, Rf: number, T: number): void {
  const a = (T * 0.0025) % (Math.PI * 2);
  ctx.fillStyle = 'rgba(30,30,20,0.06)';
  ctx.beginPath();
  for (let k = 0; k < 3; k++) {
    const an = a + (k * 2 * Math.PI) / 3;
    ctx.moveTo(cx + Math.cos(an) * Rf * 0.5 + Rf * 0.5, cy + Math.sin(an) * Rf * 0.5);
    ctx.ellipse(cx + Math.cos(an) * Rf * 0.5, cy + Math.sin(an) * Rf * 0.5, Rf * 0.5, Rf * 0.11, an, 0, Math.PI * 2);
  }
  ctx.moveTo(cx + Rf * 0.1, cy);
  ctx.arc(cx, cy, Rf * 0.1, 0, Math.PI * 2);
  ctx.fill('nonzero');
}

export function tiffin(ctx: Ctx, x: number, y: number, R: number, P: Palette): void {
  circ(ctx, x, y, 0.38 * R, P.metal);
  ctx.strokeStyle = P.metalDark;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, 0.38 * R, 0, Math.PI * 2);
  ctx.moveTo(x - 0.3 * R, y);
  ctx.lineTo(x + 0.3 * R, y);
  ctx.stroke();
  circ(ctx, x, y, 0.22 * R, shade(P.metal, 0.1));
}

export function benchPlank(ctx: Ctx, x: number, y: number, w: number, R: number, P: Palette): void {
  const h = 0.55 * R;
  rr(ctx, x, y + 2, w, h, 3, P.tableShadow);
  rr(ctx, x, y, w, h, 3, P.wood);
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = P.woodEdge;
  ctx.fillRect(x + 2, y + 0.27 * R, w - 4, 1);
  ctx.globalAlpha = 1;
  ctx.fillStyle = P.woodEdge;
  ctx.fillRect(x + 3, y + h, 3, 2);
  ctx.fillRect(x + w - 6, y + h, 3, 2);
}

export function cat(ctx: Ctx, x: number, y: number, c: number, dir: number, asleep: boolean, collar: string, T: number, P: Palette, eink: boolean): void {
  if (asleep) {
    ell(ctx, x, y + 0.55 * c, 1.1 * c, 0.3 * c, 'rgba(40,30,10,0.14)');
    circ(ctx, x, y, c, P.catFur);
    ctx.strokeStyle = P.catStripe;
    ctx.lineWidth = 0.24 * c;
    ctx.beginPath();
    ctx.arc(x, y, 0.82 * c, 0.15 * Math.PI, 1.05 * Math.PI);
    ctx.stroke();
    const hx = x + dir * 0.55 * c;
    const hy = y - 0.2 * c;
    circ(ctx, hx, hy, 0.5 * c, P.catFur);
    earPair(ctx, hx, hy, c * 0.8, P.catFur);
    ctx.strokeStyle = P.ink;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(hx + dir * 0.15 * c, hy, 0.12 * c, 0, Math.PI);
    ctx.stroke();
    ctx.fillStyle = P.muted;
    ctx.font = `${Math.round(c)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('z', hx + dir * c, hy - c * 1.1);
    return;
  }
  ell(ctx, x, y + 0.75 * c, 1.2 * c, 0.28 * c, 'rgba(40,30,10,0.14)');
  const f = ((T / 220) | 0) & 1;
  ctx.fillStyle = P.catFur;
  for (const [lx, ly, lift] of [
    [0.75, 0, f],
    [0.35, 0, 1 - f],
    [-0.35, 0, f],
    [-0.75, 0, 1 - f],
  ] as [number, number, number][]) {
    ctx.fillRect(x + dir * lx * c - 0.11 * c, y + 0.45 * c - lift * 0.12 * c + ly, 0.22 * c, 0.45 * c);
  }
  ell(ctx, x, y, 1.3 * c, 0.7 * c, P.catFur);
  ctx.strokeStyle = P.catStripe;
  ctx.lineWidth = 0.18 * c;
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let k = 0; k < 3; k++) {
    ctx.moveTo(x + dir * (-0.6 + 0.5 * k) * c, y - 0.66 * c);
    ctx.lineTo(x + dir * (-0.72 + 0.5 * k) * c, y - 0.2 * c);
  }
  ctx.stroke();
  // tail
  ctx.strokeStyle = P.catFur;
  ctx.lineWidth = 0.3 * c;
  ctx.beginPath();
  const tipX = x - dir * c * 1.7;
  const tipY = y - c * 1.6;
  ctx.moveTo(x - dir * c * 1.2, y);
  ctx.quadraticCurveTo(x - dir * c * 2.1, y - c * (1.2 + 0.2 * Math.sin(T / 300)), tipX, tipY);
  ctx.stroke();
  ctx.lineCap = 'butt';
  circ(ctx, tipX, tipY, 0.16 * c, P.catStripe);
  // head
  const hx = x + dir * c * 1.15;
  const hy = y - c * 0.55;
  circ(ctx, hx, hy, c * 0.62, P.catFur);
  earPair(ctx, hx, hy, c, P.catFur);
  ell(ctx, hx + dir * 0.25 * c, hy + 0.18 * c, 0.25 * c, 0.18 * c, P.catBelly);
  circ(ctx, hx + dir * 0.38 * c, hy + 0.12 * c, 0.07 * c, eink ? '#000' : '#c46a6a');
  circ(ctx, hx + dir * 0.18 * c, hy - 0.08 * c, 0.07 * c, P.ink);
  ctx.strokeStyle = eink ? '#000' : collar;
  ctx.lineWidth = Math.max(1.5, c * 0.18);
  ctx.beginPath();
  ctx.arc(hx, hy, c * 0.62, Math.PI * 0.25, Math.PI * 0.75);
  ctx.stroke();
  circ(ctx, hx, hy + 0.62 * c, 0.12 * c, eink ? '#fff' : '#e8c547');
}

function earPair(ctx: Ctx, hx: number, hy: number, r: number, fill: string): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(hx - r * 0.5, hy - r * 0.3);
  ctx.lineTo(hx - r * 0.35, hy - r * 0.95);
  ctx.lineTo(hx - r * 0.05, hy - r * 0.5);
  ctx.moveTo(hx + r * 0.05, hy - r * 0.5);
  ctx.lineTo(hx + r * 0.35, hy - r * 0.95);
  ctx.lineTo(hx + r * 0.5, hy - r * 0.3);
  ctx.fill();
}

export function calendar(ctx: Ctx, x: number, y: number, w: number, colour: string, year: number, P: Palette, eink: boolean): void {
  const h = w * 1.25;
  ctx.strokeStyle = P.muted;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.2, y);
  ctx.lineTo(x + w / 2, y - 3);
  ctx.lineTo(x + w * 0.8, y);
  ctx.stroke();
  circ(ctx, x + w / 2, y - 3, 1.2, P.ink);
  ctx.fillStyle = P.tableShadow;
  ctx.fillRect(x + 1, y + 2, w, h);
  ctx.fillStyle = '#fffdf6';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = eink ? '#444' : colour;
  ctx.fillRect(x, y, w, h * 0.42);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x + w * 0.18, y + h * 0.12, w * 0.64, Math.max(1, h * 0.05));
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillRect(x + w * 0.3, y + h * 0.24, w * 0.4, 1);
  for (const k of [0.25, 0.5, 0.75]) circ(ctx, x + w * k, y + 1.5, 0.9, P.metalDark);
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.setLineDash([2, 1.5]);
  ctx.beginPath();
  ctx.moveTo(x, y + h * 0.52);
  ctx.lineTo(x + w, y + h * 0.52);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = eink ? '#000' : 'rgba(0,0,0,0.25)';
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.fillStyle = P.ink;
  ctx.font = `bold ${Math.round(w * 0.32)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(String(year), x + w / 2, y + h * 0.85);
}
