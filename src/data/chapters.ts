/** Chapters 0–2 (PRD §11, Phase 1). Progressive disclosure is data: `systems` gates panels and commands. */
import type { MachineType } from './products';

export type SystemId = 'line' | 'orders' | 'hiring' | 'quality' | 'mechanic' | 'sourcing' | 'cutting' | 'power' | 'leaders';

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
  /** FOB: you buy the fabric. Default CMT (the buyer supplies it). */
  fob?: boolean;
  /** Campaign flag required for this fax to arrive, e.g. "ch1.uncle=accept". */
  requires?: string;
}

export type ScriptEvent =
  | { day: number; minute: number; kind: 'fax'; fax: FaxDef }
  | { day: number; minute: number; kind: 'absent'; worker: string; text: string }
  | { day: number; minute: number; kind: 'change'; tag: string; addPct: number; text: string }
  | { day: number; minute: number; kind: 'flood'; text: string };

export interface FamilyOption {
  id: string;
  label: string;
  effect: string;
}

export interface FamilyScene {
  flag: string;
  /** 'event': pushed by a script event (e.g. the flood). */
  when: 'start' | 'end' | 'event';
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
  /** Optional: several lines (names and machines). When set, `stations` is ignored. */
  lines?: { name: string; stations: MachineType[] }[];
  /** Worker id → starting station (null = bench). */
  crew: Record<string, number | null>;
  cash: number;
  rent: number;
  starText: [string, string, string];
  /** Ch0 only: an order already accepted at the start. */
  startOrder?: { tag: string; buyer: string; product: string; qty: number; price: number; dueDay: number };
  script: ScriptEvent[];
  family?: FamilyScene;
  /** Days with rain (power cuts are more frequent, the roof leaks). */
  rainDays?: number[];
  /** Applicants at the gate each morning (default from tuning). */
  applicants?: number;
  /** Applicant roles available in this chapter. */
  applicantRoles: ('operator' | 'mechanic' | 'qc' | 'cutter' | 'electrician' | 'leader')[];
}

const L: MachineType = 'lockstitch';
const O: MachineType = 'overlock';
const B: MachineType = 'buttonhole';
const Q: MachineType = 'qc';
const C: MachineType = 'cutting';
const T: MachineType = 'bartack';

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
    starText: ['Ship Hanil’s shirts on time', '…and finish with $950 or more', '…and ship every order on time without overtime'],
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
            { label: 'Standard', qty: 1200, price: 8, dueDay: 5 },
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
  {
    id: 'ch3',
    index: 3,
    name: 'The Fabric Hunt',
    year: 1994,
    place: 'The hall, a warehouse and a cutting room',
    intro:
      'February 1994: the American embargo is lifted and everyone wants Vietnamese factories. Mr. Leung offers a real order, FOB: this time you buy the fabric yourself. Choose your suppliers well, inspect every roll, and keep the cutting table fed.',
    days: 7,
    systems: ['line', 'orders', 'hiring', 'quality', 'mechanic', 'sourcing', 'cutting'],
    newSystems: ['sourcing', 'cutting'],
    stations: [C, L, L, O, O, O, L, L, B, L, L, L, L, Q],
    crew: { linh: 1, lan: 2, hoa: 3, ngan: 4, huong: 5, thao: 6, trang: 7 },
    cash: 300,
    rent: 14,
    starText: ['Ship Mr. Leung’s work jackets on time', '…and finish with $1,500 or more', '…with no fabric defects, Hanil on time and no overtime'],
    applicantRoles: ['operator', 'mechanic', 'qc', 'cutter'],
    script: [
      {
        day: 1,
        minute: 7 * 60,
        kind: 'fax',
        fax: {
          tag: 'hanil3',
          buyer: 'hanil',
          product: 'shirt',
          text: 'Small CMT order while you wait for your fabric? Our fabric arrives with the truck today. Ms. Park.',
          optional: false,
          options: [{ label: 'CMT shirts', qty: 600, price: 7.6, dueDay: 3 }],
        },
      },
      {
        day: 1,
        minute: 7 * 60,
        kind: 'fax',
        fax: {
          tag: 'golden',
          buyer: 'golden',
          product: 'workwear',
          fob: true,
          text: 'Work jackets for a Kowloon shipyard. FOB: you buy the fabric, I pay more. No surprises, please. Mr. Leung.',
          optional: false,
          options: [
            { label: 'Small lot', qty: 700, price: 19, dueDay: 6 },
            { label: 'Shipyard lot', qty: 900, price: 19.5, dueDay: 7 },
            { label: 'Big lot', qty: 1100, price: 19, dueDay: 7 },
          ],
        },
      },
      {
        day: 5,
        minute: 7 * 60,
        kind: 'fax',
        fax: {
          tag: 'formosa',
          buyer: 'formosa',
          product: 'shorts',
          text: 'A friend in Taipei needs sports shorts quickly. Our fabric, CMT. Can you squeeze it in? Mrs. Lin.',
          optional: true,
          options: [{ label: 'Rush shorts', qty: 300, price: 4.8, dueDay: 7 }],
        },
      },
    ],
    family: {
      flag: 'ch3.loan',
      when: 'start',
      title: 'Má’s savings',
      body: '“Buying fabric before the buyer pays you is how factories die, con. I have $300 in the rice tin. Take it, and give me back $330 when the chapter is done.”',
      options: [
        { id: 'borrow', label: 'Borrow $300 from Má', effect: '+$300 now, −$330 at the end of the chapter' },
        { id: 'no', label: 'Keep Má’s savings safe', effect: 'Less cash to buy fabric early' },
      ],
    },
  },
  {
    id: 'ch4',
    index: 4,
    name: 'Rain and Darkness',
    year: 1994,
    place: 'Two lines in the hall, rainy season',
    intro:
      'August 1994. The rain comes every afternoon and the power goes with it. You now run two lines: work jackets on line A, jeans for Mrs. Lin on line B. You cannot be everywhere: hire line leaders, keep the generator ready, and keep the fabric off the wet floor.',
    days: 7,
    systems: ['line', 'orders', 'hiring', 'quality', 'mechanic', 'sourcing', 'cutting', 'power', 'leaders'],
    newSystems: ['power', 'leaders'],
    stations: [],
    lines: [
      { name: 'Line A', stations: [C, L, L, L, L, L, L, O, O, O, B, Q] },
      { name: 'Line B', stations: [L, L, L, L, L, L, O, O, O, B, T, Q] },
    ],
    crew: { linh: 1, lan: 2, hoa: 7, ngan: 8, huong: 3, thao: 4, trang: 5, tam: 0, thu: 11, bich: 12, cuc: 18, dung: 13, giang: 14, hanh: 6, kim: 19, phuong: 21, van: 15 },
    cash: 700,
    rent: 22,
    applicants: 6,
    rainDays: [2, 3, 4, 6],
    starText: ['Ship Mrs. Lin’s jeans and Mr. Leung’s jackets on time', '…and finish with $2,200 or more', '…with under 60 minutes lost to power cuts, no overtime, Sakura-ya on time'],
    applicantRoles: ['operator', 'mechanic', 'qc', 'cutter', 'electrician', 'leader'],
    script: [
      {
        day: 1,
        minute: 7 * 60,
        kind: 'fax',
        fax: {
          tag: 'formosa',
          buyer: 'formosa',
          product: 'jeans',
          text: 'Jeans for our Taipei shops, CMT: our denim arrives today. You did the shorts well. Mrs. Lin.',
          optional: false,
          options: [
            { label: 'Small run', qty: 700, price: 11, dueDay: 5 },
            { label: 'Shop run', qty: 900, price: 11.5, dueDay: 6 },
            { label: 'Big run', qty: 1100, price: 11, dueDay: 7 },
          ],
        },
      },
      {
        day: 1,
        minute: 7 * 60,
        kind: 'fax',
        fax: {
          tag: 'golden',
          buyer: 'golden',
          product: 'workwear',
          fob: true,
          text: 'The shipyard wants more jackets. Same as last time, FOB. Mr. Leung.',
          optional: false,
          options: [
            { label: 'Small lot', qty: 500, price: 19.5, dueDay: 5 },
            { label: 'Shipyard lot', qty: 600, price: 21.5, dueDay: 7 },
            { label: 'Big lot', qty: 900, price: 20, dueDay: 7 },
          ],
        },
      },
      {
        day: 3,
        minute: 7 * 60,
        kind: 'fax',
        fax: {
          tag: 'sakuraya',
          buyer: 'sakuraya',
          product: 'polo',
          text: 'Reorder of the summer polo, same approved sample. Strict inspection as always. Watanabe.',
          optional: true,
          options: [{ label: 'Reorder', qty: 400, price: 12.5, dueDay: 7 }],
        },
      },
      { day: 4, minute: 7 * 60, kind: 'flood', text: 'The street is under water. Trucks cannot reach the port today: every shipment in transit is a day late.' },
    ],
    family: {
      flag: 'ch4.flood',
      when: 'event',
      title: 'Flood in the old street',
      body: 'Má calls: the water is knee-high in the old street and the neighbours are carrying their sewing machines upstairs. Your workers have family there too.',
      options: [
        { id: 'help', label: 'Close the factory this afternoon and help', effect: 'Lose the afternoon; tomorrow two skilled neighbours ask for work' },
        { id: 'keep', label: 'Keep the lines running', effect: 'No time lost' },
      ],
    },
  },
];

export const CHAPTER_BY_ID: Record<string, ChapterDef> = Object.fromEntries(CHAPTERS.map((c) => [c.id, c]));
