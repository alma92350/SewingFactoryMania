/** Chapters 0–2 (PRD §11, Phase 1). Progressive disclosure is data: `systems` gates panels and commands. */
import type { MachineType } from './products';

export type SystemId = 'line' | 'orders' | 'hiring' | 'quality' | 'mechanic';

export interface QuoteOption {
  label: string;
  qty: number;
  /** USD per dozen. */
  price: number;
  dueDay: number;
}

export interface FaxDef {
  tag: string;
  buyer: string;
  product: string;
  text: string;
  options: QuoteOption[];
  optional: boolean;
  /** A sample must be approved before bulk sewing (Spot the Defect). */
  sample?: boolean;
  /** Campaign flag required for this fax to arrive, e.g. "ch1.uncle=accept". */
  requires?: string;
}

export type ScriptEvent =
  | { day: number; minute: number; kind: 'fax'; fax: FaxDef }
  | { day: number; minute: number; kind: 'absent'; worker: string; text: string }
  | { day: number; minute: number; kind: 'change'; tag: string; addPct: number; text: string };

export interface FamilyOption {
  id: string;
  label: string;
  effect: string;
}

export interface FamilyScene {
  flag: string;
  when: 'start' | 'end';
  title: string;
  body: string;
  options: FamilyOption[];
}

export interface ChapterDef {
  id: string;
  index: number;
  name: string;
  year: number;
  place: string;
  intro: string;
  days: number;
  systems: SystemId[];
  newSystems: SystemId[];
  stations: MachineType[];
  /** Worker id → starting station (null = bench). */
  crew: Record<string, number | null>;
  cash: number;
  rent: number;
  starText: [string, string, string];
  /** Ch0 only: an order already accepted at the start. */
  startOrder?: { tag: string; buyer: string; product: string; qty: number; price: number; dueDay: number };
  script: ScriptEvent[];
  family?: FamilyScene;
  /** Applicant roles available in this chapter. */
  applicantRoles: ('operator' | 'mechanic' | 'qc')[];
}

const L: MachineType = 'lockstitch';
const O: MachineType = 'overlock';
const B: MachineType = 'buttonhole';
const Q: MachineType = 'qc';

export const CHAPTERS: ChapterDef[] = [
  {
    id: 'ch0',
    index: 0,
    name: 'The Family Workshop',
    year: 1992,
    place: 'A shophouse in District 5, Saigon',
    intro:
      'Má opened this workshop in 1979. Today she hands you the keys. Six machines, a spare, seven seamstresses, and Cô Mai’s order of school shorts to finish by 16:30.',
    days: 1,
    systems: ['line'],
    newSystems: ['line'],
    stations: [O, L, L, L, L, O, L],
    crew: { hoa: 0, thao: 1, huong: 2, linh: 4, ngan: 5, trang: 6, lan: null },
    cash: 0,
    rent: 0,
    starText: ['Pack 290 shorts', 'Pack 340 shorts', 'Pack 370 shorts'],
    startOrder: { tag: 'comai', buyer: 'comai', product: 'shorts', qty: 500, price: 4, dueDay: 1 },
    script: [],
    applicantRoles: [],
    family: {
      flag: 'ch0.machines',
      when: 'end',
      title: 'Má hands over the keys',
      body: '“The machines are old, con. They kept this family alive for thirteen years. Keep them, or sell two and buy one good Japanese-style machine. Your choice.”',
      options: [
        { id: 'keep', label: 'Keep Má’s old machines', effect: '+$40 cash in later chapters, but machines break 20% more often' },
        { id: 'sell', label: 'Sell them for a better one', effect: '−$40 cash in later chapters, machines break 30% less often' },
      ],
    },
  },
  {
    id: 'ch1',
    index: 1,
    name: 'The First Fax',
    year: 1992,
    place: 'The shophouse and its back room',
    intro:
      'The fax machine screeches at 6:55. The Hanil buying office wants shirts for Korea, and the vessel will not wait. You have ten machines now, but only seven seamstresses.',
    days: 6,
    systems: ['line', 'orders', 'hiring'],
    newSystems: ['orders', 'hiring'],
    stations: [L, L, L, O, O, O, B, L, L, L],
    crew: { hoa: 3, thao: 2, huong: 1, linh: 0, ngan: 4, trang: 6, lan: 7 },
    cash: 150,
    rent: 6,
    starText: ['Ship Hanil’s shirts on time', '…and finish with $1,000 or more', '…and ship every order on time without overtime'],
    applicantRoles: ['operator'],
    script: [
      {
        day: 1,
        minute: 7 * 60,
        kind: 'fax',
        fax: {
          tag: 'hanil',
          buyer: 'hanil',
          product: 'shirt',
          text: 'Dear Sir/Madam. We need basic shirts for our Seoul client, CMT, fabric delivered today. Please choose. Ms. Park.',
          optional: false,
          options: [
            { label: 'Small and soon', qty: 1000, price: 7.4, dueDay: 4 },
            { label: 'Standard', qty: 1300, price: 7.6, dueDay: 5 },
            { label: 'Big and later', qty: 1600, price: 7.3, dueDay: 6 },
          ],
        },
      },
      {
        day: 2,
        minute: 10 * 60,
        kind: 'fax',
        fax: {
          tag: 'golden',
          buyer: 'golden',
          product: 'shorts',
          text: 'Your uncle says you are good people. Trial order, if you are fast. Mr. Leung.',
          optional: true,
          requires: 'ch1.uncle=accept',
          options: [{ label: 'Trial order', qty: 300, price: 4.8, dueDay: 6 }],
        },
      },
      { day: 3, minute: 7 * 60, kind: 'change', tag: 'hanil', addPct: 15, text: 'Ms. Park called at 21:00: “One more thing. The client wants 15% more shirts. Same vessel.”' },
    ],
    family: {
      flag: 'ch1.uncle',
      when: 'start',
      title: 'A letter from Uncle Sáu',
      body: '“Hong Kong is busy, nephew. My friend Mr. Leung needs a small factory for trial orders. He is fussy but he pays. Shall I give him your fax number?”',
      options: [
        { id: 'accept', label: 'Yes, introduce Mr. Leung', effect: 'A second order arrives on day 2: more work, more money, needed for ★★★' },
        { id: 'decline', label: 'Not yet, thank you', effect: 'A calmer chapter; Golden Harbour waits for later' },
      ],
    },
  },
  {
    id: 'ch2',
    index: 2,
    name: 'The Man with the Ruler',
    year: 1993,
    place: 'A rented hall in Tân Bình',
    intro:
      'Sakura-ya, a Japanese department store, sends Mr. Watanabe. He measures stitches with a ruler. Pass his inspection and they will order for years. Fail, and the whole lot comes back.',
    days: 6,
    systems: ['line', 'orders', 'hiring', 'quality', 'mechanic'],
    newSystems: ['quality', 'mechanic'],
    stations: [L, L, O, O, O, L, L, B, L, L, L, L, Q],
    crew: { linh: 0, lan: 1, hoa: 2, ngan: 3, huong: 4, thao: 5, trang: 6 },
    cash: 250,
    rent: 10,
    starText: ['Pass Sakura-ya’s inspection and ship', '…on the first inspection, with $1,400 or more', '…with zero defects found, Hanil’s reorder on time, no overtime'],
    applicantRoles: ['operator', 'mechanic', 'qc'],
    script: [
      {
        day: 1,
        minute: 7 * 60,
        kind: 'fax',
        fax: {
          tag: 'sakuraya',
          buyer: 'sakuraya',
          product: 'polo',
          text: 'Polo shirts for our summer catalogue. Strict inspection, AQL 1.0. A sample must be approved first. Watanabe.',
          optional: false,
          sample: true,
          options: [
            { label: 'Small lot', qty: 900, price: 12, dueDay: 4 },
            { label: 'Catalogue lot', qty: 1100, price: 12.5, dueDay: 5 },
            { label: 'Big lot', qty: 1300, price: 12, dueDay: 6 },
          ],
        },
      },
      {
        day: 3,
        minute: 7 * 60,
        kind: 'fax',
        fax: {
          tag: 'hanil2',
          buyer: 'hanil',
          product: 'shirt',
          text: 'Seoul liked your shirts. Reorder? Same price. Vessel on day 6. Ms. Park.',
          optional: true,
          options: [{ label: 'Reorder', qty: 600, price: 7.6, dueDay: 6 }],
        },
      },
      { day: 4, minute: 7 * 60, kind: 'absent', worker: 'lan', text: 'Lan has a fever and stays home today.' },
    ],
    family: {
      flag: 'ch2.ut',
      when: 'start',
      title: 'Út’s future',
      body: 'Your youngest sibling finished school. Má wants Út in the workshop. Út’s teacher says there is a scholarship to study textile engineering in Osaka.',
      options: [
        { id: 'join', label: 'Út joins the factory now', effect: 'Út joins the bench: a free quick learner' },
        { id: 'osaka', label: 'Út studies in Osaka', effect: 'Út writes with tips from Japanese factories: Sakura-ya samples are approved with the best rating' },
      ],
    },
  },
];

export const CHAPTER_BY_ID: Record<string, ChapterDef> = Object.fromEntries(CHAPTERS.map((c) => [c.id, c]));
