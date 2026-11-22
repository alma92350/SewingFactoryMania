import { BUYERS } from '../data/buyers';
import { PRODUCTS } from '../data/products';
import { stepAgents } from './agents';
import { stepShipments } from './sourcing';
import { checkOrders, pushDecision, pushFamily, shipOrder } from './orders';
import { generateApplicants } from './people';
import { stepStation } from './production';
import { actionable, chapterOf, dailyWages, has, isLunch, lineEfficiency, shiftEndMinute, workerById } from './selectors';
import { emptyLedger } from './state';
import type { GameState, SimEvent } from './types';

/**
 * Advance the world by one game minute. System order is part of the contract:
 * script → orders (ship / inspect / cut-off) → agents → sewing → clock.
 * A pending decision freezes the world until it is resolved (the UI pauses on it too).
 */
export function step(s: GameState): SimEvent[] {
  const events: SimEvent[] = [];
  if (s.phase !== 'shift' || s.decisions.length > 0) return events;
  const t = s.tuning;

  fireScript(s, events);
  if (has(s, 'sourcing')) stepShipments(s, events);
  if (s.decisions.length > 0) return events;
  checkOrders(s, events);
  if (s.decisions.length > 0) return events;

  if (s.minute === t.lunchStart) {
    events.push({ kind: 'lunch', start: true });
    for (const w of s.workers) w.fatigue = Math.max(0, w.fatigue - t.lunchRecovery);
  }
  if (s.minute === t.lunchEnd) events.push({ kind: 'lunch', start: false });

  stepAgents(s, events);
  const lunch = isLunch(s);
  if (!lunch) {
    for (const st of s.stations) stepStation(s, st, events);
    s.stats.dayMinutes += 1;
    if (!actionable(s)) s.stats.quietMinutes += 1;
  }

  s.minute += 1;
  if (s.minute >= shiftEndMinute(s)) endShift(s, events);
  return events;
}

function fireScript(s: GameState, events: SimEvent[]): void {
  const script = chapterOf(s).script;
  script.forEach((e, i) => {
    if (s.firedEvents.includes(i) || e.day !== s.day || e.minute > s.minute) return;
    s.firedEvents.push(i);
    if (e.kind === 'fax') {
      if (e.fax.requires) {
        const [k, v] = e.fax.requires.split('=');
        if (s.campaign[k!] !== v) return;
      }
      const product = PRODUCTS[e.fax.product]!;
      const d = pushDecision(s, {
        kind: 'fax',
        title: `Fax from ${BUYERS[e.fax.buyer]!.name}`,
        body: e.fax.text,
        fax: e.fax,
        options: [
          ...e.fax.options.map((q, k) => ({
            id: String(k),
            label: `${q.label}: ${q.qty.toLocaleString('en')} ${product.plural}`,
            detail: `$${q.price.toFixed(2)}/dozen · vessel on day ${q.dueDay} · $${Math.round((q.qty / 12) * q.price)}`,
          })),
          ...(e.fax.optional ? [{ id: 'decline', label: 'Decline politely' }] : []),
        ],
      });
      events.push({ kind: 'decision', id: d.id });
    } else if (e.kind === 'absent') {
      const w = workerById(s, e.worker);
      if (!w) return;
      if (w.station !== null) s.stations[w.station]!.workerId = null;
      w.station = null;
      w.absent = true;
      events.push({ kind: 'note', text: e.text });
    } else if (e.kind === 'change') {
      const o = s.orders.find((q) => q.tag === e.tag && (q.status === 'active' || q.status === 'queued'));
      if (!o) return;
      const d = pushDecision(s, {
        kind: 'change',
        title: `${BUYERS[o.buyer]!.contact}: one more thing`,
        body: e.text,
        orderId: o.id,
        addPct: e.addPct,
        options: [
          { id: 'accept', label: `Accept: +${e.addPct}%, same vessel`, detail: 'More money if you make it' },
          { id: 'delay', label: 'Accept if she gives one more day', detail: 'She agrees, but cuts $0.30/dozen' },
        ],
      });
      events.push({ kind: 'decision', id: d.id });
    }
  });
}

function endShift(s: GameState, events: SimEvent[]): void {
  s.phase = 'report';
  events.push({ kind: 'shiftEnd' });
  if (has(s, 'orders')) {
    const wages = dailyWages(s);
    const premium = s.overtime ? wages * ((s.tuning.overtimeEnd - s.tuning.shiftEnd) / 540) * s.tuning.overtimeWagePremium : 0;
    const wageCost = Math.round((wages + premium) * 100) / 100;
    const rent = chapterOf(s).rent;
    const electricity = Math.round(s.stations.filter((st) => st.machine !== 'qc').length * s.tuning.electricityPerMachine * 100) / 100;
    s.ledger.wages += wageCost;
    s.ledger.rent += rent;
    s.ledger.electricity += electricity;
    s.cash = Math.round((s.cash - wageCost - rent - electricity) * 100) / 100;
    if (s.overtime) s.stats.overtimeDays += 1;
    s.negativeDays = s.cash < 0 ? s.negativeDays + 1 : 0;
  }
  s.history.push({
    day: s.day,
    ledger: { ...s.ledger },
    cash: s.cash,
    pieces: s.stats.dayPieces,
    breakdowns: s.stats.dayBreakdowns,
    efficiency: lineEfficiency(s),
  });
  if (s.negativeDays >= s.tuning.bankruptDays) {
    s.failed = 'bankrupt';
    s.phase = 'done';
  }
}

/** "Sleep until 07:00": the night passes, and the next shift starts (or the chapter ends). */
export function endDay(s: GameState): void {
  if (s.phase !== 'report') return;
  const ch = chapterOf(s);
  if (s.day >= ch.days) {
    // the chapter ends: whatever is still on the floor ships short
    for (const o of s.orders) if (o.status === 'active' || o.status === 'queued') shipOrder(s, o, [], true);
    if (s.loan > 0) {
      s.cash -= s.loan;
      s.loan = 0;
    }
    s.phase = 'done';
    if (ch.family?.when === 'end') pushFamily(s);
    return;
  }
  s.day += 1;
  s.minute = s.tuning.shiftStart;
  s.overtime = false;
  s.phase = 'shift';
  s.ledger = emptyLedger();
  s.stats.dayBreakdowns = 0;
  s.stats.dayPieces = 0;
  for (const st of s.stations) {
    st.output = 0;
    st.serviceUntil = 0; // clock values restart each morning
  }
  for (const w of s.workers) {
    w.fatigue *= 1 - s.tuning.nightRecovery;
    if (w.absent) {
      w.absent = false;
      w.station = null;
    }
    w.arriveAt = s.minute;
    w.leftAt = s.minute;
    w.from = w.station;
  }
  for (const a of s.agents) {
    a.target = null;
    a.task = null;
    a.until = 0;
    a.pos = -1;
  }
  s.repairQueue = s.stations.filter((st) => st.broken && s.agents.some((a) => a.kind === 'mechanic')).map((st) => st.index);
  if (has(s, 'hiring')) s.applicants = generateApplicants(s);
}

/** Run until the chapter is done, calling `each` before every minute (the bot hooks in here). */
export function runChapter(s: GameState, each?: (s: GameState) => void, maxSteps = 200000): SimEvent[] {
  const all: SimEvent[] = [];
  for (let i = 0; i < maxSteps && s.phase !== 'done'; i++) {
    each?.(s);
    if (s.phase === 'report' && s.decisions.length === 0) {
      endDay(s);
      continue;
    }
    all.push(...step(s));
  }
  return all;
}

/** Run until the current shift ends (or a minute limit). */
export function runShift(s: GameState, each?: (s: GameState) => void, until = Infinity): SimEvent[] {
  const all: SimEvent[] = [];
  let guard = 0;
  while (s.phase === 'shift' && s.minute < until && guard++ < 5000) {
    each?.(s);
    all.push(...step(s));
  }
  return all;
}
