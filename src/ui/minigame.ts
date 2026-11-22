import { trHtml } from './i18n';

/**
 * "Spot the Defect" (PRD §9): compare our sample with the buyer's approved polo and tap the
 * differences within 15 seconds. UI-only randomness; the result goes to the sim as a command.
 */

type Diff = 'label' | 'button' | 'pocket' | 'collar' | 'stripe' | 'hem';

const HITS: Record<Diff, { x: number; y: number }[]> = {
  label: [
    { x: 67, y: 74 },
    { x: 133, y: 74 },
  ],
  button: [{ x: 100, y: 72 }],
  pocket: [{ x: 129, y: 94 }],
  collar: [{ x: 100, y: 40 }],
  stripe: [{ x: 176, y: 90 }],
  hem: [{ x: 100, y: 194 }],
};

const ALL: Diff[] = ['label', 'button', 'pocket', 'collar', 'stripe', 'hem'];

function polo(diffs: Set<Diff>, found: Set<Diff>): string {
  const body = '#3f8f5f';
  const collar = diffs.has('collar')
    ? '<path d="M80 36 Q100 66 120 36 L112 32 Q100 50 88 32 Z" fill="#f3ead7" stroke="#2b2a26" stroke-width="1.5"/>'
    : '<path d="M80 36 L100 60 L120 36 L112 32 L100 46 L88 32 Z" fill="#f3ead7" stroke="#2b2a26" stroke-width="1.5"/>';
  const buttons = (diffs.has('button') ? [54, 66] : [54, 66, 78]).map((y) => `<circle cx="100" cy="${y}" r="2.6" fill="#f3ead7" stroke="#2b2a26"/>`).join('');
  const label = `<rect x="${diffs.has('label') ? 126 : 60}" y="70" width="14" height="8" rx="1" fill="#c2185b"/>`;
  const pocket = diffs.has('pocket') ? '<rect x="118" y="82" width="22" height="24" fill="none" stroke="#2b2a26" stroke-width="1.5"/>' : '';
  const stripeR = diffs.has('stripe') ? '' : '<line x1="166" y1="88" x2="184" y2="100" stroke="#f3ead7" stroke-width="3"/>';
  const hem = diffs.has('hem')
    ? '<path d="M52 192 Q76 186 100 194 T148 190" fill="none" stroke="#2b2a26" stroke-width="1.5"/>'
    : '<line x1="52" y1="192" x2="148" y2="192" stroke="#2b2a26" stroke-width="1.5"/>';
  const rings = [...found].flatMap((d) => HITS[d]).map((h) => `<circle cx="${h.x}" cy="${h.y}" r="13" fill="none" stroke="#e8c547" stroke-width="3"/>`).join('');
  return `<svg viewBox="0 0 200 215" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">
    <path d="M62 34 L38 46 L8 80 L28 106 L50 92 L50 200 L150 200 L150 92 L172 106 L192 80 L162 46 L138 34 Z" fill="${body}" stroke="#2b2a26" stroke-width="1.5"/>
    <line x1="16" y1="88" x2="34" y2="100" stroke="#f3ead7" stroke-width="3"/>${stripeR}
    <rect x="96" y="44" width="8" height="42" fill="#367e53" stroke="#2b2a26"/>
    ${collar}${buttons}${label}${pocket}${hem}${rings}
  </svg>`;
}

export function playSpotTheDefect(root: HTMLElement, onDone: (found: number) => void): void {
  const pool = [...ALL].sort(() => Math.random() - 0.5);
  const diffs = new Set<Diff>(pool.slice(0, 3));
  const found = new Set<Diff>();
  const limit = 15000;
  let deadline = performance.now() + limit;
  let finished = false;

  root.hidden = false;
  root.innerHTML = trHtml(`<div class="card game" role="dialog" aria-labelledby="mg-title">
    <h2 id="mg-title">Spot the differences</h2>
    <p class="muted small">Left: Mr. Watanabe’s approved sample. Right: ours. Tap the 3 differences on our polo.</p>
    <div class="timer"><div id="mg-bar"></div></div>
    <div class="polos"><figure><figcaption>Approved</figcaption>${polo(new Set(), new Set())}</figure>
    <figure><figcaption>Ours <span id="mg-count">0/3</span></figcaption><div id="mg-ours" class="tap">${polo(diffs, found)}</div></figure></div>
    <div class="buttons"><button data-mg="stop">I’m done</button></div></div>`);
  const ours = root.querySelector<HTMLElement>('#mg-ours')!;
  const bar = root.querySelector<HTMLElement>('#mg-bar')!;
  const count = root.querySelector<HTMLElement>('#mg-count')!;

  const end = () => {
    if (finished) return;
    finished = true;
    root.innerHTML = trHtml(`<div class="card"><h2>${found.size === 3 ? 'Perfect eye!' : found.size > 0 ? 'Good catch.' : 'Missed them.'}</h2>
      <p>You found ${found.size} of 3 differences. ${['Defects unchanged on this order.', 'Defects −10% on this order.', 'Defects −20% on this order.', 'Defects −30% on this order.'][found.size]}</p>
      <div class="buttons"><button class="primary" data-mg="ok">Start sewing</button></div></div>`);
    root.querySelector<HTMLButtonElement>('[data-mg="ok"]')!.onclick = () => {
      root.innerHTML = '';
      root.hidden = true;
      onDone(found.size);
    };
    root.querySelector<HTMLButtonElement>('[data-mg="ok"]')!.focus();
  };

  ours.addEventListener('pointerup', (e) => {
    const svg = ours.querySelector('svg')!;
    const r = svg.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 200;
    const y = ((e.clientY - r.top) / r.height) * 215;
    const hit = [...diffs].find((d) => !found.has(d) && HITS[d].some((h) => Math.hypot(h.x - x, h.y - y) < 16));
    if (hit) {
      found.add(hit);
      ours.innerHTML = polo(diffs, found);
      count.textContent = `${found.size}/3`;
      if (found.size === 3) setTimeout(end, 350);
    } else deadline -= 1000; // a wrong tap costs a second
  });
  root.querySelector<HTMLButtonElement>('[data-mg="stop"]')!.onclick = end;

  const tick = () => {
    if (finished) return;
    const left = deadline - performance.now();
    bar.style.width = `${Math.max(0, (left / limit) * 100)}%`;
    if (left <= 0) end();
    else requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

// ───────────────────────────── Fabric Inspection (PRD §9.1)

export interface RollView {
  id: number;
  condition: 'good' | 'flawed' | 'offShade';
}

/**
 * Rolls unroll one after another; tap the bad ones (flaws, or a shade that does not match the
 * reference swatch). The whole shipment takes at most ~13 seconds.
 */
export function playFabricInspection(root: HTMLElement, rolls: RollView[], fabric: string, onDone: (flagged: number[]) => void): void {
  const per = Math.min(1300, 13000 / Math.max(1, rolls.length));
  const flagged = new Set<number>();
  let i = 0;
  let finished = false;
  root.hidden = false;
  const shade = (c: RollView['condition']) => (c === 'offShade' ? `filter: hue-rotate(35deg) saturate(1.6) brightness(1.15)` : '');
  const spots = (r: RollView) =>
    r.condition === 'flawed'
      ? `<span class="flaw" style="left:${20 + ((r.id * 37) % 55)}%;top:${25 + ((r.id * 53) % 45)}%"></span><span class="flaw small" style="left:${10 + ((r.id * 71) % 70)}%;top:${15 + ((r.id * 29) % 60)}%"></span>`
      : '';
  root.innerHTML = trHtml(`<div class="card game" role="dialog" aria-labelledby="fi-title">
    <h2 id="fi-title">Inspect the rolls</h2>
    <p class="muted small">Tap a roll if it has flaws or a different shade from the reference. Bad rolls you flag are sent back and refunded.</p>
    <div class="fi"><figure><figcaption>Reference</figcaption><div class="swatch ref" style="background:${fabric}"></div></figure>
    <figure><figcaption><span>Roll</span> <span id="fi-n">1</span>/${rolls.length}</figcaption><button id="fi-roll" class="swatch roll" aria-label="Flag this roll"></button></figure></div>
    <div class="timer"><div id="fi-bar"></div></div>
    <p class="small" id="fi-count">0 flagged</p></div>`);
  const btn = root.querySelector<HTMLButtonElement>('#fi-roll')!;
  const bar = root.querySelector<HTMLElement>('#fi-bar')!;
  const count = root.querySelector<HTMLElement>('#fi-count')!;
  const nEl = root.querySelector<HTMLElement>('#fi-n')!;
  const show = () => {
    const r = rolls[i]!;
    btn.setAttribute('style', `background:${fabric};${shade(r.condition)}`);
    btn.innerHTML = spots(r);
    btn.classList.toggle('flagged', flagged.has(r.id));
    nEl.textContent = String(i + 1);
  };
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const r = rolls[i];
    if (!r || finished) return;
    if (flagged.has(r.id)) flagged.delete(r.id);
    else flagged.add(r.id);
    btn.classList.toggle('flagged', flagged.has(r.id));
    count.textContent = `${flagged.size} flagged`;
  });
  const end = () => {
    finished = true;
    const bad = rolls.filter((r) => r.condition !== 'good');
    const caught = bad.filter((r) => flagged.has(r.id)).length;
    const wasted = [...flagged].filter((id) => rolls.find((r) => r.id === id)?.condition === 'good').length;
    root.innerHTML = trHtml(`<div class="card"><h2>${caught === bad.length && wasted === 0 ? 'Sharp eyes!' : 'Inspection done'}</h2>
      <p>You caught ${caught} of ${bad.length} bad rolls${wasted ? ` and set aside ${wasted} good one${wasted > 1 ? 's' : ''} (not refunded)` : ''}.</p>
      <div class="buttons"><button class="primary" data-mg="ok">Send them to the cutting table</button></div></div>`);
    const ok = root.querySelector<HTMLButtonElement>('[data-mg="ok"]')!;
    ok.onclick = () => {
      root.innerHTML = '';
      root.hidden = true;
      onDone([...flagged]);
    };
    ok.focus();
  };
  let start = performance.now();
  show();
  const tick = (t: number) => {
    if (finished) return;
    const k = Math.floor((t - start) / per);
    if (k !== i) {
      i = k;
      if (i >= rolls.length) return end();
      show();
    }
    bar.style.width = `${Math.max(0, 100 - ((t - start) / (per * rolls.length)) * 100)}%`;
    requestAnimationFrame(tick);
  };
  start = performance.now();
  requestAnimationFrame(tick);
}

// ───────────────────────────── Marker Puzzle (PRD §9.2)

type Shape = [number, number][];
const PIECES: { name: string; shape: Shape }[] = [
  { name: 'Front', shape: [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]] },
  { name: 'Back', shape: [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]] },
  { name: 'Sleeve', shape: [[0, 0], [1, 0], [2, 0], [0, 1]] },
  { name: 'Sleeve', shape: [[0, 0], [1, 0], [2, 0], [0, 1]] },
  { name: 'Collar', shape: [[0, 0], [1, 0], [2, 0], [3, 0]] },
  { name: 'Pockets', shape: [[0, 0], [1, 0], [0, 1], [1, 1]] },
];
const COLS = 4;
const ROWS = 10;

function rotate(sh: Shape): Shape {
  const r = sh.map(([x, y]) => [-y, x] as [number, number]);
  const mx = Math.min(...r.map((p) => p[0]));
  const my = Math.min(...r.map((p) => p[1]));
  return r.map(([x, y]) => [x - mx, y - my]);
}

/**
 * Place the pattern pieces on a 4-wide fabric strip, as short as possible. Tap a piece, then a cell;
 * "Turn" rotates it. When the time runs out the remaining pieces are placed for you (first fit).
 * Returns the marker efficiency: the share of the used fabric covered by pieces.
 */
export function playMarker(root: HTMLElement, auto: number, best: number, onDone: (eff: number) => void): void {
  const grid: (number | null)[][] = Array.from({ length: ROWS }, () => Array<number | null>(COLS).fill(null));
  const placed = new Map<number, { x: number; y: number; shape: Shape }>();
  const shapes: Shape[] = PIECES.map((p) => p.shape);
  let selected: number | null = 0;
  let finished = false;
  const limit = 15000;
  const deadline = performance.now() + limit;
  root.hidden = false;

  const fits = (sh: Shape, x: number, y: number) => sh.every(([dx, dy]) => x + dx < COLS && y + dy < ROWS && grid[y + dy]![x + dx] === null);
  const put = (k: number, x: number, y: number) => {
    for (const [dx, dy] of shapes[k]!) grid[y + dy]![x + dx] = k;
    placed.set(k, { x, y, shape: shapes[k]! });
  };
  const lift = (k: number) => {
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) if (grid[y]![x] === k) grid[y]![x] = null;
    placed.delete(k);
  };
  const usedRows = () => {
    let m = 0;
    for (let y = 0; y < ROWS; y++) if (grid[y]!.some((c) => c !== null)) m = y + 1;
    return m;
  };
  const efficiency = () => {
    const covered = [...placed.keys()].reduce((acc, k) => acc + PIECES[k]!.shape.length, 0);
    const ratio = covered / (COLS * Math.max(1, usedRows()));
    return Math.max(0.68, Math.min(best, 0.7 + (ratio - 0.6) * ((best - 0.7) / 0.4)));
  };
  const hues = ['#5d6d7e', '#7d6e5e', '#5e7d6a', '#5e7d6a', '#7a5e7d', '#7d775e'];

  const render = () => {
    const cells = grid
      .map((row, y) =>
        row
          .map((c, x) => `<button class="mcell${c !== null ? ' on' : ''}" data-x="${x}" data-y="${y}" style="${c !== null ? `background:${hues[c]}` : ''}" aria-label="Row ${y + 1}, column ${x + 1}"></button>`)
          .join(''),
      )
      .join('');
    const palette = PIECES.map((p, k) => `<button class="mpiece${selected === k ? ' sel' : ''}${placed.has(k) ? ' used' : ''}" data-k="${k}">${p.name}</button>`).join('');
    root.innerHTML = trHtml(`<div class="card game marker" role="dialog" aria-labelledby="mk-title"><h2 id="mk-title">Lay the marker</h2>
      <p class="muted small">Tap a piece, then a square on the fabric. Shorter fabric = fewer rolls to buy. Standard marker: ${Math.round(auto * 100)}%.</p>
      <div class="timer"><div id="mk-bar"></div></div>
      <div class="mwrap"><div class="mgrid" style="grid-template-columns:repeat(${COLS},1fr)">${cells}</div>
      <div class="mside"><div class="mpal">${palette}</div><button data-mk="turn">Turn ↻</button><p class="small"><span>Used: ${usedRows()} rows</span><br><span>Efficiency:</span> <b>${placed.size ? Math.round(efficiency() * 100) : '—'}%</b></p><button data-mk="done">I’m done</button></div></div></div>`);
  };

  const finish = () => {
    if (finished) return;
    finished = true;
    // place the rest first-fit
    PIECES.forEach((_, k) => {
      if (placed.has(k)) return;
      for (let y = 0; y < ROWS && !placed.has(k); y++) for (let x = 0; x < COLS && !placed.has(k); x++) if (fits(shapes[k]!, x, y)) put(k, x, y);
    });
    const eff = placed.size === PIECES.length ? efficiency() : auto;
    root.innerHTML = trHtml(`<div class="card"><h2>${eff >= auto + 0.05 ? 'A tight marker!' : eff >= auto ? 'Good marker.' : 'A loose marker.'}</h2>
      <p>Efficiency ${Math.round(eff * 100)}% (standard ${Math.round(auto * 100)}%).</p><div class="buttons"><button class="primary" data-mg="ok">Use this marker</button></div></div>`);
    const ok = root.querySelector<HTMLButtonElement>('[data-mg="ok"]')!;
    root.onclick = null;
    ok.onclick = () => {
      root.innerHTML = '';
      root.hidden = true;
      onDone(eff);
    };
    ok.focus();
  };

  root.onclick = (e) => {
    if (finished) return;
    const el = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!el) return;
    if (el.dataset.k !== undefined) selected = Number(el.dataset.k);
    else if (el.dataset.mk === 'turn' && selected !== null) {
      if (placed.has(selected)) lift(selected);
      shapes[selected] = rotate(shapes[selected]!);
    } else if (el.dataset.mk === 'done') return finish();
    else if (el.dataset.x !== undefined) {
      const x = Number(el.dataset.x);
      const y = Number(el.dataset.y);
      const here = grid[y]![x];
      if (here !== null && here !== undefined) {
        lift(here);
        selected = here;
      } else if (selected !== null) {
        if (placed.has(selected)) lift(selected);
        if (fits(shapes[selected]!, x, y)) {
          put(selected, x, y);
          const next = PIECES.findIndex((_, k) => !placed.has(k));
          selected = next >= 0 ? next : null;
        }
      }
    }
    render();
  };
  render();
  const tick = () => {
    if (finished) return;
    const left = deadline - performance.now();
    const bar = root.querySelector<HTMLElement>('#mk-bar');
    if (bar) bar.style.width = `${Math.max(0, (left / limit) * 100)}%`;
    if (left <= 0) finish();
    else requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
