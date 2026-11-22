/**
 * Number- and name-aware translator (the DataCenterMania approach).
 * Views and the canvas stay in English; when Vietnamese is on, every text segment is looked up
 * with numbers replaced by {n} and proper names (people, buyers, suppliers) by {p}, then the
 * values are put back in order. Segments are split on " · " so composite labels translate piece by piece.
 */
import { BUYERS } from '../data/buyers';
import { APPLICANT_NAMES, CREW } from '../data/people';
import { SUPPLIERS } from '../data/suppliers';
import { VI, VI_NAMES } from './vi';

export type Lang = 'en' | 'vi';
let lang: Lang = 'en';

export function setLang(l: Lang): void {
  lang = l;
  document.documentElement.lang = l;
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

function fill(template: string, names: string[], nums: string[]): string {
  let i = 0;
  let j = 0;
  return template.replace(/\{p\}|\{n\}/g, (m) => {
    if (m === '{n}') return nums[j++] ?? '';
    const name = names[i++] ?? '';
    return VI_NAMES[name] ?? name; // a few names have a Vietnamese form (Chuyền A, cảng Sài Gòn)
  });
}

export function hasTranslation(segment: string): boolean {
  const s = decode(segment.trim());
  if (s.startsWith('SewingFactoryMania #')) return true; // the share line stays the same in every language
  if (!/\p{L}/u.test(s)) return true;
  if (s.replace(/[^\p{L}]/gu, '').length <= 2) return true; // initials on avatars, single letters
  const { key } = keyOf(s);
  if (/^[{}pn\s·/:✓✗⛴×—…!,.()+−-]*$/.test(key)) return true; // only names and numbers
  if (key in VI) return true;
  const m = key.match(/^(.*?\p{L}.*?)\s+(\{n\}[^\p{L}]*)$/u);
  return !!m && m[1]! in VI;
}

const decode = (t: string) => t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
const encode = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function translateSegment(seg: string): string {
  const lead = seg.match(/^\s*/)![0];
  const trail = seg.match(/\s*$/)![0];
  const core = seg.trim();
  if (!core || !/\p{L}/u.test(core)) return seg;
  const { key, names, nums } = keyOf(core);
  let hit = VI[key];
  if (hit === undefined) {
    // "Collar {n}" → translate the label, keep the trailing numbers
    const m = key.match(/^(.*?\p{L}.*?)\s+(\{n\}[^\p{L}]*)$/u);
    if (m && VI[m[1]!] !== undefined) hit = `${VI[m[1]!]} ${m[2]}`;
  }
  return hit === undefined ? seg : lead + fill(hit, names, nums) + trail;
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
