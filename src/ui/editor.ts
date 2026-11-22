/**
 * The scenario editor (PRD Phase 5): build a factory, pick buyers (or invent your own), choose a
 * season and an era, then play it or share it as a code or a link. Everything typed by the player
 * is escaped on the way in and sanitised again when a code is read.
 */
import { BUYERS } from '../data/buyers';
import { PRODUCTS } from '../data/products';
import {
  DAY_CHOICES,
  encodeScenario,
  LIMITS,
  sanitize,
  SCENARIO_BUYERS,
  SCENARIO_MODIFIERS,
  SCENARIO_PRODUCTS,
  SEASON_TEXT,
  type CustomBuyer,
  type Scenario,
  type SeasonId,
} from '../data/scenario';
import { MODIFIERS } from '../data/generated';
import { GALLERY } from '../data/gallery';
import { decodeScenario } from '../data/scenario';

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const STRICT: [string, string][] = [
  ['none', 'No inspection'],
  ['relaxed', 'Relaxed inspection'],
  ['normal', 'Normal inspection'],
  ['strict', 'Strict inspection'],
];

function options(list: [string | number, string][], cur: string | number): string {
  return list.map(([v, label]) => `<option value="${v}" ${String(v) === String(cur) ? 'selected' : ''}>${esc(label)}</option>`).join('');
}

const cap = (t: string) => t[0]!.toUpperCase() + t.slice(1);

export function scenarioEditorHtml(sc: Scenario, message = ''): string {
  const modern = sc.era === '2007';
  const buyers = SCENARIO_BUYERS.map((id) => {
    const b = BUYERS[id]!;
    const locked = id === 'atlantic' && !modern;
    return `<label class="check"><input type="checkbox" name="scn-buyer" value="${id}" ${sc.buyers.includes(id) && !locked ? 'checked' : ''} ${locked ? 'disabled' : ''}><span><b>${esc(b.name)}</b> <span class="muted small">${esc(b.origin)}${locked ? ' · only in 2007' : ''}</span></span></label>`;
  }).join('');
  const custom = sc.custom
    .map(
      (c: CustomBuyer, i) => `<fieldset class="custom"><legend>Your buyer ${i + 1}</legend>
      <label>Company <input data-cb="${i}:name" maxlength="${LIMITS.name}" value="${esc(c.name)}"></label>
      <label>Contact <input data-cb="${i}:contact" maxlength="${LIMITS.contact}" value="${esc(c.contact)}"></label>
      <label>From <input data-cb="${i}:origin" maxlength="${LIMITS.origin}" value="${esc(c.origin)}"></label>
      <label>Orders <select data-cb="${i}:product">${options(SCENARIO_PRODUCTS.map((p) => [p, cap(PRODUCTS[p]!.plural)]), c.product)}</select></label>
      <label>Inspection <select data-cb="${i}:inspection">${options(STRICT, c.inspection)}</select></label>
      <label>Habit <input data-cb="${i}:habit" maxlength="${LIMITS.habit}" value="${esc(c.habit)}"></label>
      <button class="mini" data-action="scnRemove" data-arg="${i}">Remove this buyer</button></fieldset>`,
    )
    .join('');
  const mods = SCENARIO_MODIFIERS.map((m) => {
    const d = MODIFIERS.find((x) => x.id === m)!;
    return `<label class="check"><input type="checkbox" name="scn-mod" value="${m}" ${sc.modifiers.includes(m) ? 'checked' : ''}><span><b>${esc(d.name)}</b> <span class="muted small">${esc(d.text)}</span></span></label>`;
  }).join('');
  const seasons = (Object.keys(SEASON_TEXT) as SeasonId[]).map((k) => [k, SEASON_TEXT[k].name] as [string, string]);
  return `<div class="card editor" role="dialog" aria-labelledby="ed-title"><h2 id="ed-title">Scenario editor</h2>
    <p class="small muted">Build a factory, choose your buyers, then play it or send its code to a friend.</p>
    ${message ? `<p class="note" role="status">${esc(message)}</p>` : ''}
    <div class="form">
      <label>Name <input id="scn-name" maxlength="${LIMITS.name}" value="${esc(sc.name)}"></label>
      <label>Lines <select id="scn-lines">${options([1, 2, 3, 4].map((n) => [n, `${n} line${n > 1 ? 's' : ''}`]), sc.lines)}</select></label>
      <label>Length <select id="scn-days">${options(DAY_CHOICES.map((d) => [d, d ? `${d} days` : 'Endless']), sc.days)}</select></label>
      <label>Starting cash ($) <input id="scn-cash" type="number" inputmode="numeric" min="${LIMITS.cashMin}" max="${LIMITS.cashMax}" step="100" value="${sc.cash}"></label>
      <label>Era <select id="scn-era">${options([['1990s', '1990s: faxes and bicycles'], ['2007', '2007: the WTO, American buyers']], sc.era)}</select></label>
      <label>Season <select id="scn-season">${options(seasons, sc.season)}</select></label>
      <p class="small muted" id="scn-season-text">${esc(SEASON_TEXT[sc.season].text)}</p>
      <fieldset><legend>Buyers</legend>${buyers}</fieldset>
      <fieldset><legend>Your own buyers</legend>${custom || '<p class="small muted">Invent a buyer: a company, a contact, a habit, what they order.</p>'}
      ${sc.custom.length < LIMITS.customBuyers ? '<button class="mini" data-action="scnAdd">Add a buyer</button>' : ''}</fieldset>
      <fieldset><legend>Trouble</legend>${mods}</fieldset>
      <label>Seed <input id="scn-seed" type="number" inputmode="numeric" min="1" max="999999" value="${sc.seed}"></label>
    </div>
    <p class="small muted">Share code</p><div class="share"><code id="scn-codeview">${esc(encodeScenario(sc))}</code></div>
    <div class="buttons"><button data-action="title">Menu</button><button data-action="scnCopy">Copy code</button><button data-action="scnLink">Copy link</button><button data-action="scnSubmit">Submit to the gallery</button><button class="primary" data-action="scnPlay">Play this scenario</button></div>
    <details class="ach"><summary>Load a code</summary><div class="row"><input id="scn-code" aria-label="Scenario code" placeholder="SFM1-…"><button class="mini" data-action="scnLoad">Load</button></div></details></div>`;
}

/** Read the editor's form back into a (sanitised) scenario. */
export function readScenarioForm(root: ParentNode, prev: Scenario): Scenario {
  const val = (id: string) => (root.querySelector(`#${id}`) as HTMLInputElement | HTMLSelectElement | null)?.value;
  const checked = (name: string) => [...root.querySelectorAll<HTMLInputElement>(`input[name="${name}"]:checked`)].map((x) => x.value);
  const custom = prev.custom.map((c, i) => {
    const f = (k: string) => (root.querySelector(`[data-cb="${i}:${k}"]`) as HTMLInputElement | HTMLSelectElement | null)?.value;
    return { name: f('name') ?? c.name, contact: f('contact') ?? c.contact, origin: f('origin') ?? c.origin, inspection: (f('inspection') ?? c.inspection) as CustomBuyer['inspection'], habit: f('habit') ?? c.habit, product: f('product') ?? c.product };
  });
  return sanitize({
    name: val('scn-name') ?? prev.name,
    lines: Number(val('scn-lines') ?? prev.lines),
    days: Number(val('scn-days') ?? prev.days),
    cash: Number(val('scn-cash') ?? prev.cash),
    era: (val('scn-era') ?? prev.era) as Scenario['era'],
    season: (val('scn-season') ?? prev.season) as SeasonId,
    buyers: checked('scn-buyer'),
    custom,
    modifiers: checked('scn-mod'),
    seed: Number(val('scn-seed') ?? prev.seed),
  });
}

/** The community gallery: curated scenarios, each playable or editable. */
export function galleryHtml(): string {
  const rows = GALLERY.map((g, i) => {
    const sc = decodeScenario(g.code);
    if (!sc) return '';
    const facts = [`${sc.lines} line${sc.lines > 1 ? 's' : ''}`, sc.days ? `${sc.days} days` : 'Endless', sc.era === '2007' ? '2007' : '1990s', ...(sc.season !== 'none' ? [SEASON_TEXT[sc.season].name] : [])];
    return `<div class="supplier"><div><b>${esc(g.title)}</b><div class="muted small">${facts.map(esc).join(' · ')} · <span>by</span> ${esc(g.author)}</div></div>
      <div class="row"><button class="mini" data-action="galEdit" data-arg="${i}">Open in editor</button><button class="mini primary" data-action="galPlay" data-arg="${i}">Play</button></div></div>`;
  }).join('');
  return `<div class="card editor" role="dialog" aria-labelledby="gal-title"><h2 id="gal-title">Community gallery</h2>
    <p class="small muted">Scenarios made by players and checked before they are added. Make your own in the scenario editor and press “Submit to the gallery”.</p>
    ${rows}<div class="buttons"><button data-action="title">Menu</button><button data-action="editor">Scenario editor</button></div></div>`;
}
