import { BUYERS } from '../data/buyers';
import { PRODUCTS } from '../data/products';
import { stepAgents } from './agents';
import { stepShipments } from './sourcing';
import { planDay, stepPower, tickPower } from './power';
import { stepLeaders } from './leader';
import { officeWork } from './office';
import { bonusCost, morningSickness, nightlyMorale, nightlyQuits, tetReturns } from './morale';
import { checkOrders, lineCanMake, pushDecision, pushFamily, pushFamily2, shipOrder } from './orders';
import { sandboxFaxOptions } from '../data/generated';
import { macroShock, prospectFaxes } from './macro';
import { chance } from '../core/rng';
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
  if (s.closedToday) {
    s.minute = shiftEndMinute(s);
    endShift(s, events);
    return events;
  }

  fireScript(s, events);
  if (has(s, 'sourcing')) stepShipments(s, events);
  officeWork(s, events);
  if (s.decisions.length > 0) return events;
  checkOrders(s, events);
  if (s.decisions.length > 0) return events;

  if (s.minute === t.lunchStart) {
    events.push({ kind: 'lunch', start: true });
    for (const w of s.workers) w.fatigue = Math.max(0, w.fatigue - t.lunchRecovery * (s.welfare.canteen ? 2 : 1));
  }
  if (s.minute === t.lunchEnd) events.push({ kind: 'lunch', start: false });

  stepPower(s, events);
  if (s.decisions.length > 0) return events;
  stepAgents(s, events);
  stepLeaders(s);
  const lunch = isLunch(s);
  if (!lunch) {
    for (const st of s.stations) stepStation(s, st, events);
    s.stats.dayMinutes += 1;
    if (!actionable(s)) s.stats.quietMinutes += 1;
  }

  tickPower(s);
  s.minute += 1;
  if (s.minute >= shiftEndMinute(s)) endShift(s, events);
  return events;
}

function fireScript(s: GameState, events: SimEvent[]): void {
  const ch = chapterOf(s);
  if (ch.generator && s.minute === s.tuning.shiftStart && !s.firedEvents.includes(-s.day)) {
    s.firedEvents.push(-s.day);
    const products = Object.keys(PRODUCTS).filter((p) => s.lines.some((_, i) => lineCanMake(s, i, p)));
    const g = sandboxFaxOptions(s.seed, s.day, products, ch.faxPool, ch.priceMul, ch.qtyMul);
    const fax = { tag: `sb${s.day}`, buyer: g.buyer, product: g.product, fob: g.fob, text: `${BUYERS[g.buyer]!.contact} has work for you.`, optional: true, options: g.options };
    const d = pushDecision(s, {
      kind: 'fax',
      title: `Fax from ${BUYERS[g.buyer]!.name}`,
      body: fax.text,
      fax,
      options: [
        ...g.options.map((q, k) => ({ id: String(k), label: `${q.label}: ${q.qty.toLocaleString('en')} ${PRODUCTS[g.product]!.plural}`, detail: `$${q.price.toFixed(2)}/dozen · vessel on day ${q.dueDay} · $${Math.round((q.qty / 12) * q.price)}` })),
        { id: 'decline', label: 'Decline politely' },
      ],
    });
    events.push({ kind: 'decision', id: d.id });
  }
  prospectFaxes(s, events);
  const script = ch.script;
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
    } else if (e.kind === 'cat') {
      if (s.campaign.cat) return;
      const d = pushDecision(s, {
        kind: 'family',
        title: 'A mouse in the warehouse',
        body: 'The cutter found a nest in a roll of poplin. At lunch, a thin orange cat walks in from the street, sits by the fabric and looks at you.',
        flag: 'cat',
        options: [
          { id: 'adopt', label: 'Adopt the cat', detail: 'No more mice; the workers love her (a little morale every night from Chapter 5)' },
          { id: 'shoo', label: 'Shoo her away', detail: 'No cat on the floor; mice chew a roll now and then' },
        ],
      });
      events.push({ kind: 'decision', id: d.id });
    } else if (e.kind === 'shock') {
      macroShock(s, e.buyer, e.cutPct, e.text, events);
    } else if (e.kind === 'flood') {
      for (const sh of s.shipments) if (sh.status === 'transit') sh.arriveDay += 1;
      events.push({ kind: 'note', text: e.text });
      pushFamily(s);
    } else if (e.kind === 'bonus') {
      const d = pushDecision(s, {
        kind: 'bonus',
        title: 'The 13th-month bonus',
        body: 'Tết is coming. Every worker hopes for the 13th-month bonus to take home to their family in the provinces. Those who get it are much more likely to come back after the holiday.',
        options: [
          { id: 'pay', label: `Pay the bonus · $${bonusCost(s)}`, detail: 'Morale +20%, many more come back after Tết' },
          { id: 'no', label: 'Not this year', detail: 'Keep the cash; expect fewer to return' },
        ],
      });
      events.push({ kind: 'decision', id: d.id });
    } else if (e.kind === 'tet' || e.kind === 'family2') {
      pushFamily2(s);
      if (e.kind === 'tet') events.push({ kind: 'note', text: 'Chúc mừng năm mới! Tết has come.' });
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
    const tetDouble = s.tet?.volunteers && s.day === chapterOf(s).tetDay ? 2 : 1;
    const wageCost = s.closedToday ? 0 : Math.round((wages * tetDouble + premium) * 100) / 100;
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
export function endDay(s: GameState): SimEvent[] {
  const events: SimEvent[] = [];
  if (s.phase !== 'report') return events;
  const ch = chapterOf(s);
  nightlyMorale(s, s.overtime);
  nightlyMice(s, events);
  if (ch.tetDay && s.day === ch.tetDay) tetReturns(s, events);
  else nightlyQuits(s, events);
  if (s.day >= ch.days) {
    // the chapter ends: whatever is still on the floor ships short
    for (const o of s.orders) if (o.status === 'active' || o.status === 'queued') shipOrder(s, o, [], true);
    if (s.loan > 0) {
      s.cash -= s.loan;
      s.loan = 0;
    }
    s.phase = 'done';
    if (ch.family?.when === 'end') pushFamily(s);
    return events;
  }
  s.day += 1;
  s.minute = s.tuning.shiftStart;
  s.overtime = false;
  s.closedToday = false;
  if (s.tet) s.tet.volunteers = false;
  s.phase = 'shift';
  s.ledger = emptyLedger();
  s.stats.dayBreakdowns = 0;
  s.stats.dayPieces = 0;
  for (const st of s.stations) {
    st.output = 0;
    st.defects = 0;
    st.serviceUntil = 0; // clock values restart each morning
  }
  for (const w of s.workers) {
    w.fatigue *= 1 - s.tuning.nightRecovery;
    if (w.absent) {
      w.absent = false;
      w.sick = false;
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
  // after Tết, many people look for work in the city
  if (has(s, 'hiring')) s.applicants = generateApplicants(s, false, ch.tetDay && s.day === ch.tetDay + 1 ? 6 : 0);
  if (s.campaign['ch4.flood'] === 'help' && !s.campaign['ch4.bonus']) {
    // the neighbours you helped send their daughters to work for you
    s.campaign['ch4.bonus'] = 'given';
    for (const a of generateApplicants(s).slice(0, 2)) {
      for (const k of Object.keys(a.skill) as (keyof typeof a.skill)[]) a.skill[k] = Math.min(1, Math.round((a.skill[k] + 0.25) * 100) / 100);
      a.role = 'operator';
      a.note = 'Her family thanks you for helping in the flood.';
      s.applicants.unshift(a);
    }
  }
  planDay(s);
  morningSickness(s, events);
  return events;
}

/** Without a cat, a mouse sometimes chews a good roll in the warehouse at night. */
function nightlyMice(s: GameState, events: SimEvent[]): void {
  if (s.campaign.cat !== 'shoo' || !has(s, 'sourcing')) return;
  const good = s.warehouse.filter((r) => r.condition === 'good');
  if (!good.length || !chance(s.rng, 0.3)) return;
  good[0]!.condition = 'flawed';
  events.push({ kind: 'note', text: 'A mouse chewed a roll in the warehouse.' });
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
