/**
 * Number- and name-aware translator (the DataCenterMania approach).
 * Views and the canvas stay in English; when Vietnamese or French is on, every text segment is looked up
 * with numbers replaced by {n} and proper names (people, buyers, suppliers) by {p}, then the
 * values are put back in order. Segments are split on " · " so composite labels translate piece by piece.
 */
import { BUYERS } from '../data/buyers';
import { APPLICANT_NAMES, CREW } from '../data/people';
import { SUPPLIERS } from '../data/suppliers';
export type Lang = 'en' | 'vi' | 'fr';
export type TargetLang = Exclude<Lang, 'en'>;
export const LANGS: TargetLang[] = ['vi', 'fr'];
type Tips = Record<string, { title: string; body: string }>;

// Dictionaries are loaded on demand (performance pass): an English player never downloads them.
const DICTS: Record<TargetLang, Record<string, string>> = { vi: {}, fr: {} };
const NAME_MAPS: Record<TargetLang, Record<string, string>> = { vi: {}, fr: {} };
const TIPS_BY_LANG: Record<TargetLang, Tips> = { vi: {}, fr: {} };
const loaded = new Set<TargetLang>();
let lang: Lang = 'en';

/** Make a language usable synchronously (the loader below, and tests). */
export function registerLang(l: TargetLang, dict: Record<string, string>, names: Record<string, string>, tips: Tips): void {
  DICTS[l] = dict;
  NAME_MAPS[l] = names;
  TIPS_BY_LANG[l] = tips;
  loaded.add(l);
}

/** Fetch a language's dictionary (a separate chunk) if it is not loaded yet. */
export async function loadLang(l: Lang): Promise<void> {
  if (l === 'en' || loaded.has(l)) return;
  if (l === 'vi') {
    const m = await import('./vi');
    registerLang('vi', m.VI, m.VI_NAMES, m.VI_TIPS);
  } else {
    const m = await import('./fr');
    registerLang('fr', m.FR, m.FR_NAMES, m.FR_TIPS);
  }
}

export function isLoaded(l: Lang): boolean {
  return l === 'en' || loaded.has(l);
}

export function setLang(l: Lang): void {
  lang = l;
  document.documentElement.lang = l;
}

/** A mentor tip in the current language (whole text: tips contain markup). */
export function localTip(id: string): { title: string; body: string } | undefined {
  return lang === 'en' ? undefined : TIPS_BY_LANG[lang][id];
}
export function getLang(): Lang {
  return lang;
}

const NAMES = [
  ...Object.values(BUYERS).flatMap((b) => [b.name, b.contact]),
  ...Object.values(SUPPLIERS).map((s) => s.name),
  ...Object.values(CREW).map((c) => c.name),
  ...APPLICANT_NAMES,
  'Uncle Sáu',
  'Bác Tư',
  'Má',
  'Út',
  'Saigon Port',
  'Line A',
  'Line B',
  'Line C',
  'Line D',
]
  .filter((n, i, a) => a.indexOf(n) === i)
  .sort((a, b) => b.length - a.length);
// whole words only: "Lan" must not match inside "Language"
const NAME_RE = new RegExp(`(?<!\\p{L})(${NAMES.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})(?!\\p{L})`, 'gu');
const NUM_RE = /(\$?−?\d[\d,]*(?:\.\d+)?%?)/g;

/** The lookup key for a segment: names → {p}, numbers → {n}. Exported for the coverage test. */
export function keyOf(text: string): { key: string; names: string[]; nums: string[] } {
  const names: string[] = [];
  const nums: string[] = [];
  let key = text.replace(NAME_RE, (m) => {
    names.push(m);
    return '{p}';
  });
  key = key.replace(NUM_RE, (m) => {
    nums.push(m);
    return '{n}';
  });
  return { key, names, nums };
}

function fill(template: string, names: string[], nums: string[], l: TargetLang): string {
  let i = 0;
  let j = 0;
  return template.replace(/\{p\}|\{n\}/g, (m) => {
    if (m === '{n}') return nums[j++] ?? '';
    const name = names[i++] ?? '';
    return NAME_MAPS[l][name] ?? name; // a few names have a local form (Chuyền A, Ligne A, cảng Sài Gòn)
  });
}

export function hasTranslation(segment: string, l: TargetLang = 'vi'): boolean {
  const D = DICTS[l];
  const s = decode(segment.trim());
  if (s.startsWith('SewingFactoryMania #')) return true; // the share line stays the same in every language
  if (!/\p{L}/u.test(s)) return true;
  if (s.replace(/[^\p{L}]/gu, '').length <= 2) return true; // initials on avatars, single letters
  const { key } = keyOf(s);
  if (/^[{}pn\s·/:✓✗⛴×—…!,.()+−-]*$/.test(key)) return true; // only names and numbers
  if (key in D) return true;
  const m = key.match(/^(.*?\p{L}.*?)\s+(\{n\}[^\p{L}]*)$/u);
  return !!m && m[1]! in D;
}

const decode = (t: string) => t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const encode = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function translateSegment(seg: string): string {
  if (lang === 'en') return seg;
  const D = DICTS[lang];
  const lead = seg.match(/^\s*/)![0];
  const trail = seg.match(/\s*$/)![0];
  const core = seg.trim();
  if (!core || !/\p{L}/u.test(core)) return seg;
  const { key, names, nums } = keyOf(core);
  let hit = D[key];
  if (hit === undefined) {
    // "Collar {n}" → translate the label, keep the trailing numbers
    const m = key.match(/^(.*?\p{L}.*?)\s+(\{n\}[^\p{L}]*)$/u);
    if (m && D[m[1]!] !== undefined) hit = `${D[m[1]!]} ${m[2]}`;
  }
  return hit === undefined ? seg : lead + fill(hit, names, nums, lang) + trail;
}

/** Translate plain text (canvas labels, toasts). */
export function tr(text: string): string {
  if (lang === 'en' || !text) return text;
  const whole = translateSegment(text);
  if (whole !== text) return whole;
  // translate piece by piece, keeping the " · " separators
  return text
    .split(/(\s*·\s*)/)
    .map((part) => (/^\s*·\s*$/.test(part) ? part : translateSegment(part)))
    .join('');
}

/** Translate every text node and the aria-label/title attributes of an HTML string. */
export function trHtml(html: string): string {
  if (lang === 'en') return html;
  return html
    .replace(/>([^<>]+)</g, (_, txt: string) => `>${encode(tr(decode(txt)))}<`)
    .replace(/(aria-label|title)="([^"]*)"/g, (_, attr: string, v: string) => `${attr}="${encode(tr(decode(v)))}"`);
}

/** Split HTML into the text segments the translator sees (for the coverage test). */
export function segmentsOfHtml(html: string): string[] {
  const out: string[] = [];
  html.replace(/>([^<>]+)</g, (_, txt: string) => {
    if (txt.trim()) out.push(txt);
    return '';
  });
  return out;
}
