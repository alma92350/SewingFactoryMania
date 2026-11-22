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
  root.innerHTML = `<div class="card game" role="dialog" aria-labelledby="mg-title">
    <h2 id="mg-title">Spot the differences</h2>
    <p class="muted small">Left: Mr. Watanabe’s approved sample. Right: ours. Tap the 3 differences on <b>our</b> polo.</p>
    <div class="timer"><div id="mg-bar"></div></div>
    <div class="polos"><figure><figcaption>Approved</figcaption>${polo(new Set(), new Set())}</figure>
    <figure><figcaption>Ours <span id="mg-count">0/3</span></figcaption><div id="mg-ours" class="tap">${polo(diffs, found)}</div></figure></div>
    <div class="buttons"><button data-mg="stop">I’m done</button></div></div>`;
  const ours = root.querySelector<HTMLElement>('#mg-ours')!;
  const bar = root.querySelector<HTMLElement>('#mg-bar')!;
  const count = root.querySelector<HTMLElement>('#mg-count')!;

  const end = () => {
    if (finished) return;
    finished = true;
    root.innerHTML = `<div class="card"><h2>${found.size === 3 ? 'Perfect eye!' : found.size > 0 ? 'Good catch.' : 'Missed them.'}</h2>
      <p>You found ${found.size} of 3 differences. ${['Defects unchanged on this order.', 'Defects −10% on this order.', 'Defects −20% on this order.', 'Defects −30% on this order.'][found.size]}</p>
      <div class="buttons"><button class="primary" data-mg="ok">Start sewing</button></div></div>`;
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
