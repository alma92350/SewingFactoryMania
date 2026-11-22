import { chance, rand } from '../core/rng';
import { CUT_OP, PRODUCTS } from '../data/products';
import { ROLL_METRES, SUPPLIERS } from '../data/suppliers';
import { pushDecision } from './orders';
import { activeOrder, has, orderById, workerById } from './selectors';
import type { Bundle, GameState, Order, Roll, RollCondition, SimEvent, Station } from './types';

/** Metres one bundle needs, after the marker. */
export function metresPerBundle(s: GameState, o: Order): number {
  return (s.tuning.bundleSize * PRODUCTS[o.product]!.metres) / o.markerEff;
}

export function metresInStock(s: GameState, orderId: number): number {
  return s.warehouse.filter((r) => r.orderId === orderId && !r.rejected).reduce((a, r) => a + r.metres, 0);
}

export function metresInTransit(s: GameState, orderId: number): number {
  return s.shipments.filter((x) => x.orderId === orderId && x.status === 'transit').reduce((a, x) => a + x.rolls * ROLL_METRES, 0);
}

/** Rolls still to buy so the whole order can be cut. */
export function rollsToBuy(s: GameState, o: Order): number {
  if (o.mode !== 'fob' || o.status === 'shipped' || o.status === 'short') return 0;
  const bundles = o.status === 'queued' ? Math.ceil(o.qty / s.tuning.bundleSize) : o.uncut;
  const need = bundles * metresPerBundle(s, o) - metresInStock(s, o.id) - metresInTransit(s, o.id);
  return Math.max(0, Math.ceil(need / ROLL_METRES - 1e-9));
}

/** CMT: the buyer's fabric arrives with the order (good rolls, one spare). */
export function deliverBuyerFabric(s: GameState, o: Order): void {
  const metres = Math.ceil(o.qty / s.tuning.bundleSize) * metresPerBundle(s, o);
  const rolls = Math.ceil(metres / ROLL_METRES) + 1;
  for (let i = 0; i < rolls; i++) s.warehouse.push({ id: s.nextId++, orderId: o.id, metres: ROLL_METRES, condition: 'good', rejected: false, supplier: 'buyer', dry: true });
}

export function buyFabric(s: GameState, supplierId: string, orderId: number, rolls: number): string | null {
  const sup = SUPPLIERS[supplierId];
  const o = orderById(s, orderId);
  if (!sup) return 'Unknown supplier.';
  if (!o || o.mode !== 'fob') return 'That order does not need fabric from you.';
  if (rolls < 1 || rolls > 200) return 'Order between 1 and 200 rolls.';
  const cost = rolls * sup.price;
  if (s.cash < cost) return `Not enough cash: ${rolls} rolls cost $${cost}.`;
  s.cash -= cost;
  s.ledger.materials += cost;
  const late = chance(s.rng, sup.late);
  s.shipments.push({
    id: s.nextId++,
    supplier: sup.id,
    orderId,
    rolls,
    cost,
    arriveDay: s.day + sup.leadDays + (late ? sup.lateDays : 0),
    arriveMinute: 10 * 60,
    delayed: late,
    wrongColour: chance(s.rng, sup.wrongColour),
    status: 'transit',
  });
  return null;
}

/** Shipments arrive at 10:00; the fabric then waits for inspection. */
export function stepShipments(s: GameState, events: SimEvent[]): void {
  for (const sh of s.shipments) {
    if (sh.status !== 'transit') continue;
    const sup = SUPPLIERS[sh.supplier]!;
    if (sh.delayed && s.day === sh.arriveDay - sup.lateDays && s.minute === sh.arriveMinute) {
      events.push({ kind: 'note', text: `Customs hold: the ${sup.name} fabric arrives a day late.` });
    }
    if (s.day < sh.arriveDay || (s.day === sh.arriveDay && s.minute < sh.arriveMinute)) continue;
    sh.status = 'arrived';
    for (let i = 0; i < sh.rolls; i++) {
      let condition: RollCondition = 'good';
      if (sh.wrongColour || chance(s.rng, sup.offShade)) condition = 'offShade';
      else if (chance(s.rng, sup.flawed)) condition = 'flawed';
      s.warehouse.push({ id: s.nextId++, orderId: sh.orderId, metres: ROLL_METRES, condition, rejected: false, supplier: sh.supplier, dry: s.pallets });
    }
    const d = pushDecision(s, {
      kind: 'fabric',
      title: `${sh.rolls} rolls from ${sup.name}`,
      body: `The truck is at the gate.${sh.wrongColour ? ' The colour looks… different from the swatch.' : ''} Inspect the rolls before they reach the cutting table?`,
      options: [
        { id: 'play', label: 'Inspect them yourself (15 s)', detail: 'Tap the bad rolls as they unroll' },
        { id: 'cutter', label: 'Let the cutter check them', detail: 'Catches most bad rolls, misses some' },
        { id: 'skip', label: 'Cut straight away', detail: 'Bad rolls become defects' },
      ],
      shipmentId: sh.id,
      orderId: sh.orderId,
    });
    events.push({ kind: 'decision', id: d.id });
  }
}

export function shipmentRolls(s: GameState, shipmentId: number): Roll[] {
  const sh = s.shipments.find((x) => x.id === shipmentId);
  if (!sh) return [];
  return s.warehouse.filter((r) => r.orderId === sh.orderId && r.supplier === sh.supplier).slice(-sh.rolls);
}

/** Reject rolls after inspection; the supplier refunds rolls that really were bad. */
export function rejectRolls(s: GameState, rolls: Roll[]): number {
  let refund = 0;
  for (const r of rolls) {
    if (r.rejected) continue;
    r.rejected = true;
    if (r.condition !== 'good' && r.supplier !== 'buyer') refund += SUPPLIERS[r.supplier]?.price ?? 0;
  }
  s.cash += refund;
  s.ledger.materials -= refund;
  return refund;
}

export function inspectByCutter(s: GameState, shipmentId: number): Roll[] {
  const cutter = s.workers
    .filter((w) => !w.absent)
    .reduce((best, w) => Math.max(best, w.skill.cutting), 0.4);
  const p = Math.min(0.95, s.tuning.cutterCatch * (cutter / 0.75));
  return shipmentRolls(s, shipmentId).filter((r) => r.condition !== 'good' && chance(s.rng, p));
}

/** The cutting table serves every line: it cuts for the active order with the smallest buffer. */
export function stepCutting(s: GameState, st: Station): void {
  const w = workerById(s, st.workerId);
  if (!w || w.arriveAt > s.minute || w.absent) return;
  if (!st.current) {
    const candidates = s.lines
      .map((_, i) => activeOrder(s, i))
      .filter((o): o is Order => !!o && o.status === 'active' && o.uncut > 0 && o.sampled && metresInStock(s, o.id) >= metresPerBundle(s, o) - 1e-6)
      .sort((a, b) => a.cut - b.cut);
    const o = candidates[0];
    if (!o) return;
    st.current = { id: s.nextId++, orderId: o.id, pieces: s.tuning.bundleSize, done: 0, defects: 0, origins: {}, rework: false, pAcc: 0 };
  }
  const b = st.current;
  const rate = (w.skill.cutting * (1 - s.tuning.fatigueSpeed * w.fatigue)) / CUT_OP.smv;
  b.done += rate;
  st.output += Math.min(rate, b.pieces);
  if (b.done < b.pieces) return;
  st.current = null;
  const o = orderById(s, b.orderId);
  if (!o) return;
  const condition = consumeFabric(s, o, metresPerBundle(s, o));
  o.uncut -= 1;
  o.cut += 1;
  o.cutFabric.push(condition);
}

/** Take metres from the order's rolls (oldest first); the bundle inherits the worst roll it touched. */
function consumeFabric(s: GameState, o: Order, metres: number): RollCondition {
  let left = metres;
  let worst: RollCondition = 'good';
  const rank: Record<RollCondition, number> = { good: 0, flawed: 1, offShade: 2 };
  for (const r of s.warehouse) {
    if (left <= 1e-9) break;
    if (r.orderId !== o.id || r.rejected || r.metres <= 0) continue;
    const take = Math.min(r.metres, left);
    r.metres -= take;
    left -= take;
    if (rank[r.condition] > rank[worst]) worst = r.condition;
  }
  s.warehouse = s.warehouse.filter((r) => r.metres > 1e-9 || r.rejected);
  return worst;
}

/** Pieces scrapped for fabric defects are cut again from new fabric. */
export function scrapForRecut(s: GameState, o: Order, pieces: number): void {
  // round up to whole bundles so a handful of scrapped pieces never blocks the order
  o.recutPieces += pieces;
  const bundles = Math.ceil(o.recutPieces / s.tuning.bundleSize);
  o.uncut += bundles;
  o.recutPieces = 0;
  if (!has(s, 'cutting')) o.cut = Math.max(o.cut, o.uncut);
}

export function rollsSummary(s: GameState, orderId: number): { rolls: number; metres: number; bad: number } {
  const rs = s.warehouse.filter((r) => r.orderId === orderId && !r.rejected && r.metres > 0);
  return { rolls: rs.length, metres: Math.round(rs.reduce((a, r) => a + r.metres, 0)), bad: rs.filter((r) => r.condition !== 'good').length };
}

export const _test = { consumeFabric, rand };
export type { Bundle };
