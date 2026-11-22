/**
 * Pure layout math shared by drawing and hit-testing. Portrait screens run the line
 * top → bottom, landscape screens left → right.
 */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface StationCell {
  cell: Rect;
  pile: Rect;
  table: Rect;
  label: Rect;
  seat: { x: number; y: number };
}

export interface Layout {
  portrait: boolean;
  width: number;
  height: number;
  radius: number;
  stations: StationCell[];
  cut: Rect;
  done: Rect;
  bench: Rect;
  office: Rect;
}

const PAD = 8;

function inset(r: Rect, d: number): Rect {
  return { x: r.x + d, y: r.y + d, w: r.w - 2 * d, h: r.h - 2 * d };
}

export function computeLayout(width: number, height: number, stationCount: number): Layout {
  const portrait = height >= width * 0.9;
  const stations: StationCell[] = [];
  let cut: Rect;
  let done: Rect;
  let bench: Rect;
  let office: Rect;

  if (portrait) {
    const rows = stationCount + 2;
    const rowH = Math.min(96, (height - 2 * PAD) / rows);
    const W = width - 2 * PAD;
    const top = PAD + Math.max(0, (height - 2 * PAD - rowH * rows) / 2);
    office = { x: PAD, y: top, w: W * 0.2, h: rowH };
    cut = { x: PAD + W * 0.2, y: top, w: W * 0.25, h: rowH };
    bench = { x: PAD + W * 0.47, y: top, w: W * 0.53, h: rowH };
    for (let i = 0; i < stationCount; i++) {
      const cell = { x: PAD, y: top + rowH * (i + 1), w: W, h: rowH };
      const pile = inset({ x: cell.x, y: cell.y, w: cell.w * 0.34, h: cell.h }, 4);
      const table = inset({ x: cell.x + cell.w * 0.36, y: cell.y, w: cell.w * 0.3, h: cell.h }, 5);
      const label = inset({ x: cell.x + cell.w * 0.68, y: cell.y, w: cell.w * 0.32, h: cell.h }, 3);
      stations.push({ cell, pile, table, label, seat: { x: table.x + table.w * 0.72, y: table.y + table.h * 0.5 } });
    }
    done = { x: PAD, y: top + rowH * (stationCount + 1), w: W, h: rowH };
  } else {
    const cols = stationCount + 2;
    const colW = (width - 2 * PAD) / cols;
    const H = height - 2 * PAD;
    const lineH = H * 0.72;
    cut = inset({ x: PAD, y: PAD, w: colW, h: lineH }, 4);
    for (let i = 0; i < stationCount; i++) {
      const cell = { x: PAD + colW * (i + 1), y: PAD, w: colW, h: lineH };
      const pile = inset({ x: cell.x, y: cell.y, w: cell.w, h: cell.h * 0.36 }, 4);
      const table = inset({ x: cell.x, y: cell.y + cell.h * 0.38, w: cell.w, h: cell.h * 0.3 }, 5);
      const label = inset({ x: cell.x, y: cell.y + cell.h * 0.7, w: cell.w, h: cell.h * 0.3 }, 3);
      stations.push({ cell, pile, table, label, seat: { x: table.x + table.w * 0.5, y: table.y + table.h * 0.72 } });
    }
    done = inset({ x: PAD + colW * (stationCount + 1), y: PAD, w: colW, h: lineH }, 4);
    office = inset({ x: PAD, y: PAD + lineH, w: colW * 2, h: H - lineH }, 4);
    bench = inset({ x: PAD + colW * 2, y: PAD + lineH, w: colW * (cols - 2), h: H - lineH }, 4);
  }
  const t = stations[0]!.table;
  const radius = Math.max(10, Math.min(22, Math.min(t.w, t.h) * 0.3));
  return { portrait, width, height, radius, stations, cut, done, bench, office };
}

export function benchSlot(l: Layout, i: number, n: number): { x: number; y: number } {
  const b = l.bench;
  const step = Math.min(l.radius * 2.6, b.w / Math.max(1, n));
  return { x: b.x + step * (i + 0.5), y: b.y + b.h * 0.58 };
}

export function officeSpot(l: Layout): { x: number; y: number } {
  return { x: l.office.x + l.office.w / 2, y: l.office.y + l.office.h * 0.6 };
}

export function contains(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}
