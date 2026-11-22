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

export type Tab = 'line' | 'orders' | 'team' | 'book';

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
  const cash = has(s, 'orders') ? `<div class="cash ${s.cash < 0 ? 'bad' : ''}" aria-label="Cash">${money(s.cash)}</div>` : '';
  const ot = s.overtime ? '<span class="ot">overtime</span>' : '';
  return (
    `<button class="menu" data-action="title" aria-label="Menu">☰</button>` +
    `<div class="clock" aria-label="Time"><small>${dayLabel(s.day)}</small> ${clockLabel(Math.min(s.minute, s.overtime ? s.tuning.overtimeEnd : s.tuning.shiftEnd))}${ot}</div>` +
    cash +
    goal +
    `<div class="speeds" role="group" aria-label="Speed">` +
    [0, 1, 2, 4].map((v) => `<button data-action="speed" data-arg="${v}" aria-pressed="${speed === v}" aria-label="${v === 0 ? 'Pause' : `${v}× speed`}">${v === 0 ? '⏸' : `${v}×`}</button>`).join('') +
    `</div><button class="sound" data-action="sound" aria-pressed="${sound}" aria-label="Sound">${sound ? '♪' : '♪̸'}</button>`
  );
}

// ───────────────────────────── bottom panel

export function tabsHtml(s: GameState, tab: Tab): string {
  const tabs: [Tab, string, string][] = [['line', 'Line', '']];
  if (has(s, 'orders')) tabs.push(['orders', 'Orders', s.orders.some((o) => o.status === 'active' && projectedFinishDay(s, o) > o.dueDay) ? '!' : '']);
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
      `<div class="row muted small">Knows: ${known || 'nothing yet: new operations start at 50% speed'}${w.fatigue > 0.3 ? ` · tired ${Math.round(w.fatigue * 100)}%` : ''}</div>` +
      `<div class="row hint">Now tap a machine to move ${esc(w.name)} there.</div>` +
      `<div class="row buttons">${w.station !== null ? `<button data-action="bench" data-arg="${w.id}">Send to bench</button>` : ''}<button data-action="close">Cancel</button></div>`
    );
  }
  const si = view.selectedStation;
  if (si !== null) {
    const st = s.stations[si]!;
    const w = workerById(s, st.workerId);
    const o = activeOrder(s);
    const opName = st.opId ? opDef(st.opId).name : 'Spare machine';
    const rate = w && st.opId ? Math.round((60 * stationEfficiency(s, st)) / opDef(st.opId).smv) : 0;
    const ops = st.machine === 'qc' || !o ? [] : PRODUCTS[o.product]!.ops.filter((x) => x.machine === st.machine);
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
    <div class="row small">${o.qty.toLocaleString('en')} ${p.plural} · $${o.price.toFixed(2)}/dz · worth ${money(orderValue(o))} · ⛴ day ${o.dueDay}${o.airFreight ? ' (air freight)' : ''}${has(s, 'quality') && b.inspection !== 'none' ? ` · ${b.inspection} inspection` : ''}</div>
    <div class="bar"><div style="width:${pct}%"></div></div><div class="row small">${o.finished}/${o.qty} packed · ${status}</div></div>`;
}

export function ordersTabHtml(s: GameState): string {
  const list = s.orders.length ? [...s.orders].reverse().map((o) => orderCard(s, o)).join('') : '<p class="muted">No orders yet. The fax machine will ring.</p>';
  const premium = Math.round(dailyWages(s) * ((s.tuning.overtimeEnd - s.tuning.shiftEnd) / 540) * s.tuning.overtimeWagePremium);
  const canOt = s.phase === 'shift' && s.minute < s.tuning.shiftEnd;
  return (
    `<div class="row buttons"><button data-action="overtime" aria-pressed="${s.overtime}" ${canOt ? '' : 'disabled'}>${s.overtime ? '✓ Overtime tonight until 19:00' : 'Overtime tonight until 19:00'}</button><span class="muted small">≈ ${money(premium)} extra wages, tired workers</span></div>` +
    list
  );
}

export function teamTabHtml(s: GameState): string {
  const people = s.workers
    .map((w) => {
      const where = w.absent ? 'home sick' : w.role === 'mechanic' ? 'mechanic' : w.station === null ? 'bench' : s.stations[w.station]!.opId ? opDef(s.stations[w.station]!.opId!).name : 'spare machine';
      return `<div class="person">${dot(w)}<b>${esc(w.name)}</b> <span class="muted small">${w.role !== 'operator' ? `${w.role === 'qc' ? 'QC inspector' : 'mechanic'} · ` : ''}${where} · $${w.wage.toFixed(2)}/day</span>
        <span class="small">${w.role === 'operator' ? `L ${pips(w.skill.lockstitch)} O ${pips(w.skill.overlock)}` : w.role === 'qc' ? `QC ${pips(w.skill.qc)}` : ''}</span>
        ${w.traits.map((t) => `<span class="trait" title="${TRAITS[t].text}">${TRAITS[t].name}</span>`).join('')}
        <button class="mini" data-action="letGo" data-arg="${w.id}" aria-label="Let ${esc(w.name)} go">Let go</button></div>`;
    })
    .join('');
  const apps = s.applicants.length
    ? s.applicants
        .map(
          (a) => `<div class="person applicant"><b>${esc(a.name)}</b> <span class="muted small">${a.role === 'operator' ? 'seamstress' : a.role === 'qc' ? 'QC inspector' : 'mechanic'} · asks $${a.wage.toFixed(2)}/day</span>
        <span class="small">${a.role === 'operator' ? `Lockstitch ${pips(a.skill.lockstitch)} Overlock ${pips(a.skill.overlock)} Buttonhole ${pips(a.skill.buttonhole)}` : a.role === 'qc' ? `QC ${pips(a.skill.qc)}` : ''}</span>
        ${a.traits.map((t) => `<span class="trait" title="${TRAITS[t].text}">${TRAITS[t].name}</span>`).join('')}
        <span class="muted small">${esc(a.note)}</span>
        <button class="primary mini" data-action="hire" data-arg="${esc(a.id)}">Hire</button></div>`,
        )
        .join('')
    : '<p class="muted small">Nobody else at the gate today. New applicants come every morning.</p>';
  return `<h3>At the gate this morning</h3>${apps}<h3>Your team · ${money(dailyWages(s))}/day</h3>${people}`;
}

export function bookTabHtml(seen: string[]): string {
  const tips = seen
    .filter((id) => TIPS[id])
    .map((id) => `<details><summary>${TIPS[id]!.title}</summary><p>${TIPS[id]!.body}</p></details>`)
    .join('');
  return `<h3>Bác Tư’s advice</h3>${tips || '<p class="muted small">Tips appear here once Bác Tư has told you.</p>'}<h3>Words of the trade</h3><dl>${GLOSSARY.map((g) => `<dt>${g.term}</dt><dd>${g.text}</dd>`).join('')}</dl>`;
}

// ───────────────────────────── overlays

export function tipHtml(tip: Tip): string {
  return `<div class="card" role="dialog" aria-labelledby="tip-title"><div class="mentor" aria-hidden="true">Bác Tư</div><h2 id="tip-title">${tip.title}</h2><p>${tip.body}</p><div class="buttons"><button class="primary" data-action="tipOk">Got it</button></div></div>`;
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
    ${ch0}<tr><td>Pieces packed today</td><td>${h?.pieces ?? 0}</td></tr><tr><td>Line efficiency</td><td>${Math.round((h?.efficiency ?? 0) * 100)}%</td></tr><tr><td>Breakdowns</td><td>${h?.breakdowns ?? 0}</td></tr>${money_}</table>
    ${s.negativeDays > 0 ? '<p class="bad">You are in the red. One more day like this and the workshop closes.</p>' : ''}</div>
    <div class="buttons"><button class="primary" data-action="sleep">${last ? 'See how it went' : 'Sleep until 07:00'}</button></div></div>`;
}

export function chapterEndHtml(s: GameState, hasNext: boolean): string {
  const checks = starChecks(s);
  const n = stars(s);
  const texts = chapterOf(s).starText;
  const lines = texts.map((t, i) => `<li class="${checks[i] ? 'ok' : 'muted'}">${checks[i] ? '★' : '☆'} ${esc(t)}</li>`).join('');
  const verdict = s.failed === 'bankrupt' ? 'The workshop ran out of money.' : n === 0 ? 'Not this time. Try again: every day teaches something.' : n === 3 ? 'Legendary. The whole street talks about your line.' : 'Well done.';
  return `<div class="card report" role="dialog" aria-labelledby="end-title"><div class="notebook"><h2 id="end-title">${esc(chapterOf(s).name)}</h2>
    <div class="bigstars" aria-label="${n} of 3 stars">${'★'.repeat(n)}${'☆'.repeat(3 - n)}</div><p>${verdict}</p><ul class="goals">${lines}</ul>
    ${has(s, 'orders') ? `<p>Final cash: <b>${money(s.cash)}</b></p>` : ''}</div>
    <div class="buttons"><button data-action="title">Menu</button><button data-action="replay">Replay</button>${hasNext && n > 0 ? '<button class="primary" data-action="next">Next chapter</button>' : ''}</div></div>`;
}

export function titleHtml(p: Progress, hasSave: boolean, saveLabel: string): string {
  const chapters = CHAPTERS.map((c, i) => {
    const unlocked = i === 0 || (p.stars[CHAPTERS[i - 1]!.id] ?? 0) > 0;
    const st = p.stars[c.id] ?? 0;
    return `<button class="chapter" data-action="start" data-arg="${c.id}" ${unlocked ? '' : 'disabled'}><span class="num">${c.index}</span><span><b>${esc(c.name)}</b><small>${c.year} · ${esc(c.place)}</small></span><span class="st">${
      unlocked ? `${'★'.repeat(st)}${'☆'.repeat(3 - st)}` : '🔒'
    }</span></button>`;
  }).join('');
  const diffs = Object.values(DIFFICULTIES)
    .map((d) => `<button data-action="difficulty" data-arg="${d.id}" aria-pressed="${p.difficulty === d.id}" title="${esc(d.blurb)}">${d.name}</button>`)
    .join('');
  return `<div class="title"><h1>Sewing<span>Factory</span>Mania</h1><p class="sub">Saigon, 1992. Six machines, a family workshop, and the whole world wanting shirts.</p>
    ${hasSave ? `<button class="primary big" data-action="continue">Continue <small>${esc(saveLabel)}</small></button>` : ''}
    <div class="chapters">${chapters}</div>
    <div class="row center"><span class="muted small">Difficulty</span><div class="seg">${diffs}</div></div>
    <p class="muted small center">Free, no ads, works offline. Inspired by DataCenterMania.</p></div>`;
}

export function introHtml(chapterId: string): string {
  const c = CHAPTERS.find((x) => x.id === chapterId)!;
  return `<div class="card" role="dialog" aria-labelledby="intro-title"><div class="mentor" aria-hidden="true">Chapter ${c.index} · ${c.year}</div><h2 id="intro-title">${esc(c.name)}</h2><p>${esc(c.intro)}</p>
    <ul class="goals">${c.starText.map((t, i) => `<li>${'★'.repeat(i + 1)} ${esc(t)}</li>`).join('')}</ul><div class="buttons"><button class="primary" data-action="introOk">Open the workshop</button></div></div>`;
}
