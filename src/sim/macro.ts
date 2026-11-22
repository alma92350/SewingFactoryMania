/**
 * Chapter 7 (PRD §11, "The Storm from the North"): the macro shock and diversification.
 * The shock cuts what a buyer still wants; new markets cost money up front and send faxes later;
 * Má's advice decides whether people may be laid off.
 */
import { BUYERS } from '../data/buyers';
import { MARKET_BY_ID } from '../data/markets';
import { PRODUCTS } from '../data/products';
import { removeWorker } from './morale';
import { pushDecision, pushFamily2 } from './orders';
import { chapterOf, has } from './selectors';
import type { GameState, SimEvent } from './types';

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** The buyer cancels `cutPct`% of what is not yet sewn on every open order. */
export function macroShock(s: GameState, buyer: string, cutPct: number, text: string, events: SimEvent[]): void {
  const b = s.tuning.bundleSize;
  let cutPieces = 0;
  for (const o of s.orders) {
    if (o.buyer !== buyer || (o.status !== 'active' && o.status !== 'queued')) continue;
    if (o.status === 'queued') {
      const remove = Math.floor((o.qty * cutPct) / 100 / b) * b;
      o.qty -= remove;
      cutPieces += remove;
      continue;
    }
    // active: only bundles not yet released to the line can be cancelled
    let bundles = Math.floor(((o.uncut + o.cut) * cutPct) / 100);
    const fromUncut = Math.min(bundles, o.uncut);
    o.uncut -= fromUncut;
    bundles -= fromUncut;
    const fromCut = Math.min(bundles, o.cut);
    o.cut -= fromCut;
    o.cutFabric.splice(0, fromCut);
    const removed = (fromUncut + fromCut) * b;
    o.qty -= removed;
    cutPieces += removed;
  }
  s.macro = { day: s.day, buyer, cutPieces };
  for (const w of s.workers) w.morale = clamp01(w.morale - 0.05);
  events.push({ kind: 'note', text });
  pushFamily2(s);
}

/** Start looking for customers in a new market. Returns an error, or null. */
export function prospect(s: GameState, market: string): string | null {
  if (!has(s, 'diversify')) return 'Not in this chapter.';
  const m = MARKET_BY_ID[market];
  if (!m) return 'Unknown market.';
  if (s.prospects.some((p) => p.market === market)) return 'You are already talking to them.';
  if (s.day + m.delay > chapterOf(s).days - 2) return 'Too late in the year for a new customer.';
  if (s.cash < m.cost) return `Not enough cash: it costs $${m.cost}.`;
  s.cash -= m.cost;
  s.ledger.materials += m.cost;
  s.prospects.push({ market, day: s.day + m.delay, sent: false });
  return null;
}

/** At 07:00, prospects that are due send their first fax. */
export function prospectFaxes(s: GameState, events: SimEvent[]): void {
  if (!has(s, 'diversify') || s.minute !== s.tuning.shiftStart) return;
  const days = chapterOf(s).days;
  for (const p of s.prospects) {
    if (p.sent || p.day !== s.day) continue;
    p.sent = true;
    const m = MARKET_BY_ID[p.market]!;
    const product = PRODUCTS[m.product]!;
    const options = m.options.map((q) => ({ label: q.label, qty: q.qty, price: q.price, dueDay: Math.min(days, s.day + q.dueIn) }));
    const fax = { tag: `mk-${m.id}`, buyer: m.buyer, product: m.product, text: m.faxText, optional: true, sample: m.sample, fob: m.fob, options };
    const d = pushDecision(s, {
      kind: 'fax',
      title: `Fax from ${BUYERS[m.buyer]!.name}`,
      body: m.faxText,
      fax,
      options: [
        ...options.map((q, k) => ({ id: String(k), label: `${q.label}: ${q.qty.toLocaleString('en')} ${product.plural}`, detail: `$${q.price.toFixed(2)}/dozen · vessel on day ${q.dueDay} · $${Math.round((q.qty / 12) * q.price)}` })),
        { id: 'decline', label: 'Decline politely' },
      ],
    });
    events.push({ kind: 'decision', id: d.id });
  }
}

/** New customers whose orders shipped on time. */
export function newCustomers(s: GameState): number {
  return new Set(s.orders.filter((o) => o.tag.startsWith('mk-') && o.status === 'shipped' && o.onTime === true).map((o) => o.buyer)).size;
}

/** Remaining work (pieces) per line. */
function lineWork(s: GameState, line: number): number {
  return s.orders.filter((o) => o.line === line && (o.status === 'active' || o.status === 'queued')).reduce((a, o) => a + o.qty - o.finished, 0);
}

/** Má's advice: "keep" (no layoffs, morale up) or "shrink" (close the emptiest line). */
export function masAdvice(s: GameState, choice: string, events: SimEvent[]): void {
  if (choice === 'keep') {
    for (const w of s.workers) w.morale = clamp01(w.morale + 0.1);
    return;
  }
  let line = 0;
  let least = Infinity;
  s.lines.forEach((_, i) => {
    const work = lineWork(s, i);
    if (work < least) {
      least = work;
      line = i;
    }
  });
  const leaving = s.workers.filter((w) => w.station !== null && s.stations[w.station]!.line === line && w.role !== 'leader');
  for (const w of leaving) {
    const severance = Math.round(w.wage * 5 * 100) / 100;
    s.cash -= severance;
    s.ledger.wages += severance;
    removeWorker(s, w);
  }
  s.stats.layoffs += leaving.length;
  // the bank sees costs fall and lends again (repaid after the campaign, outside the game)
  s.cash += 500;
  for (const w of s.workers) w.morale = clamp01(w.morale - 0.1);
  events.push({ kind: 'note', text: `${s.lines[line]!.name} is closed. ${leaving.length} people go home with a week’s pay.` });
}

/** Letting someone go: counted as a layoff; refused after promising Má. */
export function layoffBlocked(s: GameState): boolean {
  return s.chapterId === 'ch7' && s.campaign['ch7.ma'] === 'keep';
}
