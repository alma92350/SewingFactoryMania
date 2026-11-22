import { SUPPLIERS } from '../data/suppliers';
import { activateOrder, applySampleResult, lineCanMake, resolveDecision } from './orders';
import { buyFabric, rollsToBuy } from './sourcing';
import { dailyWages, has } from './selectors';
import type { GameState, SimEvent } from './types';

/**
 * The office (Chapter 6): a Production Planner and a Merchandiser take routine work off the
 * director, so the player's workload stays flat while the factory grows (PRD §13, D11).
 */

export function present(s: GameState, role: 'planner' | 'merchandiser'): boolean {
  return s.workers.some((w) => w.role === role && !w.absent);
}

/** Buy the missing rolls: Korean fabric when there is time, the local mill when there is not. Shared with the bot. */
export function buyMissingFabric(s: GameState, spare = 4): number {
  let bought = 0;
  for (const o of s.orders) {
    const need = rollsToBuy(s, o);
    if (need <= 0) continue;
    const supplier = o.dueDay - s.day >= 7 ? 'daegu' : 'binhminh';
    const reserve = (dailyWages(s) + 20) * 2;
    const price = SUPPLIERS[supplier]!.price;
    for (let n = need + spare; n >= 1; n--) {
      if (s.cash - n * price < reserve) continue;
      if (buyFabric(s, supplier, o.id, n) === null) {
        bought += 1;
        break;
      }
    }
  }
  return bought;
}

/** Runs every minute before the world checks for open cards. */
export function officeWork(s: GameState, events: SimEvent[]): void {
  const merch = has(s, 'merchandising') && present(s, 'merchandiser');
  const plan = has(s, 'planning') && present(s, 'planner');
  if (!merch && !plan) return;

  // answering one card can open another (a fax opens the sample card): loop a few times
  for (let pass = 0; pass < 5; pass++) {
    const before = s.decisions.length;
    officeCards(s, events, merch, plan);
    if (s.decisions.length === before) break;
  }
  officeRoutines(s, plan);
}

function officeCards(s: GameState, events: SimEvent[], merch: boolean, plan: boolean): void {
  for (const d of [...s.decisions]) {
    if (merch && d.kind === 'fax' && d.fax) {
      const n = d.fax.options.length;
      const option = d.fax.optional && !s.policy.extras ? 'decline' : String(Math.min(n - 1, n === 1 ? 0 : s.policy.quote));
      resolveDecision(s, d.id, option, events);
    } else if (merch && d.kind === 'change') resolveDecision(s, d.id, 'accept', events);
    else if (merch && d.kind === 'sample') {
      const o = s.orders.find((x) => x.id === d.orderId);
      if (o) applySampleResult(o, 2);
      s.decisions = s.decisions.filter((x) => x.id !== d.id);
    } else if (plan && d.kind === 'marker') resolveDecision(s, d.id, 'auto', events);
    else if (plan && d.kind === 'fabric') resolveDecision(s, d.id, 'cutter', events);
  }
}

function officeRoutines(s: GameState, plan: boolean): void {
  if (plan && s.minute % 30 === 0) {
    buyMissingFabric(s, 3);
    // an idle line takes a queued order from a busy one, if it has the machines for it
    s.lines.forEach((line, i) => {
      if (line.activeOrderId !== null) return;
      const o = s.orders.find((x) => x.status === 'queued' && x.line !== i && lineCanMake(s, i, x.product));
      if (o) {
        o.line = i;
        activateOrder(s, o);
      }
    });
  }
}
