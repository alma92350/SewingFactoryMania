/**
 * Part II, Chapter 10 ("Our Own Label", 2008): the domestic brand. You choose a collection, buy its
 * fabric and sew it between export orders; every night your shops in Saigon sell what is finished,
 * depending on price, quality, the label's name and advertising. What is left at the end goes on sale.
 */
import { BUYERS } from '../data/buyers';
import { PRODUCTS } from '../data/products';
import { rand } from '../core/rng';
import { createOrder, pushDecision } from './orders';
import { has } from './selectors';
import type { GameState, SimEvent } from './types';

export interface CollectionDef {
  id: string;
  product: string;
  label: string;
  text: string;
  qty: number;
  /** Shop price per piece (USD). */
  retail: number;
  /** Pieces the shops can sell per night at the normal price. */
  demand: number;
}

export const COLLECTIONS: CollectionDef[] = [
  { id: 'shirt', product: 'shirt', label: 'Office shirts', text: 'Steady sellers for the new office workers of Saigon.', qty: 1200, retail: 6, demand: 230 },
  { id: 'polo', product: 'polo', label: 'Weekend polos', text: 'Young people, motorbikes, cafés: they sell fast at the right price.', qty: 950, retail: 6.5, demand: 190 },
  { id: 'padded', product: 'padded', label: 'Winter jackets', text: 'For the cold Hà Nội winter: dear to make, dear to sell.', qty: 450, retail: 16, demand: 85 },
];

/** Shops keep this share of the shop price (Má's old friends, who run the shops for "Sài Gòn 1979", take less). */
export const SHOP_CUT = 0.3;
export function shopCut(s: GameState): number {
  return s.campaign['ch10.name'] === 'lan' ? SHOP_CUT : 0.2;
}
export const AD_COST = 80;
export const MARKDOWN = 0.4;
/** The Saigon mill's price for the label's fabric. */
export const FABRIC_PER_METRE = 1.5;

export function brandStock(s: GameState): number {
  const b = s.brand;
  if (!b) return 0;
  const o = s.orders.find((x) => x.id === b.orderId);
  const made = o ? (o.status === 'active' || o.status === 'queued' ? o.finished : o.shippedPieces) : 0;
  return Math.max(0, made - b.sold - b.markdownSold);
}

/** Push the collection card (day 1). */
export function pushCollection(s: GameState, events: SimEvent[]): void {
  const d = pushDecision(s, {
    kind: 'brand',
    title: 'Your first collection',
    body: 'Your own label, sewn in your own factory, sold in your own shops on Lê Lợi street. A Saigon mill delivers the fabric at once and is paid at the end of the season; the shops pay you as they sell. What will the first collection be?',
    options: COLLECTIONS.map((c) => ({ id: c.id, label: `${c.label}: ${c.qty} pieces at $${c.retail.toFixed(2)}`, detail: `${c.text} Fabric: $${Math.round(c.qty * PRODUCTS[c.product]!.metres * FABRIC_PER_METRE)}` })),
  });
  events.push({ kind: 'decision', id: d.id });
}

export function chooseCollection(s: GameState, id: string): void {
  const c = COLLECTIONS.find((x) => x.id === id) ?? COLLECTIONS[0]!;
  const name = s.campaign['ch10.name'] === 'lan' ? 'Lan & Co.' : 'Sài Gòn 1979';
  BUYERS.ownlabel = { ...BUYERS.ownlabel!, name };
  // the label's fabric comes from a Saigon mill, delivered at once; the mill is paid at the end of the season
  const fabric = Math.round(c.qty * PRODUCTS[c.product]!.metres * FABRIC_PER_METRE);
  s.loan += fabric;
  const o = createOrder(s, { tag: 'brand', buyer: 'ownlabel', product: c.product, qty: c.qty, price: 0, dueDay: 99 });
  s.brand = { collection: c.id, orderId: o.id, sold: 0, revenue: 0, priceLevel: 0, adUntil: 0, markdownSold: 0, soldToday: 0, adsBought: 0 };
}

export function setPrice(s: GameState, level: number): string | null {
  if (!has(s, 'brand') || !s.brand) return 'No label yet.';
  s.brand.priceLevel = Math.max(-1, Math.min(1, Math.round(level)));
  return null;
}

export function advertise(s: GameState): string | null {
  if (!has(s, 'brand') || !s.brand) return 'No label yet.';
  if (s.brand.adUntil > s.day) return 'Your advertisement is still running.';
  if (s.cash < AD_COST) return `Not enough cash: it costs $${AD_COST}.`;
  s.cash -= AD_COST;
  s.ledger.materials += AD_COST;
  s.brand.adUntil = s.day + 2;
  s.brand.adsBought += 1;
  return null;
}

export function retailPrice(s: GameState): number {
  const b = s.brand!;
  const c = COLLECTIONS.find((x) => x.id === b.collection)!;
  const nameMul = s.campaign['ch10.name'] === 'lan' ? 1.15 : 1;
  return Math.round(c.retail * nameMul * [0.85, 1, 1.15][b.priceLevel + 1]! * 100) / 100;
}

/** Tonight's demand before stock: price, name, advertising, quality and the crisis. */
export function demandTonight(s: GameState): number {
  const b = s.brand!;
  const c = COLLECTIONS.find((x) => x.id === b.collection)!;
  const o = s.orders.find((x) => x.id === b.orderId);
  const defectShare = o && o.finished > 0 ? o.lotDefects / o.finished : 0;
  const name = s.campaign['ch10.name'] === 'lan' ? 0.85 : 1.3;
  const price = [1.3, 1, 0.75][b.priceLevel + 1]!;
  const ad = b.adUntil > s.day - 1 && b.adUntil >= s.day ? 1.4 : 1;
  const crisis = s.macro ? 0.9 : 1;
  return c.demand * name * price * ad * crisis * Math.max(0.5, 1 - defectShare * 3);
}

/** Every night the shops sell. On the last night, what is left goes on sale. */
export function nightlySales(s: GameState, events: SimEvent[], last: boolean): void {
  const b = s.brand;
  if (!b) return;
  const stock = brandStock(s);
  const noise = 0.85 + rand(s.rng) * 0.3;
  const sold = Math.min(stock, Math.round(demandTonight(s) * noise));
  const price = retailPrice(s);
  const income = Math.round(sold * price * (1 - shopCut(s)));
  b.sold += sold;
  b.soldToday = sold;
  b.revenue += income;
  s.cash += income;
  s.ledger.revenue += income;
  if (sold > 0) events.push({ kind: 'note', text: `Your shops sold ${sold} pieces tonight: +$${income}.` });
  if (last) {
    const left = brandStock(s);
    if (left > 0) {
      const sale = Math.round(left * price * MARKDOWN * (1 - shopCut(s)));
      b.markdownSold += left;
      b.revenue += sale;
      s.cash += sale;
      s.ledger.revenue += sale;
      events.push({ kind: 'note', text: `End-of-season sale: ${left} pieces at 60% off, +$${sale}.` });
    }
  }
}

/** Share of the collection sold at full price. */
export function fullPriceShare(s: GameState): number {
  const b = s.brand;
  if (!b) return 0;
  const c = COLLECTIONS.find((x) => x.id === b.collection)!;
  return b.sold / c.qty;
}
