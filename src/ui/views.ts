/** Pure view functions: state → HTML strings. The app shell decides what to show and when. */
import { BUYERS } from '../data/buyers';
import { CHAPTERS } from '../data/chapters';
import { DIFFICULTIES } from '../data/difficulty';
import { GLOSSARY, TIPS, type Tip } from '../data/handbook';
import { TRAITS } from '../data/people';
import { MACHINE_LABEL, PRODUCTS } from '../data/products';
import { starChecks, stars } from '../sim/objectives';
import {
  activeOrder,
  chapterOf,
  clockLabel,
  dailyWages,
  dayLabel,
  has,
  lineEfficiency,
  opDef,
  orderValue,
  projectedFinishDay,
  projectionToday,
  stationEfficiency,
  workerById,
} from '../sim/selectors';
import type { Decision, GameState, Order, Worker } from '../sim/types';
import { workerColor } from '../render/renderer';
import type { ViewState } from '../render/renderer';
import type { Progress } from './storage';
import { getLang, localTip } from './i18n';
import { ACHIEVEMENTS, careerTitle } from '../sim/meta';
import { bonusCost, welfareCount } from '../sim/morale';
import { CHAPTER_BY_ID } from '../data/chapters';
import { MODIFIERS } from '../data/generated';
import { SUPPLIERS } from '../data/suppliers';
import { MARKETS } from '../data/markets';
import { layoffBlocked, newCustomers } from '../sim/macro';
import { AUDIT_CHECKS, auditChecks, quotaCost } from '../sim/us';
import { FLIGHT_COST, SITE_NAME, sites } from '../sim/sites';
import { AD_COST, brandStock, COLLECTIONS, demandTonight, fullPriceShare, retailPrice } from '../sim/brand';
import { cosmeticsHtml, epilogue, epilogue2 } from './scrapbook';
import { metresInTransit, metresPerBundle, rollsSummary, rollsToBuy } from '../sim/sourcing';

export type Tab = 'line' | 'orders' | 'fabric' | 'team' | 'book';

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const money = (v: number) => `${v < 0 ? '−' : ''}$${Math.abs(Math.round(v)).toLocaleString('en')}`;

export function pips(v: number): string {
  const n = Math.max(0, Math.min(5, Math.round(v * 5)));
  return `<span class="pips" aria-label="${n} of 5">${'●'.repeat(n)}${'○'.repeat(5 - n)}</span>`;
}

function dot(w: Worker): string {
  return `<span class="dot" style="background:${workerColor(w)}"></span>`;
}

// ───────────────────────────── top bar

export function topbarHtml(s: GameState, speed: number, sound: boolean): string {
  const o = activeOrder(s);
  let goal = '';
  if (s.chapterId === 'ch0') {
    const proj = projectionToday(s);
    const target = 290;
    goal = `<div class="goal">${o?.finished ?? 0}/${target} <span class="proj ${proj >= target ? 'ok' : 'bad'}">→ ${proj}${proj >= target ? ' ✓' : ''}</span></div>`;
  } else if (o) {
    const day = projectedFinishDay(s, o);
    const ok = day <= o.dueDay;
    goal = `<div class="goal" title="Active order">${esc(BUYERS[o.buyer]!.contact)} ${o.finished}/${o.qty} <span class="proj ${ok ? 'ok' : 'bad'}">⛴ day ${o.dueDay}${ok ? ' ✓' : ' ✗'}</span></div>`;
  }
  if (s.lines.length > 1) {
    const parts = s.lines
      .map((_, i) => activeOrder(s, i))
      .filter((x): x is Order => !!x)
      .map((x) => {
        const ok = projectedFinishDay(s, x) <= x.dueDay;
        return `${esc(BUYERS[x.buyer]!.contact)} ${x.finished}/${x.qty} <span class="proj ${ok ? 'ok' : 'bad'}">⛴${x.dueDay}${ok ? '✓' : '✗'}</span>`;
      });
    goal = `<div class="goal">${parts.join(' · ')}</div>`;
  }
  const pw = s.power;
  const power = pw
    ? `<div class="power">${pw.rain ? '<span title="Rain today">☂</span>' : ''}${pw.off ? (pw.generator.running ? '<span class="gen">generator</span>' : '<span class="off">power cut</span>') : ''}</div>`
    : '';
  const cash = has(s, 'orders') ? `<div class="cash ${s.cash < 0 ? 'bad' : ''}" aria-label="Cash">${money(s.cash)}</div>` : '';
  const ot = s.overtime ? '<span class="ot">overtime</span>' : '';
  const where = s.director
    ? `<div class="where" aria-label="Where you are">${s.director.flightUntil > 0 ? `✈ <span>${esc(SITE_NAME[s.director.site] ?? s.director.site)}</span> ${clockLabel(s.director.flightUntil)}` : `📍 <span>${esc(SITE_NAME[s.director.site] ?? s.director.site)}</span>`}</div>`
    : '';
  return (
    `<button class="menu" data-action="title" aria-label="Menu">☰</button>` +
    `<div class="clock" aria-label="Time"><small>${dayLabel(s.day)}</small> ${clockLabel(Math.min(s.minute, s.overtime ? s.tuning.overtimeEnd : s.tuning.shiftEnd))}${ot}</div>` +
    cash +
    where +
    goal +
    power +
    `<div class="speeds" role="group" aria-label="Speed">` +
    [0, 1, 2, 4].map((v) => `<button data-action="speed" data-arg="${v}" aria-pressed="${speed === v}" aria-label="${v === 0 ? 'Pause' : `${v}× speed`}">${v === 0 ? '⏸' : `${v}×`}</button>`).join('') +
    `</div><button class="sound" data-action="sound" aria-pressed="${sound}" aria-label="Sound">${sound ? '♪' : '♪̸'}</button>`
  );
}

// ───────────────────────────── bottom panel

export function tabsHtml(s: GameState, tab: Tab): string {
  const tabs: [Tab, string, string][] = [['line', 'Line', '']];
  if (has(s, 'orders')) tabs.push(['orders', 'Orders', s.orders.some((o) => o.status === 'active' && projectedFinishDay(s, o) > o.dueDay) ? '!' : '']);
  if (has(s, 'sourcing')) tabs.push(['fabric', 'Fabric', s.orders.some((o) => rollsToBuy(s, o) > 0) ? '!' : '']);
  if (has(s, 'hiring')) {
    const seats = s.stations.filter((st) => st.opId !== null && st.workerId === null).length;
    tabs.push(['team', 'Team', seats > 0 && s.applicants.length ? String(seats) : '']);
  }
  tabs.push(['book', 'Handbook', '']);
  return `<div class="tabs" role="tablist">${tabs
    .map(([id, label, badge]) => `<button role="tab" data-action="tab" data-arg="${id}" aria-selected="${tab === id}">${label}${badge ? `<span class="badge">${badge}</span>` : ''}</button>`)
    .join('')}</div>`;
}

export function lineTabHtml(s: GameState, view: ViewState): string {
  const wid = view.selectedWorker;
  if (wid) {
    const w = workerById(s, wid)!;
    const known = Object.entries(w.learn)
      .filter(([id, v]) => v > s.tuning.learnStart + 0.01 && id !== 'qc')
      .slice(0, 4)
      .map(([id, v]) => `${opDef(id).name} ${Math.round(v * 100)}%`)
      .join(' · ');
    return (
      `<div class="row">${dot(w)}<b>${esc(w.name)}</b> <span class="muted">${esc(w.note)}</span></div>` +
      `<div class="row small">Lockstitch ${pips(w.skill.lockstitch)} Overlock ${pips(w.skill.overlock)} Buttonhole ${pips(w.skill.buttonhole)}${has(s, 'quality') ? ` QC ${pips(w.skill.qc)}` : ''}</div>` +
      (w.traits.length ? `<div class="row small">${w.traits.map((t) => `<span class="trait" title="${TRAITS[t].text}">${TRAITS[t].name}</span>`).join('')}</div>` : '') +
      `<div class="row muted small"><span>Knows:</span> ${known || 'nothing yet: new operations start at 50% speed'}${w.fatigue > 0.3 ? ` · tired ${Math.round(w.fatigue * 100)}%` : ''}</div>` +
      (has(s, 'morale') ? `<div class="row small">Morale ${moraleBar(w.morale)}</div>` : '') +
      (has(s, 'training') && w.role === 'operator' ? mentorHtml(s, w) : '') +
      `<div class="row hint">Now tap a machine to move ${esc(w.name)} there.</div>` +
      `<div class="row buttons">${w.station !== null ? `<button data-action="bench" data-arg="${w.id}">Send to bench</button>` : ''}<button data-action="close">Cancel</button></div>`
    );
  }
  const si = view.selectedStation;
  if (si !== null) {
    const st = s.stations[si]!;
    const w = workerById(s, st.workerId);
    const o = activeOrder(s, st.line);
    const opName = st.opId ? opDef(st.opId).name : 'Spare machine';
    const rate = w && st.opId ? Math.round((60 * stationEfficiency(s, st)) / opDef(st.opId).smv) : 0;
    const ops = st.machine === 'qc' || st.machine === 'cutting' || !o ? [] : PRODUCTS[o.product]!.ops.filter((x) => x.machine === st.machine);
    const fixing = s.repairQueue.includes(si) || s.agents.some((a) => a.target === si);
    const seatable = s.workers.filter((x) => x.id !== st.workerId && x.role !== 'mechanic' && !x.absent);
    return (
      `<div class="row"><b>${esc(opName)}</b> <span class="muted">${MACHINE_LABEL[st.machine]} · ${st.pile.length} bundles waiting${w ? ` · ${esc(w.name)} ${rate}/h` : ''}</span></div>` +
      (st.broken ? `<div class="row buttons">${fixing ? '<span class="hint">Someone is on the way…</span>' : `<button class="primary" data-action="fix" data-arg="${si}">Fix the machine</button>`}</div>` : '') +
      (ops.length
        ? `<div class="row"><span class="muted">Job:</span> ${ops.map((x) => `<button class="chip" data-action="setOp" data-arg="${x.id}" aria-pressed="${st.opId === x.id}">${esc(x.name)} <small>${x.smv} min</small></button>`).join('')}</div>`
        : '') +
      `<div class="row"><span class="muted">Seat here:</span> ${seatable
        .map((x) => `<button class="chip" data-action="seat" data-arg="${x.id}">${dot(x)}${esc(x.name)} ${pips(x.skill[st.machine])}</button>`)
        .join('')}</div>` +
      `<div class="row buttons"><button data-action="close">Close</button></div>`
    );
  }
  const o = activeOrder(s);
  if (s.director) {
    const d = s.director;
    const flying = d.flightUntil > 0;
    const others = sites(s).filter((x) => x !== d.site);
    const away = flying ? `You are flying to ${SITE_NAME[d.site] ?? d.site}; you land at ${clockLabel(d.flightUntil)}.` : `You are in ${SITE_NAME[d.site] ?? d.site}. In the other city only the line leaders and the mechanics can act.`;
    const fly = flying
      ? ''
      : others.map((x) => `<button data-action="travel" data-arg="${x}" ${s.phase !== 'shift' || s.cash < FLIGHT_COST ? 'disabled' : ''}>✈ Fly to ${esc(SITE_NAME[x] ?? x)} · $${FLIGHT_COST} · 3 h</button>`).join('');
    const led = s.lines.map((l) => `${esc(l.name)} (${esc(SITE_NAME[l.site ?? ''] ?? '')}): ${l.leaderId ? `led by ${esc(workerById(s, l.leaderId)?.name ?? '')}` : 'no leader'}`).join(' · ');
    return `<div class="row"><b>${esc(away)}</b></div><div class="row buttons">${fly}</div><div class="row muted small">${led} · flights ${s.stats.flights ?? 0} · breakdowns today ${s.stats.dayBreakdowns}</div>`;
  }
  if (s.lines.length > 1) {
    const led = s.lines.map((l) => `${esc(l.name)}: ${l.leaderId ? `led by ${esc(workerById(s, l.leaderId)?.name ?? '')}` : 'no leader'}`).join(' · ');
    return `<div class="row"><b>Tap a seamstress, then a machine. Two lines: hire line leaders so they balance for you.</b></div><div class="row muted small">${led} · breakdowns today ${s.stats.dayBreakdowns}</div>`;
  }
  const hint = s.chapterId === 'ch0' && (o?.finished ?? 0) >= 290 ? 'Order done! Every extra piece is a bonus.' : 'Tap a seamstress, then tap a machine to move her.';
  return (
    `<div class="row"><b>${hint}</b></div>` +
    `<div class="row muted small">Tap a machine to change its job, seat someone or fix it. Efficiency today ${Math.round(lineEfficiency(s) * 100)}% · breakdowns ${s.stats.dayBreakdowns}${
      o ? ` · ${PRODUCTS[o.product]!.plural} for ${esc(BUYERS[o.buyer]!.contact)}` : ''
    }</div>`
  );
}

function orderCard(s: GameState, o: Order): string {
  const p = PRODUCTS[o.product]!;
  const b = BUYERS[o.buyer]!;
  const pct = Math.round((o.finished / o.qty) * 100);
  let status = '';
  if (o.status === 'shipped') status = `<span class="ok">Shipped${o.onTime ? ' on time' : ''} · ${money(o.revenue)}</span>`;
  else if (o.status === 'short') status = `<span class="bad">Shipped short · ${money(o.revenue)}</span>`;
  else if (o.status === 'queued') status = '<span class="muted">Waiting for the line</span>';
  else {
    const day = projectedFinishDay(s, o);
    status = day <= o.dueDay ? `<span class="ok">On track: packed by day ${day}</span>` : `<span class="bad">Late at this pace${Number.isFinite(day) ? `: day ${day}` : ''}</span>`;
  }
  return `<div class="order"><div class="row"><b>${esc(b.contact)}</b> <span class="muted">${esc(b.name)} · ${b.origin}</span></div>
    <div class="row small">${s.lines.length > 1 ? `<b>${esc(s.lines[o.line]!.name)}</b> · ` : ''}${has(s, 'sourcing') ? `${o.mode === 'fob' ? 'FOB' : 'CMT'} · ` : ''}${o.qty.toLocaleString('en')} ${p.plural} · $${o.price.toFixed(2)}/dz · worth ${money(orderValue(o))} · ⛴ day ${o.dueDay}${o.airFreight ? ' (air freight)' : ''}${has(s, 'quality') && b.inspection !== 'none' ? ` · ${b.inspection} inspection` : ''}</div>
    <div class="bar"><div style="width:${pct}%"></div></div><div class="row small">${o.finished}/${o.qty} packed · ${status}</div></div>`;
}

export function ordersTabHtml(s: GameState): string {
  const list = s.orders.length ? [...s.orders].reverse().map((o) => orderCard(s, o)).join('') : '<p class="muted">No orders yet. The fax machine will ring.</p>';
  const premium = Math.round(dailyWages(s) * ((s.tuning.overtimeEnd - s.tuning.shiftEnd) / 540) * s.tuning.overtimeWagePremium);
  const capped = has(s, 'morale') && s.stats.overtimeDays >= s.tuning.overtimeCap && !s.overtime;
  const canOt = s.phase === 'shift' && s.minute < s.tuning.shiftEnd && !capped;
  return (
    `<div class="row buttons"><button data-action="overtime" aria-pressed="${s.overtime}" ${canOt ? '' : 'disabled'}>${s.overtime ? '✓ Overtime tonight until 19:00' : 'Overtime tonight until 19:00'}</button><span class="muted small">≈ ${money(premium)} extra wages, tired workers</span></div>` +
    (has(s, 'morale') ? `<div class="row small ${capped ? 'bad' : 'muted'}">1994 Labour Code: ${s.stats.overtimeDays}/${s.tuning.overtimeCap} overtime evenings used this month</div>` : '') +
    brandHtml(s) +
    quotaHtml(s) +
    marketsHtml(s) +
    list
  );
}

/** Chapter 10: your own label: stock, sales, price and advertising. */
function brandHtml(s: GameState): string {
  if (!has(s, 'brand')) return '';
  const b = s.brand;
  if (!b) return '<h3>Your label</h3><p class="small muted">Choose the first collection to open your shops.</p>';
  const c = COLLECTIONS.find((x) => x.id === b.collection)!;
  const name = BUYERS.ownlabel!.name;
  const price = (lvl: number, label: string) => `<button class="chip" data-action="price" data-arg="${lvl}" aria-pressed="${b.priceLevel === lvl}">${label}</button>`;
  const ad = b.adUntil >= s.day ? '<span class="ok small">✓ <span>Advertisement running</span></span>' : `<button class="mini" data-action="advertise" ${s.cash < AD_COST ? 'disabled' : ''}>Advertise in the newspaper · $${AD_COST}</button>`;
  return `<h3>Your label · ${esc(name)}</h3>
    <p class="small">${esc(c.label)}: <b>${brandStock(s)}</b> <span>in the shops</span> · <span>sold</span> ${b.sold}/${c.qty} (${Math.round(fullPriceShare(s) * 100)}%) · <span>shop takings</span> ${money(b.revenue)}</p>
    <p class="small muted">Shop price ${money(retailPrice(s))} · about ${Math.round(demandTonight(s))} pieces sell per night · last night ${b.soldToday}</p>
    <div class="row"><span class="muted small">Price</span><div class="seg">${price(-1, 'Sale −15%')}${price(0, 'Normal')}${price(1, 'Premium +15%')}</div></div>
    <div class="row">${ad}<span class="muted small">Demand +40% for two nights</span></div>
    <p class="small muted">Whatever is left on the last night goes on sale at 60% off. The mill is paid at the end of the season.</p>`;
}

/** Chapter 8: US export quota, bought per order at a price that moves every night. */
function quotaHtml(s: GameState): string {
  if (!has(s, 'quota') || !s.quota) return '';
  const q = s.quota;
  const prev = q.history.at(-1);
  const trend = prev === undefined ? '' : q.price > prev ? ' ▲' : q.price < prev ? ' ▼' : '';
  const rows = s.orders
    .filter((o) => o.buyer === 'atlantic' && (o.status === 'active' || o.status === 'queued' || o.quotaPaid))
    .map((o) => {
      const label = `${o.qty.toLocaleString('en')} ${PRODUCTS[o.product]!.plural} · ⛴ day ${o.dueDay}`;
      const state = o.quotaPaid
        ? '<span class="ok small">✓ <span>Quota bought</span></span>'
        : `<button class="mini" data-action="quota" data-arg="${o.id}" ${s.cash < quotaCost(s, o) ? 'disabled' : ''}>Buy quota · $${quotaCost(s, o)}</button>`;
      return `<div class="supplier"><div><b>${esc(label)}</b></div>${state}</div>`;
    })
    .join('');
  return `<h3>US export quota</h3><p class="small">Today: <b>$${q.price.toFixed(2)}/dozen</b>${trend}${prev !== undefined ? ` <span class="muted">(yesterday $${prev.toFixed(2)})</span>` : ''}</p>
    <p class="small muted">Every American order needs quota before the vessel. Without it, a broker sells it at the cut-off for 50% more.</p>${rows}`;
}

/** Chapter 8: the buyer's code of conduct, checked live, and the auditor's verdict. */
function complianceHtml(s: GameState): string {
  if (!has(s, 'compliance') || !s.audit) return '';
  const checks = auditChecks(s);
  const a = s.audit;
  const head = a.visits === 0 ? 'The auditor visits on day 3. Five of six must pass.' : a.passed ? `Audit passed: ${a.score} of 6.` : `Audit failed: ${a.score} of 6. She comes back on day 6.`;
  return `<h3>Code of conduct</h3><p class="small ${a.passed === false ? 'bad' : 'muted'}">${head}</p><ul class="goals">${AUDIT_CHECKS.map((c) => `<li class="${checks[c.id] ? 'ok' : 'bad'}">${checks[c.id] ? '✓' : '✗'} <span>${esc(c.text)}</span></li>`).join('')}</ul>`;
}

/** Chapter 7: the shock and the search for new customers. */
function marketsHtml(s: GameState): string {
  if (!has(s, 'diversify')) return '';
  const shock = s.macro
    ? `<p class="small bad">📉 <span>Korea: ${s.macro.cutPieces.toLocaleString('en')} pieces cancelled on day ${s.macro.day}.</span></p>`
    : '<p class="small muted">The fax machine is quiet. Too quiet.</p>';
  const lastDay = chapterOf(s).days - 2;
  const rows = MARKETS.map((m) => {
    const p = s.prospects.find((x) => x.market === m.id);
    const late = s.day + m.delay > lastDay;
    const state = p
      ? p.sent
        ? '<span class="ok small">✓ <span>First fax received</span></span>'
        : `<span class="muted small">First fax on day ${p.day}</span>`
      : `<button class="mini" data-action="prospect" data-arg="${m.id}" ${late || s.cash < m.cost ? 'disabled' : ''}>Look · $${m.cost}</button>`;
    return `<div class="supplier"><div><b>${esc(m.name)}</b><div class="muted small">${esc(m.text)}</div></div>${state}</div>`;
  }).join('');
  return `<h3>New markets</h3>${shock}<div class="small muted">New customers on time: ${newCustomers(s)}</div>${rows}`;
}

const ROLE_NAME: Record<string, string> = {
  operator: 'seamstress',
  qc: 'QC inspector',
  mechanic: 'mechanic',
  cutter: 'cutter',
  electrician: 'electrician',
  leader: 'line leader',
  planner: 'production planner',
  merchandiser: 'merchandiser',
};

export function moraleBar(m: number): string {
  const pct = Math.round(m * 100);
  return `<span class="morale ${m < 0.4 ? 'low' : m < 0.65 ? 'mid' : 'high'}" title="Morale ${pct}%"><span style="width:${pct}%"></span></span><span class="small muted">${pct}%</span>`;
}

function mentorHtml(s: GameState, w: Worker): string {
  if (w.mentor) {
    const m = workerById(s, w.mentor);
    return `<div class="row small">Learning from <b>${esc(m?.name ?? '')}</b> <button class="chip" data-action="mentor" data-arg="${w.id}:none">Stop mentoring</button></div>`;
  }
  const seniors = s.workers
    .filter((x) => x.id !== w.id && x.role === 'operator' && !x.mentor && !x.absent && Math.max(x.skill.lockstitch, x.skill.overlock) >= 0.85)
    .slice(0, 6);
  if (!seniors.length) return '';
  return `<div class="row small"><span class="muted">Mentor:</span> ${seniors
    .map((x) => `<button class="chip" data-action="mentor" data-arg="${w.id}:${x.id}">${dot(x)}${esc(x.name)}</button>`)
    .join('')}<span class="muted">(she teaches while sewing a little slower)</span></div>`;
}

function careHtml(s: GameState): string {
  const items: ['fans' | 'canteen' | 'water', string, string][] = [
    ['fans', 'Industrial fans', 'Workers tire 30% slower'],
    ['canteen', 'A canteen', 'A real lunch: twice the rest at noon'],
    ['water', 'Clean water and first aid', 'Fewer sick days'],
  ];
  const avg = s.workers.length ? s.workers.reduce((a, w) => a + w.morale, 0) / s.workers.length : 0;
  return `<h3>Taking care of people</h3><div class="row small">Average morale ${moraleBar(avg)} · <span>${s.stats.quits} left</span> · <span>${s.stats.sickDays} sick days</span></div>
    ${items
      .map(([id, name, text]) =>
        s.welfare[id]
          ? `<div class="row small ok">✓ ${name}: ${text}</div>`
          : `<div class="row buttons"><button data-action="welfare" data-arg="${id}">${name} · $${s.tuning.welfareCost[id]}</button><span class="muted small">${text}; morale up every night</span></div>`,
      )
      .join('')}
    <p class="small muted">Happy people sew faster and cleaner, and stay. Overtime, tiredness and low pay push morale down; below a third, people leave.</p>`;
}

function officeHtml(s: GameState): string {
  const quotes = ['Small and soon', 'Standard', 'Big and later'];
  const merch = s.workers.some((w) => w.role === 'merchandiser');
  const plan = s.workers.some((w) => w.role === 'planner');
  return `<h3>The office</h3>
    <div class="row small">${merch ? '✓ A merchandiser answers routine faxes.' : 'No merchandiser yet: you answer every fax.'} ${plan ? '✓ A planner buys fabric and fills idle lines.' : 'No planner yet: you buy the fabric.'}</div>
    <div class="row"><span class="muted small">Quote policy:</span> ${quotes
      .map((q, i) => `<button class="chip" data-action="policy" data-arg="${i}:${s.policy.extras}" aria-pressed="${s.policy.quote === i}">${q}</button>`)
      .join('')}<button class="chip" data-action="policy" data-arg="${s.policy.quote}:${!s.policy.extras}" aria-pressed="${s.policy.extras}">Take optional orders</button></div>`;
}

export function fabricTabHtml(s: GameState): string {
  const orders = s.orders.filter((o) => o.status === 'active' || o.status === 'queued');
  const cards = orders
    .map((o) => {
      const b = BUYERS[o.buyer]!;
      const p = PRODUCTS[o.product]!;
      const st = rollsSummary(s, o.id);
      const need = rollsToBuy(s, o);
      const header = `<div class="row"><b>${esc(b.contact)}</b> <span class="muted small">${p.plural} · ${o.mode === 'fob' ? 'FOB: you buy the fabric' : 'CMT: the buyer’s fabric'} · marker ${Math.round(o.markerEff * 100)}%</span></div>
        <div class="row small">In store: ${st.rolls} rolls (${st.metres} m) · on the way: ${Math.round(metresInTransit(s, o.id))} m · one bundle needs ${metresPerBundle(s, o).toFixed(1)} m</div>`;
      if (o.mode !== 'fob') return `<div class="order">${header}</div>`;
      const buy = Object.values(SUPPLIERS)
        .map((sup) => {
          const n = Math.max(1, need);
          return `<div class="supplier"><div><b>${esc(sup.name)}</b> <span class="muted small">${esc(sup.origin)} · $${sup.price}/roll · ${sup.leadDays} day${sup.leadDays > 1 ? 's' : ''}</span><br><span class="small muted">${esc(sup.note)}</span></div>
          <button class="mini ${need > 0 ? 'primary' : ''}" data-action="buy" data-arg="${sup.id}:${o.id}:${n}">Buy ${n} · $${n * sup.price}</button></div>`;
        })
        .join('');
      return `<div class="order">${header}<div class="row small ${need > 0 ? 'bad' : 'ok'}">${need > 0 ? `${need} more rolls needed to cut the whole order` : 'Enough fabric ordered'}</div>${buy}</div>`;
    })
    .join('');
  const transit = s.shipments
    .filter((x) => x.status === 'transit')
    .map((x) => {
      const sup = SUPPLIERS[x.supplier]!;
      const noticed = !x.delayed || s.day >= x.arriveDay - sup.lateDays;
      const eta = x.delayed && !noticed ? x.arriveDay - sup.lateDays : x.arriveDay;
      return `<li>${x.rolls} rolls from ${esc(sup.name)} · expected day ${eta}, 10:00${x.delayed && noticed ? ' (held at customs)' : ''}</li>`;
    })
    .join('');
  const pallets = s.pallets
    ? '<p class="small ok">The warehouse floor has pallets: rolls stay dry when the roof leaks.</p>'
    : `<div class="row buttons"><button data-action="pallets">Buy pallets · $${s.tuning.palletsCost}</button><span class="muted small">Keeps rolls off the wet floor in the rainy season</span></div>`;
  const inStore = s.warehouse.filter((r) => !r.rejected && r.metres > 0).length;
  const aside = s.warehouse.filter((r) => r.rejected).length;
  return `${cards || '<p class="muted">No order needs fabric right now.</p>'}<h3>On the way</h3>${transit ? `<ul class="small">${transit}</ul>` : '<p class="muted small">Nothing in transit.</p>'}<h3>Warehouse</h3>${pallets}<p class="small muted">${inStore} rolls in store, ${aside} set aside after inspection.</p>`;
}

export function teamTabHtml(s: GameState): string {
  const people = s.workers
    .map((w) => {
      const lead = s.lines.findIndex((l) => l.leaderId === w.id);
      const where = w.absent
        ? 'home sick'
        : w.role === 'leader'
          ? lead >= 0
            ? `leads ${s.lines[lead]!.name}`
            : 'no line yet'
          : w.role === 'mechanic' || w.role === 'electrician' || w.role === 'planner' || w.role === 'merchandiser'
            ? ROLE_NAME[w.role]!
            : w.station === null
              ? 'bench' : s.stations[w.station]!.opId ? opDef(s.stations[w.station]!.opId!).name : 'spare machine';
      const leadButtons =
        w.role === 'leader' && has(s, 'leaders')
          ? s.lines.map((l, i) => `<button class="mini chip" data-action="lead" data-arg="${w.id}:${i}" aria-pressed="${lead === i}">Lead ${esc(l.name)}</button>`).join('')
          : '';
      return `<div class="person">${dot(w)}<b>${esc(w.name)}</b> <span class="muted small">${w.role === 'qc' || w.role === 'cutter' ? `${ROLE_NAME[w.role]} · ` : ''}${where} · $${w.wage.toFixed(2)}/day</span>
        <span class="small">${w.role === 'operator' ? `L ${pips(w.skill.lockstitch)} O ${pips(w.skill.overlock)}` : w.role === 'qc' ? `QC ${pips(w.skill.qc)}` : ''}</span>
        ${has(s, 'morale') ? moraleBar(w.morale) : ''}${w.mentor ? `<span class="trait">learning from ${esc(workerById(s, w.mentor)?.name ?? '')}</span>` : ''}
        ${w.traits.map((t) => `<span class="trait" title="${TRAITS[t].text}">${TRAITS[t].name}</span>`).join('')}${leadButtons}
        ${layoffBlocked(s) ? '' : `<button class="mini" data-action="letGo" data-arg="${w.id}" aria-label="Let ${esc(w.name)} go">Let go</button>`}</div>`;
    })
    .join('');
  const apps = s.applicants.length
    ? s.applicants
        .map(
          (a) => `<div class="person applicant"><b>${esc(a.name)}</b> <span class="muted small">${ROLE_NAME[a.role]} · asks $${a.wage.toFixed(2)}/day</span>
        <span class="small">${a.role === 'operator' ? `Lockstitch ${pips(a.skill.lockstitch)} Overlock ${pips(a.skill.overlock)} Buttonhole ${pips(a.skill.buttonhole)}` : a.role === 'qc' ? `QC ${pips(a.skill.qc)}` : a.role === 'cutter' ? `Cutting ${pips(a.skill.cutting)}` : ''}</span>
        ${a.traits.map((t) => `<span class="trait" title="${TRAITS[t].text}">${TRAITS[t].name}</span>`).join('')}
        <span class="muted small">${esc(a.note)}</span>
        <button class="primary mini" data-action="hire" data-arg="${esc(a.id)}">Hire</button></div>`,
        )
        .join('')
    : '<p class="muted small">Nobody else at the gate today. New applicants come every morning.</p>';
  return `${complianceHtml(s)}${has(s, 'morale') ? careHtml(s) : ''}${has(s, 'merchandising') ? officeHtml(s) : ''}<h3>At the gate this morning</h3>${apps}<h3>Your team · ${money(dailyWages(s))}/day</h3>${people}`;
}

/** Bác Tư's tips contain markup, so Vietnamese and French use whole-text versions instead of the segment translator. */
export function tipText(id: string): Tip {
  return localTip(id) ?? TIPS[id]!;
}

export function bookTabHtml(seen: string[]): string {
  const tips = seen
    .filter((id) => TIPS[id])
    .map((id) => `<details><summary data-raw>${tipText(id).title}</summary><p data-raw>${tipText(id).body}</p></details>`)
    .join('');
  return `<h3>Bác Tư’s advice</h3>${tips || '<p class="muted small">Tips appear here once Bác Tư has told you.</p>'}<h3>Words of the trade</h3><dl>${GLOSSARY.map((g) => `<dt>${g.term}</dt><dd>${g.text}</dd>`).join('')}</dl>`;
}

// ───────────────────────────── overlays

export function tipHtml(tip: Tip): string {
  return `<div class="card" role="dialog" aria-labelledby="tip-title"><div class="mentor" aria-hidden="true">Bác Tư</div><h2 id="tip-title" data-raw>${tip.title}</h2><p data-raw>${tip.body}</p><div class="buttons"><button class="primary" data-action="tipOk">Got it</button></div></div>`;
}

const CAUSE_TEXT: Record<string, [string, string]> = {
  skill: ['low skill on this machine', 'seat a more skilled seamstress here'],
  learn: ['still learning the operation', 'keep her on it: she gets faster and cleaner'],
  wear: ['worn needle', 'a mechanic changes needles before they wear out'],
  fatigue: ['tiredness', 'less overtime'],
};

export function postMortemHtml(s: GameState, o: Order): string {
  const causes = Object.entries(o.causes).sort((a, b) => b[1].count - a[1].count);
  const total = causes.reduce((a, [, c]) => a + c.count, 0);
  if (total === 0) return '<p class="small muted">No defects recorded on this order. Clean work!</p>';
  const rows = causes.slice(0, 3).map(([opId, c]) => {
    const who = Object.entries(c.byWorker).sort((a, b) => b[1] - a[1])[0];
    const wn = who ? (workerById(s, who[0])?.name ?? 'a former worker') : '';
    const main = (['skill', 'learn', 'wear', 'fatigue'] as const).reduce((a, k) => (c[k] > c[a] ? k : a), 'skill' as 'skill' | 'learn' | 'wear' | 'fatigue');
    return `<tr><td>${esc(opDef(opId).name)}</td><td>${Math.round((c.count / total) * 100)}%</td><td>${esc(wn)}</td><td>${CAUSE_TEXT[main]![0]}<br><span class="muted">→ ${CAUSE_TEXT[main]![1]}</span></td></tr>`;
  });
  return `<h3>Defect report</h3><p class="small">${total} defects made on this order; QC caught ${o.caughtByQc} and sent them back.</p>
    <table class="pm"><tr><th>Operation</th><th>Share</th><th>Mostly</th><th>Main cause</th></tr>${rows.join('')}</table>`;
}

export function decisionHtml(s: GameState, d: Decision): string {
  const o = d.orderId !== undefined ? s.orders.find((x) => x.id === d.orderId) : undefined;
  const opts = d.options
    .map((x, i) => `<button class="${i === 0 ? 'primary ' : ''}choice" data-action="decide" data-arg="${d.id}:${x.id}"><b>${esc(x.label)}</b>${x.detail ? `<small>${esc(x.detail)}</small>` : ''}</button>`)
    .join('');
  if (d.kind === 'fax') {
    const b = BUYERS[d.fax!.buyer]!;
    return `<div class="card fax" role="dialog" aria-labelledby="dec-title"><div class="faxhead">FAX · ${clockLabel(s.minute)} · ${b.origin}</div><h2 id="dec-title">${esc(b.name)}</h2>
      <p class="faxbody">${esc(d.body)}</p><p class="small muted">${esc(b.contact)}: ${esc(b.habit)}</p><div class="choices">${opts}</div></div>`;
  }
  if (d.kind === 'inspection' && o) {
    const passed = d.title.includes('PASSED');
    return `<div class="card" role="dialog" aria-labelledby="dec-title"><div class="stamp ${passed ? 'pass' : 'fail'}" aria-hidden="true">${passed ? 'PASSED' : 'REJECTED'}</div>
      <h2 id="dec-title">${esc(d.title)}</h2><p>${esc(d.body)}</p>${postMortemHtml(s, o)}<div class="choices">${opts}</div></div>`;
  }
  const tag = d.kind === 'family' ? '<div class="mentor family" aria-hidden="true">Family</div>' : '';
  return `<div class="card" role="dialog" aria-labelledby="dec-title">${tag}<h2 id="dec-title">${esc(d.title)}</h2><p>${esc(d.body)}</p><div class="choices">${opts}</div></div>`;
}

export function reportHtml(s: GameState): string {
  const h = s.history.at(-1);
  const last = s.day >= chapterOf(s).days;
  const l = h?.ledger;
  const money_ = has(s, 'orders') && l
    ? `<tr><td>Paid by buyers</td><td>${money(l.revenue)}</td></tr><tr><td>Wages</td><td>−${money(l.wages)}</td></tr><tr><td>Rent & electricity</td><td>−${money(l.rent + l.electricity)}</td></tr>${
        l.freight ? `<tr><td>Air freight</td><td>−${money(l.freight)}</td></tr>` : ''
      }${l.penalties ? `<tr><td>Penalties</td><td>−${money(l.penalties)}</td></tr>` : ''}<tr><td><b>Cash</b></td><td><b>${money(s.cash)}</b></td></tr>`
    : '';
  const o = activeOrder(s);
  const ch0 = s.chapterId === 'ch0' ? `<tr><td>Shorts packed</td><td><b>${o?.finished ?? 0}</b> (★ 290 · ★★ 340 · ★★★ 370)</td></tr>` : '';
  return `<div class="card report" role="dialog" aria-labelledby="rep-title"><div class="notebook"><h2 id="rep-title">Day ${s.day} · shift report</h2><table>
    ${ch0}${s.brand ? `<tr><td>Sold in your shops</td><td>${s.brand.soldToday}</td></tr>` : ''}<tr><td>Pieces packed today</td><td>${h?.pieces ?? 0}</td></tr><tr><td>Line efficiency</td><td>${Math.round((h?.efficiency ?? 0) * 100)}%</td></tr><tr><td>Breakdowns</td><td>${h?.breakdowns ?? 0}</td></tr>${money_}</table>
    ${has(s, 'morale') ? `<p class="small">Average morale ${moraleBar(s.workers.reduce((a, w) => a + w.morale, 0) / Math.max(1, s.workers.length))} · <span>welfare ${welfareCount(s)}/3</span></p>` : ''}
    ${s.tet && s.tet.returned + s.tet.left.length > 0 ? `<p class="small">After Tết: ${s.tet.returned} came back, ${s.tet.left.length} stayed home.</p>` : ''}
    ${s.negativeDays > 0 ? '<p class="bad">You are in the red. One more day like this and the workshop closes.</p>' : ''}</div>
    <div class="buttons"><button class="primary" data-action="sleep">${last ? 'See how it went' : 'Sleep until 07:00'}</button></div></div>`;
}

export function chapterEndHtml(s: GameState, hasNext: boolean, unlocked: string[] = [], share = ''): string {
  const ch = chapterOf(s);
  const ach = unlocked.length
    ? `<h3>New achievements</h3><ul class="goals">${unlocked.map((id) => ACHIEVEMENTS.find((a) => a.id === id)!).map((a) => `<li class="ok">🏅 <b>${esc(a.name)}</b>: <span>${esc(a.text)}</span></li>`).join('')}</ul>`
    : '';
  if (ch.generator) {
    return `<div class="card report" role="dialog" aria-labelledby="end-title"><div class="notebook"><h2 id="end-title">${esc(ch.name)}</h2>
      <p>${s.failed === 'bankrupt' ? 'The money ran out.' : 'You closed the factory.'} <span>You lasted</span> <b>${s.history.length}</b> days and shipped ${s.orders.filter((o) => o.status === 'shipped').length} orders.</p>${ach}</div>
      <div class="buttons"><button class="primary" data-action="title">Menu</button></div></div>`;
  }
  const shareBox = share ? `<div class="share"><code>${esc(share)}</code><button data-action="copyShare">Copy</button></div>` : '';
  const checks = starChecks(s);
  const n = stars(s);
  const texts = chapterOf(s).starText;
  const lines = texts.map((t, i) => `<li class="${checks[i] ? 'ok' : 'muted'}">${checks[i] ? '★' : '☆'} ${esc(t)}</li>`).join('');
  const verdict = s.failed === 'bankrupt' ? 'The workshop ran out of money.' : n === 0 ? 'Not this time. Try again: every day teaches something.' : n === 3 ? 'Legendary. The whole street talks about your line.' : 'Well done.';
  return `<div class="card report" role="dialog" aria-labelledby="end-title"><div class="notebook"><h2 id="end-title">${esc(chapterOf(s).name)}</h2>
    <div class="bigstars" aria-label="${n} of 3 stars">${'★'.repeat(n)}${'☆'.repeat(3 - n)}</div><p>${verdict}</p><ul class="goals">${lines}</ul>
    ${has(s, 'orders') ? `<p>Final cash: <b>${money(s.cash)}</b></p>` : ''}${shareBox}${ach}${
      s.chapterId === 'ch7' && n > 0 ? `<h3>Epilogue</h3>${epilogue(s.campaign).map((t) => `<p>${esc(t)}</p>`).join('')}` : ''
    }${s.chapterId === 'ch10' && n > 0 ? `<h3>Epilogue</h3>${epilogue2(s.campaign).map((t) => `<p>${esc(t)}</p>`).join('')}` : ''}</div>
    <div class="buttons"><button data-action="title">Menu</button>${s.chapterId === 'ch7' && n > 0 ? '<button class="primary" data-action="scrapbook">The scrapbook</button>' : ''}${s.chapterId === 'ch10' && n > 0 ? '<button class="primary" data-action="scrapbook">The scrapbook</button>' : ''}${ch.scoreStars ? '' : '<button data-action="replay">Replay</button>'}${hasNext && n > 0 && !ch.scoreStars ? '<button class="primary" data-action="next">Next chapter</button>' : ''}</div></div>`;
}

export interface TitleExtras {
  dailyId: string;
  dailyName: string;
  dailyPlace: string;
  dailyBest: number | undefined;
  d1: { days: number; returned: number };
}

export function titleHtml(p: Progress, hasSave: boolean, saveLabel: string, eink = false, x?: TitleExtras): string {
  const career = careerTitle(p.stars);
  const got = p.achievements ?? [];
  const unlockedSandbox = (p.stars.ch2 ?? 0) > 0;
  const extra = x
    ? `<div class="career"><b>${esc(career.title)}</b> · ${career.total} ★${career.next !== null ? ` <span class="muted small">(next title at ${career.next} ★)</span>` : ''}</div>
    <div class="modes"><button class="chapter" data-action="daily"><span class="num">☀</span><span><b>${esc(x.dailyName)}</b><small>${esc(x.dailyPlace)}</small></span><span class="st">${x.dailyBest !== undefined ? `${x.dailyBest}` : 'new'}</span></button>
    <div class="sandbox"><span><b>Sandbox</b><small>${unlockedSandbox ? `Endless factory${p.sandboxBest ? ` · best ${p.sandboxBest} days` : ''}` : 'Unlocks after Chapter 2'}</small></span>${[1, 2, 3, 4]
      .map((n) => `<button class="mini chip" data-action="sandbox" data-arg="${n}" ${unlockedSandbox ? '' : 'disabled'}>${n} line${n > 1 ? 's' : ''}</button>`)
      .join('')}</div>
    <button class="chapter" data-action="editor" ${unlockedSandbox ? '' : 'disabled'}><span class="num">✎</span><span><b>Scenario editor</b><small>${unlockedSandbox ? 'Build a factory, invent buyers, share the code' : 'Unlocks after Chapter 2'}</small></span></button>
    <button class="chapter" data-action="gallery" ${unlockedSandbox ? '' : 'disabled'}><span class="num">❖</span><span><b>Community gallery</b><small>${unlockedSandbox ? 'Scenarios made by players' : 'Unlocks after Chapter 2'}</small></span></button></div>
    <details class="ach"><summary>Achievements · ${got.length}/${ACHIEVEMENTS.length}</summary><ul class="goals">${ACHIEVEMENTS.map((a) => `<li class="${got.includes(a.id) ? 'ok' : 'muted'}">${got.includes(a.id) ? '🏅' : '○'} <b>${esc(a.name)}</b>: <span>${esc(a.text)}</span></li>`).join('')}</ul></details>
    <div class="row center"><button class="mini" data-action="scrapbook">📖 The scrapbook</button></div>
    <details class="ach"><summary>Looks · stars unlock caps, collars, calendars and radio songs</summary>${cosmeticsHtml(p.cosmetics ?? {}, career.total, p.campaign.cat === 'adopt')}</details>
    <details class="ach"><summary>Play log</summary><p class="small muted">An optional diary of your sessions, kept only on this device, to help playtests. Nothing is sent anywhere.</p>
    <div class="row center"><div class="seg"><button data-action="log" data-arg="1" aria-pressed="${!!p.log}">On</button><button data-action="log" data-arg="0" aria-pressed="${!p.log}">Off</button></div><button class="mini" data-action="logExport">Export JSON</button></div>
    <p class="small muted center">Days played: ${x.d1.days} · came back the next day: ${x.d1.returned}</p></details>`
    : '';
  const chapters = CHAPTERS.map((c, i) => {
    const unlocked = i === 0 || (p.stars[CHAPTERS[i - 1]!.id] ?? 0) > 0;
    const st = p.stars[c.id] ?? 0;
    const part = c.index === 8 ? `<h3 class="part">Part II · 2002–2008</h3>` : c.index === 0 ? `<h3 class="part">Part I · 1992–1997</h3>` : '';
    return `${part}<button class="chapter" data-action="start" data-arg="${c.id}" ${unlocked ? '' : 'disabled'}><span class="num">${c.index}</span><span><b>${esc(c.name)}</b><small>${c.year} · ${esc(c.place)}</small></span><span class="st">${
      unlocked ? `${'★'.repeat(st)}${'☆'.repeat(3 - st)}` : '🔒'
    }</span></button>`;
  }).join('');
  const diffs = Object.values(DIFFICULTIES)
    .map((d) => {
      const locked = !!d.unlockAfter && !(p.stars[d.unlockAfter] ?? 0);
      return `<button data-action="difficulty" data-arg="${d.id}" aria-pressed="${p.difficulty === d.id}" title="${esc(locked ? `Unlocks after Chapter ${d.unlockAfter!.slice(2)}` : d.blurb)}" ${locked ? 'disabled' : ''}>${locked ? '🔒 ' : ''}${d.name}</button>`;
    })
    .join('');
  return `<div class="title"><h1>Sewing<span>Factory</span>Mania</h1><p class="sub">Saigon, 1992. Six machines, a family workshop, and the whole world wanting shirts.</p>
    ${hasSave ? `<button class="primary big" data-action="continue">Continue <small>${esc(saveLabel)}</small></button>` : ''}
    <div class="chapters">${chapters}</div>${extra}
    <div class="row center"><span class="muted small">Difficulty</span><div class="seg">${diffs}</div></div>
    <div class="row center"><span class="muted small">Language</span><div class="seg"><button data-action="lang" data-arg="en" aria-pressed="${getLang() === 'en'}">English</button><button data-action="lang" data-arg="vi" aria-pressed="${getLang() === 'vi'}" lang="vi">Tiếng Việt</button><button data-action="lang" data-arg="fr" aria-pressed="${getLang() === 'fr'}" lang="fr">Français</button></div></div>
    <div class="row center"><span class="muted small">Display</span><div class="seg"><button data-action="eink" data-arg="0" aria-pressed="${!eink}">Colour</button><button data-action="eink" data-arg="1" aria-pressed="${eink}">E-ink</button></div></div>
    <p class="muted small center">Free, no ads, works offline. Inspired by DataCenterMania.</p></div>`;
}

export function introHtml(chapterId: string): string {
  const c = CHAPTER_BY_ID[chapterId]!;
  const tag = c.id.startsWith('scn:') ? `Scenario · ${c.year}` : c.scoreStars ? 'Daily Challenge' : c.generator ? 'Sandbox' : `Chapter ${c.index} · ${c.year}`;
  return `<div class="card" role="dialog" aria-labelledby="intro-title"><div class="mentor" aria-hidden="true">${tag}</div><h2 id="intro-title">${esc(c.name)}</h2><p>${esc(c.intro)}</p>${c.modifier ? `<p><b>${esc(c.modifier.name)}</b>: <span>${esc(c.modifier.text)}</span></p>` : ''}
    <ul class="goals">${c.starText.map((t, i) => `<li>${'★'.repeat(i + 1)} ${esc(t)}</li>`).join('')}</ul><div class="buttons"><button class="primary" data-action="introOk">Open the workshop</button></div></div>`;
}
