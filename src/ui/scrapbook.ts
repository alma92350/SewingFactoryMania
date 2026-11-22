/**
 * The factory scrapbook (PRD §11.1, §16): one "photo" per finished chapter with the people who
 * were there and the family's choices, and an epilogue after Chapter 7 that follows those choices.
 */
import { CHAPTERS, CHAPTER_BY_ID } from '../data/chapters';
import { COSMETICS, cosmetic, unlocked, type CosmeticSlot, type Cosmetics } from '../data/cosmetics';
import { stars } from '../sim/objectives';
import type { GameState } from '../sim/types';

export interface ScrapPage {
  stars: number;
  cash: number;
  crew: string[];
  choices: string[];
}

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Label of a campaign choice, from the chapter data ("ch5.scissors=lan" → "Give them to Lan"). */
export function choiceLabel(flag: string, id: string): string | null {
  if (flag === 'cat') return id === 'adopt' ? 'Adopted the factory cat' : 'Shooed the cat away';
  if (flag === 'ch9.betterNorth') return null;
  for (const c of CHAPTERS) {
    for (const f of [c.family, c.family2]) if (f?.flag === flag) return f.options.find((o) => o.id === id)?.label ?? null;
  }
  return null;
}

/** The page for a chapter that just ended. */
export function scrapPage(s: GameState): ScrapPage {
  const prefix = `${s.chapterId}.`;
  const choices = Object.entries(s.campaign)
    .filter(([k]) => k.startsWith(prefix) || (k === 'cat' && s.chapterId === 'ch3'))
    .map(([k, v]) => choiceLabel(k, v))
    .filter((x): x is string => !!x);
  const crew = s.workers
    .filter((w) => !/^(v\d+|w\d+)$/.test(w.id))
    .slice(0, 6)
    .map((w) => w.name);
  return { stars: stars(s), cash: Math.round(s.cash), crew, choices };
}

/** How the story ends, from the choices made along the way. */
export function epilogue(campaign: Record<string, string>): string[] {
  const out: string[] = [];
  out.push(
    campaign['ch7.ma'] === 'keep'
      ? 'Nobody was let go in 1997. People in the zone still talk about the factory where the lights stayed on for everyone.'
      : 'You closed a line in 1997 to save the rest. Some of those who left came back two years later, when the orders did.',
  );
  out.push(campaign['ch2.ut'] === 'osaka' ? 'Út’s Japanese address book kept the yukata coming for years.' : 'Út grew up on the factory floor and knows every machine by its sound.');
  if (campaign['ch4.flood'] === 'help') out.push('The old street never forgot the afternoon you closed to help in the flood.');
  if (campaign.cat === 'adopt') out.push('The cat had kittens in the cutting room. Every line has one now.');
  out.push(
    campaign['ch7.leung'] === 'rest'
      ? 'On Sundays the family eats at Má’s again, and nobody talks about orders until the fruit.'
      : 'In 1998 you open a fifth line. Má cuts the red ribbon with Bác Tư’s old scissors.',
  );
  return out;
}

/** Part II's ending (Chapter 10). */
export function epilogue2(campaign: Record<string, string>): string[] {
  const out: string[] = [];
  out.push(campaign['ch9.north'] === 'ut' ? 'Út stayed in Hà Nội, married a teacher from Nam Định, and runs the northern factory better than you ever did.' : 'Mr. Thắng retired in 2012; his apprentices still run the Hà Nội lines his way.');
  out.push(campaign['ch10.name'] === 'lan' ? 'Lan & Co. is in every shopping centre in Saigon. Lan, now seventy, refuses to wear anything else.' : 'Sài Gòn 1979 dresses three generations of the same families. Má keeps the first shirt in a frame.');
  out.push(campaign['ch8.birthday'] === 'afternoon' ? 'Everyone still remembers the afternoon the factory closed for Má’s seventieth birthday.' : 'The birthday dinner after work became a tradition: every year, the whole factory eats together.');
  out.push('The workshop with six machines is a museum now. The children of your first seamstresses come to see where it started.');
  return out;
}

export function scrapbookHtml(pages: Record<string, ScrapPage>, campaign: Record<string, string>): string {
  const done = CHAPTERS.filter((c) => pages[c.id]);
  const photos = done
    .map((c) => {
      const p = pages[c.id]!;
      return `<figure class="photo"><div class="snap" aria-hidden="true"><span>${c.year}</span></div><figcaption><b>${esc(c.name)}</b> <span class="muted small">${'★'.repeat(p.stars)}${'☆'.repeat(3 - p.stars)}</span>
        <div class="small">${p.crew.map(esc).join(', ')}</div>${p.choices.map((t) => `<div class="small muted">✎ <span>${esc(t)}</span></div>`).join('')}</figcaption></figure>`;
    })
    .join('');
  const end = (pages.ch7 ? `<h3>Epilogue</h3>${epilogue(campaign).map((t) => `<p>${esc(t)}</p>`).join('')}` : '') + (pages.ch10 ? `<h3>Epilogue · Part II</h3>${epilogue2(campaign).map((t) => `<p>${esc(t)}</p>`).join('')}` : '');
  return `<div class="card scrapbook" role="dialog" aria-labelledby="sb-title"><h2 id="sb-title">The factory scrapbook</h2>
    ${done.length ? `<div class="photos">${photos}</div>${end}` : '<p class="muted">Finish a chapter to add its photo.</p>'}
    <div class="buttons"><button class="primary" data-action="title">Menu</button></div></div>`;
}

/** Cosmetics picker on the title screen. */
export function cosmeticsHtml(chosen: Partial<Cosmetics>, totalStars: number, hasCat: boolean): string {
  const slots: [CosmeticSlot, string][] = [
    ['cap', 'Caps'],
    ['collar', 'Cat collar'],
    ['calendar', 'Wall calendar'],
    ['radio', 'Radio'],
  ];
  return slots
    .filter(([slot]) => slot !== 'collar' || hasCat)
    .map(([slot, label]) => {
      const cur = cosmetic(slot, chosen[slot]).id;
      const btns = COSMETICS[slot]
        .map((c) => {
          const ok = unlocked(c, totalStars);
          return `<button class="mini chip" data-action="cosmetic" data-arg="${slot}:${c.id}" aria-pressed="${cur === c.id}" ${ok ? '' : 'disabled'} title="${ok ? esc(c.name) : `${c.stars} ★`}">${c.colour ? `<span class="swatch" style="background:${c.colour}" aria-hidden="true"></span>` : ''}${ok ? esc(c.name) : `🔒 ${c.stars} ★`}</button>`;
        })
        .join('');
      return `<div class="cos"><span class="muted small">${label}</span><div class="chips">${btns}</div></div>`;
    })
    .join('');
}

export function isCampaignChapter(id: string): boolean {
  return !!CHAPTER_BY_ID[id] && CHAPTERS.some((c) => c.id === id);
}
