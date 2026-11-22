import { chance, rand } from '../core/rng';
import { BUYERS } from '../data/buyers';
import { CREW } from '../data/people';
import { PRODUCTS, type MachineType } from '../data/products';
import { makeWorker } from './state';
import { deliverBuyerFabric, inspectByCutter, rejectRolls, scrapForRecut } from './sourcing';
import { generatorDecision } from './power';
import { bacTuScissors, payBonus, tetVolunteers } from './morale';
import { aqlPlan, chapterOf, has, inspectionLevel, orderById, orderValue } from './selectors';
import type { Bundle, Decision, GameState, Order, SimEvent } from './types';

export interface NewOrder {
  tag: string;
  buyer: string;
  product: string;
  qty: number;
  price: number;
  dueDay: number;
  sample?: boolean;
  line?: number;
  fob?: boolean;
}

/** A line can make a product if it has every machine type the product needs. */
export function lineCanMake(s: GameState, line: number, product: string): boolean {
  const types = new Set(s.stations.filter((st) => st.line === line).map((st) => st.machine));
  return PRODUCTS[product]!.ops.every((op) => types.has(op.machine));
}

/** New orders go to an idle capable line, else to the capable line with the least work queued. */
function pickLine(s: GameState, product: string): number {
  const capable = s.lines.map((_, i) => i).filter((i) => lineCanMake(s, i, product));
  const pool = capable.length ? capable : [0];
  const idle = pool.find((i) => s.lines[i]!.activeOrderId === null);
  if (idle !== undefined) return idle;
  let best = pool[0]!;
  let bestWork = Infinity;
  pool.forEach((i) => {
    const work = s.orders.filter((o) => o.line === i && (o.status === 'active' || o.status === 'queued')).reduce((a, o) => a + o.qty - o.finished, 0);
    if (work < bestWork) {
      best = i;
      bestWork = work;
    }
  });
  return best;
}

export function createOrder(s: GameState, n: NewOrder): Order {
  const o: Order = {
    id: s.nextId++,
    tag: n.tag,
    buyer: n.buyer,
    product: n.product,
    qty: n.qty,
    price: n.price,
    dueDay: n.dueDay,
    originalDue: n.dueDay,
    line: n.line ?? pickLine(s, n.product),
    mode: n.fob ? 'fob' : 'cmt',
    uncut: 0,
    markerEff: s.tuning.markerAuto,
    markerSet: !(n.fob && has(s, 'cutting')),
    cutFabric: [],
    recutPieces: 0,
    status: 'queued',
    cut: 0,
    finished: 0,
    lotDefects: 0,
    lotOrigins: {},
    sampleFactor: 1,
    sampled: !(n.sample && has(s, 'quality')),
    airFreight: false,
    discount: 0,
    inspections: [],
    causes: {},
    caughtByQc: 0,
    shippedDay: null,
    shippedPieces: 0,
    revenue: 0,
    onTime: null,
  };
  s.orders.push(o);
  if (has(s, 'cutting') && o.mode === 'cmt') deliverBuyerFabric(s, o);
  if (!o.markerSet) {
    pushDecision(s, {
      kind: 'marker',
      title: 'Lay the marker',
      body: `${PRODUCTS[o.product]!.plural[0]!.toUpperCase()}${PRODUCTS[o.product]!.plural.slice(1)} for ${BUYERS[o.buyer]!.contact}: you pay for the fabric. A tighter marker (how the pattern pieces sit on the fabric) means fewer rolls to buy.`,
      options: [
        { id: 'play', label: 'Lay it yourself (15 s)', detail: `Up to ${Math.round(s.tuning.markerBest * 100)}% of the fabric used` },
        { id: 'auto', label: 'Use the standard marker', detail: `${Math.round(s.tuning.markerAuto * 100)}% of the fabric used` },
      ],
      orderId: o.id,
    });
  }
  if (s.lines[o.line]!.activeOrderId === null) activateOrder(s, o);
  return o;
}

/**
 * Put an order on the line: retarget every machine to the product's operations.
 * Seated workers stay where they are; they start at their learning level for the new operation.
 * `layout` optionally maps station index → product operation index (null = no job).
 */
export function activateOrder(s: GameState, o: Order, layout?: (number | null)[]): void {
  o.status = 'active';
  s.lines[o.line]!.activeOrderId = o.id;
  if (has(s, 'cutting')) {
    o.uncut = Math.ceil((o.qty - o.finished) / s.tuning.bundleSize);
    o.cut = 0;
  } else o.cut = Math.ceil((o.qty - o.finished) / s.tuning.bundleSize);
  const ops = PRODUCTS[o.product]!.ops;
  if (layout) {
    s.stations.forEach((st, i) => {
      if (st.machine === 'qc' || st.machine === 'cutting' || st.line !== o.line) return;
      const k = layout[i];
      st.opId = k === null || k === undefined ? null : ops[k]!.id;
    });
  } else {
    const lineStations = s.stations.filter((st) => st.line === o.line);
    const types = [...new Set(lineStations.map((st) => st.machine))].filter((t) => t !== 'qc' && t !== 'cutting') as MachineType[];
    for (const t of types) {
      // staffed machines get the operations first, so the crew covers every step it can
      const stations = lineStations
        .filter((st) => st.machine === t)
        .sort((a, b) => Number(a.workerId === null) - Number(b.workerId === null) || a.index - b.index);
      const tops = ops.filter((op) => op.machine === t);
      stations.forEach((st) => (st.opId = null));
      if (tops.length === 0) continue;
      const count: Record<string, number> = {};
      stations.forEach((st, i) => {
        let opId: string;
        if (i < tops.length) opId = tops[i]!.id;
        else opId = tops.reduce((a, b) => (b.smv / ((count[b.id] ?? 0) + 1) > a.smv / ((count[a.id] ?? 0) + 1) ? b : a)).id;
        count[opId] = (count[opId] ?? 0) + 1;
        st.opId = opId;
      });
    }
  }
  if (!o.sampled) pushSampleDecision(s, o);
}

export function pushDecision(s: GameState, d: Omit<Decision, 'id'>): Decision {
  const full = { ...d, id: s.nextId++ } as Decision;
  s.decisions.push(full);
  return full;
}

function pushSampleDecision(s: GameState, o: Order): void {
  if (s.campaign['ch2.ut'] === 'osaka') {
    o.sampled = true;
    o.sampleFactor = 0.7;
    pushDecision(s, {
      kind: 'info',
      title: 'A letter from Osaka',
      body: 'Út writes: “Mr. Watanabe’s store wants the label 2 cm from the collar seam, and they count the stitches per inch. I drew it for you.” The sample is approved with the best rating: defects −30% on this order.',
      options: [{ id: 'ok', label: 'Thank you, Út' }],
      orderId: o.id,
    });
    return;
  }
  pushDecision(s, {
    kind: 'sample',
    title: 'Sample check',
    body: `Before bulk sewing, compare our sample with ${BUYERS[o.buyer]!.contact}’s approved sample. Every difference you spot now is a defect the line will not repeat.`,
    options: [
      { id: 'play', label: 'Check it yourself (15 s)', detail: 'Find the differences: up to −30% defects' },
      { id: 'skip', label: 'Let Lan check it', detail: '−10% defects' },
    ],
    orderId: o.id,
  });
}

export function applySampleResult(o: Order, found: number): void {
  o.sampled = true;
  o.sampleFactor = [1, 0.9, 0.8, 0.7][Math.max(0, Math.min(3, found))]!;
}

/** Remove every bundle of an order from the line (after a short shipment). */
function clearOrderWip(s: GameState, orderId: number): void {
  for (const st of s.stations) {
    if (st.current?.orderId === orderId) st.current = null;
    st.pile = st.pile.filter((b) => b.orderId !== orderId);
  }
}

export function wipCount(s: GameState, orderId: number): number {
  let n = 0;
  for (const st of s.stations) {
    if (st.current?.orderId === orderId) n += st.current.pieces;
    for (const b of st.pile) if (b.orderId === orderId) n += b.pieces;
  }
  return n;
}

export function shipOrder(s: GameState, o: Order, events: SimEvent[], short = false): void {
  const pieces = Math.min(o.finished, o.qty);
  const revenue = Math.round(orderValue(o, pieces) * (1 - o.discount));
  const freight = o.airFreight ? Math.round(orderValue(o) * s.tuning.airFreightShare) : 0;
  const penalty = short ? Math.round(orderValue(o, o.qty - pieces) * s.tuning.shortShipPenaltyShare) : 0;
  s.cash += revenue - freight - penalty;
  s.ledger.revenue += revenue;
  s.ledger.freight += freight;
  s.ledger.penalties += penalty;
  o.revenue = revenue - freight - penalty;
  o.shippedPieces = pieces;
  o.shippedDay = s.day;
  o.status = short ? 'short' : 'shipped';
  o.onTime = !short && !o.airFreight && s.day <= o.originalDue;
  clearOrderWip(s, o.id);
  if (has(s, 'orders')) events.push({ kind: 'shipped', orderId: o.id, amount: o.revenue });
  const line = s.lines[o.line]!;
  if (line.activeOrderId === o.id) {
    line.activeOrderId = null;
    const next = s.orders.find((q) => q.status === 'queued' && q.line === o.line);
    if (next) activateOrder(s, next);
  }
}

/** Once a minute: ship finished orders, call the inspector, and enforce the vessel cut-off. */
export function checkOrders(s: GameState, events: SimEvent[]): void {
  for (const line of s.lines) {
    const o = s.orders.find((q) => q.id === line.activeOrderId);
    if (o && o.status === 'active' && o.finished >= o.qty && wipCount(s, o.id) === 0 && !s.decisions.some((d) => d.orderId === o.id)) {
      if (has(s, 'quality') && inspectionLevel(o) !== 'none') runInspection(s, o, events);
      else if (has(s, 'orders')) shipOrder(s, o, events);
    }
  }
  if (has(s, 'orders') && s.minute === s.tuning.shiftEnd - 1) {
    for (const q of s.orders) {
      if ((q.status === 'active' || q.status === 'queued') && q.dueDay === s.day && !s.decisions.some((d) => d.orderId === q.id)) {
        pushCutoff(s, q, events);
      }
    }
  }
}

function pushCutoff(s: GameState, o: Order, events: SimEvent[]): void {
  const value = Math.round(orderValue(o));
  if (o.airFreight) {
    shipOrder(s, o, events, true);
    events.push({ kind: 'note', text: `Air freight deadline passed: ${o.finished} ${PRODUCTS[o.product]!.plural} shipped short.` });
    return;
  }
  const d = pushDecision(s, {
    kind: 'cutoff',
    title: 'The vessel leaves tonight',
    body: `${BUYERS[o.buyer]!.contact}’s order is not finished: ${o.finished} of ${o.qty} ${PRODUCTS[o.product]!.plural} packed. The truck to Saigon Port leaves now.`,
    options: [
      { id: 'air', label: 'Air freight in 2 days', detail: `Keep sewing; costs $${Math.round(value * s.tuning.airFreightShare)} (half the order value)` },
      { id: 'short', label: 'Ship what is ready', detail: `Paid for ${o.finished}; penalty 25% of the missing value` },
    ],
    orderId: o.id,
  });
  events.push({ kind: 'decision', id: d.id });
}

/** Simplified AQL inspection: sample without replacement from the finished lot. */
export function runInspection(s: GameState, o: Order, events: SimEvent[]): void {
  const plan = aqlPlan(o.finished, inspectionLevel(o), s.mods.inspectionShift);
  let left = o.finished;
  let bad = o.lotDefects;
  let found = 0;
  for (let i = 0; i < plan.sample; i++) {
    if (chance(s.rng, bad / left)) {
      found += 1;
      bad -= 1;
    }
    left -= 1;
  }
  const passed = found <= plan.accept;
  o.inspections.push({ day: s.day, lot: o.finished, sample: plan.sample, found, accept: plan.accept, passed });
  const b = BUYERS[o.buyer]!;
  const d = pushDecision(s, {
    kind: 'inspection',
    title: passed ? 'Inspection PASSED' : 'Inspection REJECTED',
    body: `${b.contact} opened cartons and checked ${plan.sample} ${PRODUCTS[o.product]!.plural}: ${found} defective (maximum allowed: ${plan.accept}).`,
    options: passed
      ? [{ id: 'ship', label: 'Load the truck', detail: `Paid $${Math.round(orderValue(o))}` }]
      : [
          { id: 'recheck', label: 'Check every piece and repair', detail: 'Defects go back to the line, then a new inspection' },
          { id: 'anyway', label: 'Beg him to take it anyway', detail: `40% discount; ${b.contact} will remember` },
        ],
    orderId: o.id,
  });
  events.push({ kind: 'decision', id: d.id });
}

/** After a failed inspection: inspect 100%, send the caught defects back to the operation that made them. */
export function recheckLot(s: GameState, o: Order): number {
  let caught = 0;
  const byOp: Record<string, number> = {};
  const origins = Object.entries(o.lotOrigins).filter(([, n]) => n > 0);
  let pool = origins.reduce((a, [, n]) => a + n, 0);
  for (let i = 0; i < o.lotDefects; i++) {
    if (!chance(s.rng, s.tuning.qcCatch)) continue;
    // pick the origin proportionally to what is left
    let r = rand(s.rng) * pool;
    for (const entry of origins) {
      if (entry[1] <= 0) continue;
      r -= entry[1];
      if (r <= 0) {
        entry[1] -= 1;
        byOp[entry[0]] = (byOp[entry[0]] ?? 0) + 1;
        break;
      }
    }
    pool -= 1;
    caught += 1;
  }
  for (const [opId, n] of Object.entries(byOp)) {
    o.lotOrigins[opId] = (o.lotOrigins[opId] ?? 0) - n;
    sendRework(s, o.id, opId, n);
  }
  o.finished -= caught;
  o.lotDefects -= caught;
  return caught;
}

export function sendRework(s: GameState, orderId: number, opId: string, pieces: number): void {
  const order = orderById(s, orderId);
  if (opId === 'fabric') {
    if (order) scrapForRecut(s, order, pieces);
    return;
  }
  const line = order?.line ?? 0;
  for (let left = pieces; left > 0; left -= s.tuning.bundleSize) {
    const b: Bundle = { id: s.nextId++, orderId, pieces: Math.min(s.tuning.bundleSize, left), done: 0, defects: 0, origins: {}, rework: true, pAcc: 0 };
    const target = bestStationFor(s, opId, null, line);
    if (target) target.pile.push(b);
  }
}

/** Where a bundle goes next: fewest waiting, avoid stopped or empty stations. */
export function bestStationFor(s: GameState, opId: string, exclude: number | null = null, line: number | null = null) {
  let best: GameState['stations'][number] | null = null;
  let bestScore = Infinity;
  for (const st of s.stations) {
    if (st.opId !== opId || st.index === exclude || (line !== null && st.line !== line)) continue;
    const score = (st.broken || st.workerId === null ? 100 : 0) + st.pile.length + (st.current ? 1 : 0);
    if (score < bestScore) {
      best = st;
      bestScore = score;
    }
  }
  return best;
}

export function pushFamily2(s: GameState): void {
  const f = chapterOf(s).family2;
  if (!f) return;
  pushDecision(s, { kind: 'family', title: f.title, body: f.body, options: f.options.map((o) => ({ id: o.id, label: o.label, detail: o.effect })), flag: f.flag });
}

export function pushFamily(s: GameState): void {
  const f = chapterOf(s).family;
  if (!f) return;
  pushDecision(s, {
    kind: 'family',
    title: f.title,
    body: f.body,
    options: f.options.map((o) => ({ id: o.id, label: o.label, detail: o.effect })),
    flag: f.flag,
  });
}

/** Resolve a decision card. Returns an error string, or null on success. */
export function resolveDecision(s: GameState, id: number, optionId: string, events: SimEvent[]): string | null {
  const d = s.decisions.find((x) => x.id === id);
  if (!d) return 'That decision is no longer open.';
  if (!d.options.some((o) => o.id === optionId)) return 'Unknown option.';
  if ((d.kind === 'sample' || d.kind === 'marker' || d.kind === 'fabric') && optionId === 'play') return 'Play the check first.';
  s.decisions = s.decisions.filter((x) => x.id !== id);
  const o = d.orderId !== undefined ? orderById(s, d.orderId) : undefined;
  switch (d.kind) {
    case 'fax': {
      if (optionId === 'decline') break;
      const q = d.fax!.options[Number(optionId)]!;
      createOrder(s, { tag: d.fax!.tag, buyer: d.fax!.buyer, product: d.fax!.product, qty: q.qty, price: q.price, dueDay: q.dueDay, sample: d.fax!.sample, fob: d.fax!.fob });
      break;
    }
    case 'power':
      generatorDecision(s, optionId);
      break;
    case 'bonus':
      if (optionId === 'pay') payBonus(s);
      break;
    case 'family':
      s.campaign[d.flag!] = optionId;
      if (d.flag === 'ch4.flood' && optionId === 'help' && s.power) {
        s.power.closedFrom = 13 * 60;
        s.power.closedUntil = s.tuning.shiftEnd;
      }
      if (d.flag === 'ch5.scissors') bacTuScissors(s, optionId);
      if (d.flag === 'ch5.tet') {
        if (optionId === 'home') s.closedToday = true;
        else tetVolunteers(s);
      }
      if (d.flag === 'ch3.loan' && optionId === 'borrow') {
        s.cash += 300;
        s.loan = 330;
      }
      if (d.flag === 'ch2.ut' && optionId === 'join') s.workers.push(makeWorker(CREW.ut!, s.tuning, null, s.minute));
      break;
    case 'cutoff':
      if (!o) break;
      if (optionId === 'air') {
        o.airFreight = true;
        o.dueDay = s.day + 2;
      } else shipOrder(s, o, events, true);
      break;
    case 'inspection':
      if (!o) break;
      if (optionId === 'recheck') recheckLot(s, o);
      else {
        if (optionId === 'anyway') o.discount = s.tuning.shipAnywayDiscount;
        shipOrder(s, o, events);
      }
      break;
    case 'change':
      if (!o) break;
      if (optionId === 'accept') {
        const extra = Math.ceil((o.qty * (d.addPct ?? 0)) / 100 / s.tuning.bundleSize) * s.tuning.bundleSize;
        o.qty += extra;
        if (o.status === 'active') o.cut += extra / s.tuning.bundleSize;
      } else {
        o.dueDay += 1;
        o.originalDue += 1;
        o.price = Math.round((o.price - 0.3) * 100) / 100;
      }
      break;
    case 'sample':
      if (o) applySampleResult(o, 1);
      break;
    case 'marker':
      if (o) {
        o.markerEff = s.tuning.markerAuto;
        o.markerSet = true;
      }
      break;
    case 'fabric':
      if (optionId === 'cutter' && d.shipmentId !== undefined) rejectRolls(s, inspectByCutter(s, d.shipmentId));
      break;
    case 'info':
      break;
  }
  return null;
}
