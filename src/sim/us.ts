/**
 * Part II, Chapter 8 ("The American Order", 2002): the US–Vietnam trade agreement brings American
 * buyers, and with them two systems.
 *  - US export quota: every American order needs quota, bought per dozen. Its price drifts every
 *    night; buy early (cheap, risky) or late (dear). At the cut-off, a broker sells it at +50%.
 *  - Compliance audits: the buyer's auditor checks a code of conduct. Failing costs money on every
 *    open American order and brings a second visit.
 */
import { BUYERS } from '../data/buyers';
import { rand } from '../core/rng';
import { pushDecision } from './orders';
import { has, orderById } from './selectors';
import type { GameState, Order, SimEvent } from './types';

export const US_BUYERS = ['atlantic'];

export function needsQuota(s: GameState, o: Order): boolean {
  return has(s, 'quota') && US_BUYERS.includes(o.buyer) && !o.quotaPaid;
}

export function quotaCost(s: GameState, o: Order, broker = false): number {
  const price = (s.quota?.price ?? 1) * (broker ? 1.5 : 1);
  return Math.round((o.qty / 12) * price);
}

/** Buy the quota for one American order at today's price. */
export function buyQuota(s: GameState, orderId: number): string | null {
  if (!has(s, 'quota') || !s.quota) return 'No quota in this chapter.';
  const o = orderById(s, orderId);
  if (!o || !US_BUYERS.includes(o.buyer)) return 'This order needs no quota.';
  if (o.quotaPaid) return 'Quota already bought.';
  const cost = quotaCost(s, o);
  if (s.cash < cost) return `Not enough cash: it costs $${cost}.`;
  s.cash -= cost;
  s.ledger.materials += cost;
  o.quotaPaid = true;
  return null;
}

/** At shipping time: an American order without quota buys it from a broker. */
export function brokerQuota(s: GameState, o: Order, events: SimEvent[]): void {
  if (!needsQuota(s, o)) return;
  const cost = quotaCost(s, o, true);
  s.cash -= cost;
  s.ledger.penalties += cost;
  o.quotaPaid = true;
  events.push({ kind: 'note', text: `No quota for ${BUYERS[o.buyer]!.contact}’s order: a broker sold it for $${cost}.` });
}

/** Every night the quota price moves; on day 4 the category is nearly used up and brokers raise it. */
export function nightlyQuota(s: GameState): void {
  if (!s.quota) return;
  const q = s.quota;
  q.history.push(q.price);
  const drift = s.day === 3 ? 0.35 : -0.1 + rand(s.rng) * 0.24;
  q.price = Math.round(Math.max(0.6, Math.min(3.5, q.price * (1 + drift))) * 100) / 100;
}

// ───────────────────────────── compliance

export const AUDIT_CHECKS: { id: string; text: string }[] = [
  { id: 'overtime', text: 'No more than two overtime evenings' },
  { id: 'exits', text: 'Fire exits clear: at most 30 rolls in the warehouse' },
  { id: 'water', text: 'Clean water and a first-aid corner' },
  { id: 'fans', text: 'Fans on the floor' },
  { id: 'fatigue', text: 'Nobody exhausted' },
  { id: 'voice', text: 'Workers interviewed in private say they are treated fairly' },
];

export function auditChecks(s: GameState): Record<string, boolean> {
  const morale = s.workers.reduce((a, w) => a + w.morale, 0) / Math.max(1, s.workers.length);
  return {
    overtime: s.stats.overtimeDays <= 2,
    exits: s.warehouse.filter((r) => !r.rejected).length <= 30,
    water: s.welfare.water,
    fans: s.welfare.fans,
    fatigue: s.workers.every((w) => w.fatigue < 0.75),
    voice: morale >= 0.6,
  };
}

/** The auditor's visit (scripted). A second visit only happens after a failed first one. */
export function runAudit(s: GameState, events: SimEvent[]): void {
  if (!s.audit) return;
  const a = s.audit;
  if (a.visits > 0 && a.passed) return;
  const checks = auditChecks(s);
  const score = Object.values(checks).filter(Boolean).length;
  const passed = score >= 5;
  a.visits += 1;
  a.score = score;
  a.passed = passed;
  if (a.visits === 1) a.firstPassed = passed;
  if (!passed) {
    for (const o of s.orders) if (US_BUYERS.includes(o.buyer) && (o.status === 'active' || o.status === 'queued')) o.discount = Math.max(o.discount, 0.1);
  }
  const failed = AUDIT_CHECKS.filter((c) => !checks[c.id]).map((c) => c.text);
  const d = pushDecision(s, {
    kind: 'info',
    title: passed ? 'Audit PASSED' : 'Audit FAILED',
    body: passed
      ? `The auditor from Atlantic Outfitters checked the code of conduct: ${score} of 6. “Thank you. We will keep ordering.”`
      : `The auditor from Atlantic Outfitters checked the code of conduct: ${score} of 6 (5 needed). Open American orders lose 10% for a corrective action plan, and she will come back on day 6.${failed.length ? ` Failed: ${failed.join('; ')}.` : ''}`,
    options: [{ id: 'ok', label: passed ? 'Good' : 'We will fix it' }],
  });
  events.push({ kind: 'decision', id: d.id });
}
