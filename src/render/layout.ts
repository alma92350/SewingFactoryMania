/**
 * Pure layout math shared by drawing and hit-testing. Portrait screens run the line top → bottom
 * (two columns when there are many machines); landscape screens run it left → right (two rows).
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
  horizontal: boolean;
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

function stationCell(cell: Rect): StationCell {
  const horizontal = cell.w / cell.h > 1.6;
  if (horizontal) {
    const pile = inset({ x: cell.x, y: cell.y, w: cell.w * 0.32, h: cell.h }, 3);
    const table = inset({ x: cell.x + cell.w * 0.33, y: cell.y, w: cell.w * 0.32, h: cell.h }, 4);
    const label = inset({ x: cell.x + cell.w * 0.67, y: cell.y, w: cell.w * 0.33, h: cell.h }, 2);
    return { cell, pile, table, label, horizontal, seat: { x: table.x + table.w * 0.74, y: table.y + table.h * 0.52 } };
  }
  const pile = inset({ x: cell.x, y: cell.y, w: cell.w, h: cell.h * 0.34 }, 3);
  const table = inset({ x: cell.x, y: cell.y + cell.h * 0.35, w: cell.w, h: cell.h * 0.32 }, 4);
  const label = inset({ x: cell.x, y: cell.y + cell.h * 0.68, w: cell.w, h: cell.h * 0.32 }, 2);
  return { cell, pile, table, label, horizontal, seat: { x: table.x + table.w * 0.5, y: table.y + table.h * 0.72 } };
}

export function computeLayout(width: number, height: number, n: number): Layout {
  const portrait = height >= width * 0.9;
  const stations: StationCell[] = [];
  let cut: Rect;
  let done: Rect;
  let bench: Rect;
  let office: Rect;
  const W = width - 2 * PAD;
  const H = height - 2 * PAD;

  if (portrait) {
    const cols = n > 8 ? 2 : 1;
    const perCol = Math.ceil(n / cols);
    const rows = perCol + 2;
    const rowH = Math.min(96, H / rows);
    const top = PAD + Math.max(0, (H - rowH * rows) / 2);
    office = { x: PAD, y: top, w: W * 0.2, h: rowH };
    cut = { x: PAD + W * 0.21, y: top, w: W * 0.24, h: rowH };
    bench = { x: PAD + W * 0.46, y: top, w: W * 0.54, h: rowH };
    const colW = W / cols;
    for (let i = 0; i < n; i++) {
      const c = Math.floor(i / perCol);
      const r = i % perCol;
      stations.push(stationCell({ x: PAD + c * colW, y: top + rowH * (r + 1), w: colW, h: rowH }));
    }
    done = { x: PAD, y: top + rowH * (perCol + 1), w: W, h: rowH };
  } else {
    const rows = n > 10 ? 2 : 1;
    const perRow = Math.ceil(n / rows);
    const cols = perRow + 2;
    const colW = W / cols;
    const lineH = H * 0.74;
    const rowH = lineH / rows;
    cut = inset({ x: PAD, y: PAD, w: colW, h: lineH }, 3);
    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / perRow);
      const c = i % perRow;
      stations.push(stationCell({ x: PAD + colW * (c + 1), y: PAD + r * rowH, w: colW, h: rowH }));
    }
    done = inset({ x: PAD + colW * (cols - 1), y: PAD, w: colW, h: lineH }, 3);
    office = inset({ x: PAD, y: PAD + lineH, w: colW * 2, h: H - lineH }, 3);
    bench = inset({ x: PAD + colW * 2, y: PAD + lineH, w: colW * (cols - 2), h: H - lineH }, 3);
  }
  const t = stations[0]!.table;
  const radius = Math.max(9, Math.min(20, Math.min(t.w, t.h) * 0.3));
  return { portrait, width, height, radius, stations, cut, done, bench, office };
}

export function benchSlot(l: Layout, i: number, n: number): { x: number; y: number } {
  const b = l.bench;
  const perRow = Math.max(1, Math.floor(b.w / (l.radius * 2.5)));
  const rows = Math.ceil(n / perRow);
  const step = Math.min(l.radius * 2.5, b.w / Math.max(1, Math.min(n, perRow)));
  const r = Math.floor(i / perRow);
  const rowH = (b.h - 14) / Math.max(1, rows);
  return { x: b.x + step * ((i % perRow) + 0.5), y: b.y + 14 + rowH * (r + 0.5) };
}

export function officeSpot(l: Layout, k = 0): { x: number; y: number } {
  return { x: l.office.x + l.office.w * (0.3 + 0.35 * k), y: l.office.y + l.office.h * 0.62 };
}

export function contains(r: Rect, x: number, y: number): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}
