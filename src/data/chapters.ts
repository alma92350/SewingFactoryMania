/** Chapters 0–2 (PRD §11, Phase 1). Progressive disclosure is data: `systems` gates panels and commands. */
import type { MachineType } from './products';

export type SystemId =
  | 'line'
  | 'orders'
  | 'hiring'
  | 'quality'
  | 'mechanic'
  | 'sourcing'
  | 'cutting'
  | 'power'
  | 'leaders'
  | 'morale'
  | 'training'
  | 'planning'
  | 'merchandising'
  | 'macro'
  | 'diversify'
  | 'quota'
  | 'compliance'
  | 'sites'
  | 'brand';

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
  | { day: number; minute: number; kind: 'flood'; text: string }
  | { day: number; minute: number; kind: 'bonus' }
  | { day: number; minute: number; kind: 'tet' }
  | { day: number; minute: number; kind: 'family2' }
  | { day: number; minute: number; kind: 'cat' }
  | { day: number; minute: number; kind: 'audit' }
  | { day: number; minute: number; kind: 'collection' }
  | { day: number; minute: number; kind: 'shock'; buyer: string; cutPct: number; text: string };

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
  lines?: { name: string; stations: MachineType[]; site?: string }[];
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
  /** A second family scene, pushed by a 'family2' or 'tet' script event. */
  family2?: FamilyScene;
  /** Extra experienced operators generated at the start (seeded), seated on empty machines. */
  extraCrew?: number;
  /** The Tết holiday day (Chapter 5). */
  tetDay?: number;
  /** Line leaders already in place at the start: worker id → line index. */
  crewLeads?: Record<string, number>;
  /** Generated chapters: faxes are generated every morning (Sandbox). */
  generator?: boolean;
  /** Stars by pieces packed (Daily Challenge), filled in by calibration. */
  scoreStars?: [number, number, number];
  /** Daily Challenge modifier. */
  modifier?: { id: string; name: string; text: string; emoji: string };
  /** Generated chapters: who sends faxes ([buyer, product, fob], repeated = more often). */
  faxPool?: [string, string, boolean][];
  /** Generated chapters: price, quantity and wage multipliers (seasons, the 2007 era). */
  priceMul?: number;
  qtyMul?: number;
  wageMul?: number;
  /** Scenario modifiers (the Daily Challenge ones, chosen by the player). */
  scenarioMods?: string[];
  /** Applicant roles available in this chapter. */
  applicantRoles: ('operator' | 'mechanic' | 'qc' | 'cutter' | 'electrician' | 'leader' | 'planner' | 'merchandiser')[];
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
      { day: 2, minute: 12 * 60, kind: 'cat' },
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
  {
    id: 'ch5',
    index: 5,
    name: 'Before Tết',
    year: 1995,
    place: 'Three lines and the Tết rush',
    intro:
      'January 1995. Everyone wants their shirts before Tết, and everyone wants to go home for Tết. Thirty people now work for you. Treat them well: after the holiday, only those who want to will come back from the provinces.',
    days: 8,
    tetDay: 5,
    rainDays: [],
    systems: ['line', 'orders', 'hiring', 'quality', 'mechanic', 'sourcing', 'cutting', 'power', 'leaders', 'morale', 'training'],
    newSystems: ['morale', 'training'],
    stations: [],
    lines: [
      { name: 'Line A', stations: [C, L, L, L, L, O, O, O, B, L, Q] },
      { name: 'Line B', stations: [L, L, L, L, L, L, O, O, O, B, T, Q] },
      { name: 'Line C', stations: [L, L, L, L, L, L, O, O, O, B, Q] },
    ],
    crew: { tam: 0, thu: 10, nhung: 22, quang: null, linh: 1, lan: 2, thao: 3, trang: 4, hoa: 5, ngan: 6, huong: 7, bich: 11, cuc: 17, dung: 12, giang: 13, hanh: 23, kim: 24, phuong: 14, van: 15 },
    crewLeads: { quang: 1 },
    extraCrew: 14,
    cash: 1200,
    rent: 30,
    applicants: 6,
    starText: ['Ship all three orders on time', '…with 90% back after Tết and $2,500 or more', '…with nobody quitting, no overtime and Sakura-ya on time'],
    applicantRoles: ['operator', 'mechanic', 'qc', 'cutter', 'electrician', 'leader'],
    script: [
      {
        day: 1,
        minute: 7 * 60,
        kind: 'fax',
        fax: {
          tag: 'hanil',
          buyer: 'hanil',
          product: 'shirt',
          text: 'Shirts for the Seoul New Year sales. The vessel before Tết is the last one. Ms. Park.',
          optional: false,
          options: [
            { label: 'Before Tết', qty: 900, price: 8, dueDay: 4 },
            { label: 'Big, before Tết', qty: 1100, price: 8.2, dueDay: 4 },
            { label: 'After Tết', qty: 1400, price: 7.8, dueDay: 7 },
          ],
        },
      },
      {
        day: 1,
        minute: 7 * 60,
        kind: 'fax',
        fax: {
          tag: 'formosa',
          buyer: 'formosa',
          product: 'jeans',
          text: 'Jeans again, CMT. Our denim comes with the truck. After Tết is fine. Mrs. Lin.',
          optional: false,
          options: [
            { label: 'Small run', qty: 700, price: 11.5, dueDay: 6 },
            { label: 'Shop run', qty: 900, price: 11.5, dueDay: 7 },
            { label: 'Big run', qty: 1100, price: 11.5, dueDay: 8 },
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
          text: 'Jackets for the shipyard, FOB as usual. Happy New Year in advance. Mr. Leung.',
          optional: false,
          options: [
            { label: 'Small lot', qty: 500, price: 21, dueDay: 7 },
            { label: 'Shipyard lot', qty: 600, price: 21, dueDay: 8 },
            { label: 'Big lot', qty: 800, price: 20.5, dueDay: 8 },
          ],
        },
      },
      { day: 4, minute: 15 * 60, kind: 'bonus' },
      { day: 5, minute: 7 * 60, kind: 'tet' },
      {
        day: 6,
        minute: 7 * 60,
        kind: 'fax',
        fax: {
          tag: 'sakuraya',
          buyer: 'sakuraya',
          product: 'polo',
          text: 'Akemashite omedetō. A small polo reorder for the spring catalogue, same sample. Watanabe.',
          optional: true,
          options: [{ label: 'Reorder', qty: 400, price: 12.5, dueDay: 8 }],
        },
      },
    ],
    family: {
      flag: 'ch5.scissors',
      when: 'start',
      title: 'Bác Tư’s scissors',
      body: 'Bác Tư is retiring to his village. Before he goes, he wants to give his old tailor’s scissors, and everything he knows, to one of your seamstresses.',
      options: [
        { id: 'lan', label: 'Give them to Lan', effect: 'Lan: every skill +15%, a new trait (−30% defects)' },
        { id: 'thao', label: 'Give them to Thảo', effect: 'Thảo: every skill +15%, a new trait (−30% defects)' },
        { id: 'linh', label: 'Give them to Linh', effect: 'Linh: every skill +15%, a new trait (−30% defects)' },
      ],
    },
    family2: {
      flag: 'ch5.tet',
      when: 'event',
      title: 'Tết at home',
      body: 'It is the first day of Tết. Your family waits at home with bánh chưng and the ancestors’ altar. A few workers say they would come in, for double pay.',
      options: [
        { id: 'home', label: 'Close the factory and go home', effect: 'No work today; the respect of everyone (no wages)' },
        { id: 'stay', label: 'Open with volunteers at double pay', effect: 'About 40% come in; wages doubled today' },
      ],
    },
  },
  {
    id: 'ch6',
    index: 6,
    name: 'The Export Zone',
    year: 1996,
    place: 'A new factory in an export processing zone',
    intro:
      'October 1996. You moved into a real factory in the export processing zone: four lines, a cutting room, an office with two telephones. Korea wants padded jackets for winter, Sakura-ya wants yukata, Mrs. Lin wants baby wear, and Mr. Zhou in Guangdong sends what his own factory cannot sew. You cannot answer every fax yourself any more.',
    days: 7,
    rainDays: [],
    systems: ['line', 'orders', 'hiring', 'quality', 'mechanic', 'sourcing', 'cutting', 'power', 'leaders', 'morale', 'training', 'planning', 'merchandising'],
    newSystems: ['planning', 'merchandising'],
    stations: [],
    lines: [
      { name: 'Line A', stations: [C, L, L, L, L, L, O, O, O, B, Q] },
      { name: 'Line B', stations: [L, L, L, L, L, L, O, O, O, O, B, T, Q] },
      { name: 'Line C', stations: [L, L, L, L, L, L, L, L, Q] },
      { name: 'Line D', stations: [L, L, L, L, L, L, L, L, O, O, O, O, B, T, Q] },
    ],
    crew: { tam: 0, thu: 10, nhung: 23, quang: null, hai: null, son: null, linh: 34, lan: 35, thao: 36, trang: 37, hoa: 6, ngan: 7, huong: 1, bich: 2, cuc: 17, dung: 11, giang: 12, hanh: 38, kim: 18, phuong: 13, van: 14 },
    crewLeads: { quang: 1, hai: 3 },
    extraCrew: 26,
    cash: 1800,
    rent: 45,
    applicants: 6,
    starText: ['Ship the padded jackets, the yukata and the baby wear on time', '…and finish with $4,500 or more', '…with every order on time, no overtime and nobody quitting'],
    applicantRoles: ['operator', 'mechanic', 'qc', 'cutter', 'electrician', 'leader', 'planner', 'merchandiser'],
    script: [
      {
        day: 1,
        minute: 7 * 60,
        kind: 'fax',
        fax: {
          tag: 'padded',
          buyer: 'hanil',
          product: 'padded',
          fob: true,
          text: 'Padded jackets for the Korean winter, FOB. This is our biggest order with you. Do not miss the vessel. Ms. Park.',
          optional: false,
          options: [
            { label: 'Early vessel', qty: 600, price: 30, dueDay: 6 },
            { label: 'Winter lot', qty: 750, price: 30, dueDay: 7 },
            { label: 'Big lot', qty: 900, price: 29, dueDay: 7 },
          ],
        },
      },
      {
        day: 1,
        minute: 7 * 60,
        kind: 'fax',
        fax: {
          tag: 'yukata',
          buyer: 'sakuraya',
          product: 'yukata',
          text: 'Yukata for the summer festivals, CMT. Delicate cotton, strict inspection, sample first. Watanabe.',
          optional: false,
          sample: true,
          options: [
            { label: 'Festival lot', qty: 400, price: 18, dueDay: 5 },
            { label: 'Catalogue lot', qty: 500, price: 18, dueDay: 6 },
            { label: 'Big lot', qty: 650, price: 17.5, dueDay: 7 },
          ],
        },
      },
      {
        day: 1,
        minute: 7 * 60,
        kind: 'fax',
        fax: {
          tag: 'baby',
          buyer: 'formosa',
          product: 'baby',
          text: 'Baby rompers, CMT, our cotton. Snaps must hold: mothers check. Mrs. Lin.',
          optional: false,
          options: [
            { label: 'Small run', qty: 800, price: 9, dueDay: 5 },
            { label: 'Shop run', qty: 1000, price: 9, dueDay: 6 },
            { label: 'Big run', qty: 1300, price: 8.8, dueDay: 7 },
          ],
        },
      },
      {
        day: 1,
        minute: 7 * 60,
        kind: 'fax',
        fax: {
          tag: 'shirts',
          buyer: 'hanil',
          product: 'shirt',
          text: 'And shirts, as always. CMT. Ms. Park.',
          optional: false,
          options: [
            { label: 'Shirts', qty: 900, price: 8.2, dueDay: 5 },
            { label: 'More shirts', qty: 1100, price: 8.2, dueDay: 6 },
            { label: 'Many shirts', qty: 1300, price: 8, dueDay: 7 },
          ],
        },
      },
      {
        day: 2,
        minute: 10 * 60,
        kind: 'fax',
        fax: {
          tag: 'pearl1',
          buyer: 'pearl',
          product: 'shorts',
          text: 'My factory is full. 400 shorts, CMT, in two days. Price is price. Zhou.',
          optional: true,
          options: [{ label: 'Overflow', qty: 400, price: 4, dueDay: 4 }],
        },
      },
      {
        day: 3,
        minute: 7 * 60,
        kind: 'fax',
        fax: {
          tag: 'favour',
          buyer: 'golden',
          product: 'workwear',
          text: 'Your uncle said you would help. 300 jackets, CMT, the shipyard cannot wait. I do not take no. Mr. Leung.',
          optional: false,
          requires: 'ch1.uncle=accept',
          options: [{ label: 'Uncle Sáu’s favour', qty: 300, price: 20, dueDay: 6 }],
        },
      },
      {
        day: 4,
        minute: 10 * 60,
        kind: 'fax',
        fax: {
          tag: 'pearl2',
          buyer: 'pearl',
          product: 'shirt',
          text: 'Again full. 500 shirts, CMT, by day 6. Zhou.',
          optional: true,
          options: [{ label: 'Overflow', qty: 500, price: 6.8, dueDay: 6 }],
        },
      },
    ],
    family: {
      flag: 'ch6.ut',
      when: 'start',
      title: 'Út comes back',
      body: 'Út is back: from the bench, or from Osaka with a degree and a Japanese address book. Út wants a real job in the new factory.',
      options: [
        { id: 'merch', label: 'Út runs the merchandising', effect: 'A free merchandiser who answers routine faxes' },
        { id: 'lead', label: 'Út leads line C', effect: 'A free line leader on the yukata line' },
      ],
    },
  },
  {
    id: 'ch7',
    index: 7,
    name: 'The Storm from the North',
    year: 1997,
    place: 'The export zone, December 1997',
    intro:
      'December 1997. Since the summer, money has been running away from Bangkok, Jakarta and Seoul. Your bank, frightened, called back most of its loan last week. Your four lines are full, your people have families, and Ms. Park has not called for two days. Má comes to the factory for the first time in a year. She does not say why.',
    days: 7,
    rainDays: [],
    systems: ['line', 'orders', 'hiring', 'quality', 'mechanic', 'sourcing', 'cutting', 'power', 'leaders', 'morale', 'training', 'planning', 'merchandising', 'macro', 'diversify'],
    newSystems: ['macro', 'diversify'],
    stations: [],
    lines: [
      { name: 'Line A', stations: [C, L, L, L, L, L, O, O, O, B, Q] },
      { name: 'Line B', stations: [L, L, L, L, L, L, O, O, O, O, B, T, Q] },
      { name: 'Line C', stations: [L, L, L, L, L, L, L, L, Q] },
      { name: 'Line D', stations: [L, L, L, L, L, L, L, L, O, O, O, O, B, T, Q] },
    ],
    crew: { tam: 0, thu: 10, nhung: 23, quang: null, hai: null, son: null, linh: 34, lan: 35, thao: 36, trang: 37, hoa: 6, ngan: 7, huong: 1, bich: 2, cuc: 17, dung: 11, giang: 12, hanh: 38, kim: 18, phuong: 13, van: 14, hien: null, tuan: null },
    crewLeads: { quang: 1, hai: 3 },
    extraCrew: 26,
    cash: 1500,
    rent: 45,
    applicants: 4,
    starText: ['Keep the factory open: finish with $3,000 or more', '…with every order on time and two new customers', '…with nobody laid off, no overtime and $4,500 or more'],
    applicantRoles: ['operator', 'mechanic', 'qc', 'cutter', 'electrician', 'leader', 'planner', 'merchandiser'],
    script: [
      {
        day: 1,
        minute: 7 * 60,
        kind: 'fax',
        fax: {
          tag: 'hanil7',
          buyer: 'hanil',
          product: 'shirt',
          text: 'Shirts for the spring, CMT, as every year. Ms. Park.',
          optional: false,
          options: [
            { label: 'Spring lot', qty: 1500, price: 8.2, dueDay: 6 },
            { label: 'Big spring lot', qty: 1800, price: 8.2, dueDay: 7 },
            { label: 'Everything', qty: 2100, price: 8, dueDay: 7 },
          ],
        },
      },
      {
        day: 1,
        minute: 7 * 60,
        kind: 'fax',
        fax: {
          tag: 'padded7',
          buyer: 'hanil',
          product: 'padded',
          fob: true,
          text: 'And padded jackets, FOB, for the late winter sale. Ms. Park.',
          optional: false,
          options: [
            { label: 'Late winter', qty: 600, price: 30, dueDay: 6 },
            { label: 'Big sale', qty: 750, price: 30, dueDay: 7 },
            { label: 'Everything', qty: 900, price: 29, dueDay: 7 },
          ],
        },
      },
      {
        day: 1,
        minute: 7 * 60,
        kind: 'fax',
        fax: {
          tag: 'yukata7',
          buyer: 'sakuraya',
          product: 'yukata',
          text: 'Yukata for next summer. Our customers buy less this year, so we buy carefully. Watanabe.',
          optional: false,
          options: [
            { label: 'Careful lot', qty: 400, price: 18, dueDay: 6 },
            { label: 'Usual lot', qty: 500, price: 18, dueDay: 7 },
            { label: 'Big lot', qty: 600, price: 17.5, dueDay: 7 },
          ],
        },
      },
      {
        day: 1,
        minute: 7 * 60,
        kind: 'fax',
        fax: {
          tag: 'golden7',
          buyer: 'golden',
          product: 'workwear',
          text: 'Hong Kong holds its dollar. The shipyards still need jackets. CMT. Mr. Leung.',
          optional: false,
          options: [
            { label: 'Shipyard lot', qty: 500, price: 20, dueDay: 6 },
            { label: 'Two shipyards', qty: 650, price: 20, dueDay: 7 },
            { label: 'All of them', qty: 800, price: 19.5, dueDay: 7 },
          ],
        },
      },
      {
        day: 2,
        minute: 7 * 60,
        kind: 'shock',
        buyer: 'hanil',
        cutPct: 60,
        text: 'The won has lost half its value in a month. Ms. Park faxed at midnight: Hanil cancels most of what is still to be sewn. Korean orders are down 60%.',
      },
      {
        day: 3,
        minute: 10 * 60,
        kind: 'fax',
        fax: {
          tag: 'pearl7',
          buyer: 'pearl',
          product: 'shirt',
          text: 'My Korean orders are gone too. I can only send a little. 300 shirts, CMT, cheap. Zhou.',
          optional: true,
          options: [{ label: 'A little', qty: 300, price: 6.4, dueDay: 5 }],
        },
      },
    ],
    family: {
      flag: 'ch7.leung',
      when: 'end',
      title: 'Uncle Sáu writes from Hong Kong',
      body: 'Uncle Sáu has watched the storm from Kowloon. He asks how the family came through it, and whether you will keep the factory for another year.',
      options: [
        { id: 'stay', label: 'We stay, and we grow again', effect: 'The scrapbook ends with a fifth line in 1998' },
        { id: 'rest', label: 'We stay, but slower', effect: 'The scrapbook ends with Sunday lunch at Má’s' },
      ],
    },
    family2: {
      flag: 'ch7.ma',
      when: 'event',
      title: 'Má’s advice',
      body: 'Má sits in your office with a glass of tea and watches line A run out of work. “I opened this workshop with six machines in 1979. The people out there built it with me, then with you. Do what you must, con. But think about who you are.”',
      options: [
        { id: 'keep', label: '“Never lay off the people who built this”', effect: 'Morale +10%; you cannot let anyone go this chapter. The hard path.' },
        { id: 'shrink', label: '“Keep the factory alive”: close the emptiest line', effect: 'Its workers go home with a week’s pay; the bank lends again (+$500); morale −10%. The safer path.' },
      ],
    },
  },
  {
    id: 'ch8',
    index: 8,
    name: 'The American Order',
    year: 2002,
    place: 'The export zone, part II',
    intro:
      'March 2002. The trade agreement with the United States came into force in December, and American chain stores have discovered Vietnam. Atlantic Outfitters sends its first order, a quota licence form and a code of conduct thicker than the order. Their auditor visits on day 3.',
    days: 7,
    rainDays: [],
    systems: ['line', 'orders', 'hiring', 'quality', 'mechanic', 'sourcing', 'cutting', 'power', 'leaders', 'morale', 'training', 'planning', 'merchandising', 'macro', 'diversify', 'quota', 'compliance'],
    newSystems: ['quota', 'compliance'],
    stations: [],
    lines: [
      { name: 'Line A', stations: [C, L, L, L, L, L, O, O, O, B, Q] },
      { name: 'Line B', stations: [L, L, L, L, L, L, O, O, O, O, B, T, Q] },
      { name: 'Line C', stations: [L, L, L, L, L, L, L, L, Q] },
      { name: 'Line D', stations: [L, L, L, L, L, L, L, L, O, O, O, O, B, T, Q] },
    ],
    crew: { tam: 0, thu: 10, nhung: 23, quang: null, hai: null, son: null, linh: 34, lan: 35, thao: 36, trang: 37, hoa: 6, ngan: 7, huong: 1, bich: 2, cuc: 17, dung: 11, giang: 12, hanh: 38, kim: 18, phuong: 13, van: 14, hien: null, tuan: null },
    crewLeads: { quang: 1, hai: 3 },
    extraCrew: 26,
    cash: 2500,
    rent: 45,
    applicants: 4,
    starText: ['Ship Atlantic’s orders on time', '…pass the first audit and finish with $4,500 or more', '…with every order on time and no overtime'],
    applicantRoles: ['operator', 'mechanic', 'qc', 'cutter', 'electrician', 'leader', 'planner', 'merchandiser'],
    script: [
      {
        day: 1,
        minute: 7 * 60,
        kind: 'fax',
        fax: {
          tag: 'us1',
          buyer: 'atlantic',
          product: 'polo',
          text: 'Polo shirts for 400 stores, CMT. Quota is your responsibility. Our auditor visits on day 3. Mr. Brooks.',
          optional: false,
          options: [
            { label: 'Test lot', qty: 900, price: 11, dueDay: 5 },
            { label: 'Spring lot', qty: 1100, price: 11, dueDay: 6 },
            { label: 'All stores', qty: 1300, price: 10.8, dueDay: 6 },
          ],
        },
      },
      {
        day: 1,
        minute: 7 * 60,
        kind: 'fax',
        fax: {
          tag: 'hanil8',
          buyer: 'hanil',
          product: 'shirt',
          text: 'Korea is buying again, carefully. Shirts, CMT. Ms. Park.',
          optional: false,
          options: [
            { label: 'Small lot', qty: 800, price: 7.6, dueDay: 5 },
            { label: 'Usual lot', qty: 1000, price: 7.6, dueDay: 6 },
            { label: 'Big lot', qty: 1200, price: 7.4, dueDay: 7 },
          ],
        },
      },
      {
        day: 1,
        minute: 7 * 60,
        kind: 'fax',
        fax: {
          tag: 'yukata8',
          buyer: 'sakuraya',
          product: 'yukata',
          text: 'Yukata, as every spring. The same care, please. Watanabe.',
          optional: false,
          options: [
            { label: 'Spring lot', qty: 400, price: 18, dueDay: 5 },
            { label: 'Usual lot', qty: 500, price: 18, dueDay: 6 },
            { label: 'Big lot', qty: 600, price: 17.5, dueDay: 7 },
          ],
        },
      },
      {
        day: 1,
        minute: 7 * 60,
        kind: 'fax',
        fax: {
          tag: 'us2',
          buyer: 'atlantic',
          product: 'jeans',
          fob: true,
          text: 'Jeans, FOB: you buy the denim. Same quota rules. If the audit goes well, there is much more. Mr. Brooks.',
          optional: false,
          options: [
            { label: 'Test lot', qty: 600, price: 12.5, dueDay: 7 },
            { label: 'Store lot', qty: 800, price: 12.5, dueDay: 7 },
            { label: 'Big lot', qty: 1000, price: 12.2, dueDay: 7 },
          ],
        },
      },
      { day: 3, minute: 13 * 60, kind: 'audit' },
      { day: 4, minute: 7 * 60, kind: 'family2' },
      {
        day: 4,
        minute: 10 * 60,
        kind: 'fax',
        fax: {
          tag: 'kansai8',
          buyer: 'kansai',
          product: 'workwear',
          text: 'A small lot of jackets for a new plant in Aichi, CMT. Mr. Mori.',
          optional: true,
          options: [{ label: 'New plant', qty: 400, price: 20, dueDay: 7 }],
        },
      },
      { day: 6, minute: 13 * 60, kind: 'audit' },
    ],
    family2: {
      flag: 'ch8.birthday',
      when: 'event',
      title: 'Má turns seventy',
      body: 'Today is Má’s seventieth birthday. Half the old crew knew her before they knew you. Lan asks, very politely, whether there will be a party.',
      options: [
        { id: 'afternoon', label: 'Close at noon: everyone to Má’s party', effect: 'Lose the afternoon; morale +10%' },
        { id: 'dinner', label: 'A dinner after work, for everyone', effect: 'Costs $120; morale +5%' },
      ],
    },
  },
  {
    id: 'ch9',
    index: 9,
    name: 'Two Cities',
    year: 2005,
    place: 'Saigon and Hà Nội',
    intro:
      'September 2005. Land in the zone is dear, Hà Nội is growing, and the northern workers are good. You opened a second factory near Hà Nội: two lines there, two lines in Saigon, one of you. You can only change things where you stand. A flight takes three hours.',
    days: 7,
    rainDays: [],
    systems: ['line', 'orders', 'hiring', 'quality', 'mechanic', 'sourcing', 'cutting', 'power', 'leaders', 'morale', 'training', 'planning', 'merchandising', 'macro', 'diversify', 'quota', 'compliance', 'sites'],
    newSystems: ['sites'],
    stations: [],
    lines: [
      { name: 'Line A', site: 'saigon', stations: [C, L, L, L, L, L, O, O, O, B, Q] },
      { name: 'Line B', site: 'saigon', stations: [L, L, L, L, L, L, O, O, O, O, B, T, Q] },
      { name: 'Line C', site: 'hanoi', stations: [L, L, L, L, L, L, L, O, O, B, Q] },
      { name: 'Line D', site: 'hanoi', stations: [L, L, L, L, L, L, O, O, O, O, B, T, Q] },
    ],
    crew: { tam: 0, huong: 1, bich: 2, linh: 3, lan: 4, thao: 5, hoa: 6, ngan: 7, thu: 10, dung: 11, giang: 12, hanh: 13, phuong: 14, van: 15, trang: 16, cuc: 17, kim: 18, nhung: 23, hong: 47, quang: null, hai: null, son: null, hien: null, tuan: null },
    crewLeads: { quang: 1, hai: 3 },
    extraCrew: 30,
    cash: 3000,
    rent: 60,
    applicants: 4,
    starText: ['Ship the four main orders on time', '…and finish with $4,500 or more', '…with no overtime and at most two flights'],
    applicantRoles: ['operator', 'mechanic', 'qc', 'cutter', 'electrician', 'leader', 'planner', 'merchandiser'],
    script: [
      {
        day: 1,
        minute: 7 * 60,
        kind: 'fax',
        fax: {
          tag: 'us9',
          buyer: 'atlantic',
          product: 'polo',
          text: 'Polos again, CMT. You passed the audit, so here is a bigger one. Mr. Brooks.',
          optional: false,
          options: [
            { label: 'Store lot', qty: 900, price: 11.2, dueDay: 6 },
            { label: 'Season lot', qty: 1100, price: 11.2, dueDay: 6 },
            { label: 'Big lot', qty: 1300, price: 11, dueDay: 7 },
          ],
        },
      },
      {
        day: 1,
        minute: 7 * 60,
        kind: 'fax',
        fax: {
          tag: 'hanil9',
          buyer: 'hanil',
          product: 'shirt',
          text: 'Shirts, CMT. Seoul is happy again. Ms. Park.',
          optional: false,
          options: [
            { label: 'Small lot', qty: 800, price: 7.8, dueDay: 5 },
            { label: 'Usual lot', qty: 1000, price: 7.8, dueDay: 6 },
            { label: 'Big lot', qty: 1200, price: 7.6, dueDay: 7 },
          ],
        },
      },
      {
        day: 1,
        minute: 7 * 60,
        kind: 'fax',
        fax: {
          tag: 'yukata9',
          buyer: 'sakuraya',
          product: 'yukata',
          text: 'Yukata. We hear you have a factory in the north now. The same care, please. Watanabe.',
          optional: false,
          options: [
            { label: 'Spring lot', qty: 400, price: 18, dueDay: 5 },
            { label: 'Usual lot', qty: 500, price: 18, dueDay: 6 },
            { label: 'Big lot', qty: 600, price: 17.5, dueDay: 7 },
          ],
        },
      },
      {
        day: 1,
        minute: 7 * 60,
        kind: 'fax',
        fax: {
          tag: 'baby9',
          buyer: 'formosa',
          product: 'baby',
          text: 'Baby rompers, CMT. Mothers check the snaps, as always. Mrs. Lin.',
          optional: false,
          options: [
            { label: 'Small run', qty: 800, price: 9, dueDay: 5 },
            { label: 'Shop run', qty: 1000, price: 9, dueDay: 6 },
            { label: 'Big run', qty: 1200, price: 8.8, dueDay: 7 },
          ],
        },
      },
      {
        day: 3,
        minute: 10 * 60,
        kind: 'fax',
        fax: {
          tag: 'pearl9',
          buyer: 'pearl',
          product: 'shorts',
          text: 'Full again, and the yuan is going up. 400 shorts, CMT. Zhou.',
          optional: true,
          options: [{ label: 'Overflow', qty: 400, price: 4.6, dueDay: 6 }],
        },
      },
    ],
    family: {
      flag: 'ch9.north',
      when: 'start',
      title: 'Who runs Hà Nội?',
      body: 'The northern factory needs someone you trust on the floor when you are in Saigon. Út offers to move north. A recruiter suggests Mr. Thắng, who ran a state garment factory in Nam Định.',
      options: [
        { id: 'ut', label: 'Út moves north', effect: 'A free leader on line C; Út misses the family' },
        { id: 'thang', label: 'Hire Mr. Thắng', effect: 'A leader on line C at $3.50/day; better applicants in Hà Nội' },
      ],
    },
  },
  {
    id: 'ch10',
    index: 10,
    name: 'Our Own Label',
    year: 2008,
    place: 'Saigon and Hà Nội, October 2008',
    intro:
      'October 2008. Saigon has motorbikes, cafés and young people with salaries, and they want clothes made here, by a name they know. You open two shops on Lê Lợi street for your own label. Then, in New York, a bank called Lehman Brothers falls, and the American orders start to shake.',
    days: 7,
    rainDays: [],
    systems: ['line', 'orders', 'hiring', 'quality', 'mechanic', 'sourcing', 'cutting', 'power', 'leaders', 'morale', 'training', 'planning', 'merchandising', 'macro', 'diversify', 'quota', 'compliance', 'sites', 'brand'],
    newSystems: ['brand'],
    stations: [],
    lines: [
      { name: 'Line A', site: 'saigon', stations: [C, L, L, L, L, L, O, O, O, B, Q] },
      { name: 'Line B', site: 'saigon', stations: [L, L, L, L, L, L, O, O, O, O, B, T, Q] },
      { name: 'Line C', site: 'hanoi', stations: [L, L, L, L, L, L, L, O, O, B, Q] },
      { name: 'Line D', site: 'hanoi', stations: [L, L, L, L, L, L, O, O, O, O, B, T, Q] },
    ],
    crew: { tam: 0, huong: 1, bich: 2, linh: 3, lan: 4, thao: 5, hoa: 6, ngan: 7, thu: 10, dung: 11, giang: 12, hanh: 13, phuong: 14, van: 15, trang: 16, cuc: 17, kim: 18, nhung: 23, hong: 47, quang: null, hai: null, son: null, hien: null, tuan: null },
    crewLeads: { quang: 1, hai: 3 },
    extraCrew: 30,
    cash: 2600,
    rent: 70,
    applicants: 4,
    starText: ['Sell 60% of your collection at full price and keep $3,500', '…ship every export order on time and finish with $6,000 or more', '…sell 90% at full price, with no overtime and nobody laid off'],
    applicantRoles: ['operator', 'mechanic', 'qc', 'cutter', 'electrician', 'leader', 'planner', 'merchandiser'],
    script: [
      { day: 1, minute: 7 * 60, kind: 'collection' },
      {
        day: 1,
        minute: 7 * 60,
        kind: 'fax',
        fax: {
          tag: 'us10',
          buyer: 'atlantic',
          product: 'polo',
          text: 'Holiday polos, CMT, the usual quota. Mr. Brooks.',
          optional: false,
          options: [
            { label: 'Store lot', qty: 900, price: 11.2, dueDay: 6 },
            { label: 'Holiday lot', qty: 1100, price: 11.2, dueDay: 6 },
            { label: 'Big lot', qty: 1300, price: 11, dueDay: 7 },
          ],
        },
      },
      {
        day: 1,
        minute: 7 * 60,
        kind: 'fax',
        fax: {
          tag: 'yukata10',
          buyer: 'sakuraya',
          product: 'yukata',
          text: 'Yukata for next summer. Japan is nervous; we order early. Watanabe.',
          optional: false,
          options: [
            { label: 'Careful lot', qty: 400, price: 18, dueDay: 6 },
            { label: 'Usual lot', qty: 500, price: 18, dueDay: 7 },
            { label: 'Big lot', qty: 600, price: 17.5, dueDay: 7 },
          ],
        },
      },
      {
        day: 1,
        minute: 7 * 60,
        kind: 'fax',
        fax: {
          tag: 'kansai10',
          buyer: 'kansai',
          product: 'workwear',
          text: 'Jackets for the car plants, CMT. Mr. Mori.',
          optional: false,
          options: [
            { label: 'First lot', qty: 400, price: 20, dueDay: 6 },
            { label: 'Two plants', qty: 500, price: 20, dueDay: 7 },
            { label: 'All plants', qty: 600, price: 19.5, dueDay: 7 },
          ],
        },
      },
      {
        day: 3,
        minute: 7 * 60,
        kind: 'shock',
        buyer: 'atlantic',
        cutPct: 50,
        text: 'Lehman Brothers has fallen and American shoppers have stopped spending. Mr. Brooks writes: Atlantic cancels half of everything not yet on the line.',
      },
    ],
    family: {
      flag: 'ch10.name',
      when: 'start',
      title: 'The label’s name',
      body: 'The sign painter is waiting on Lê Lợi street. Má wants the year she opened the workshop. Út wants the name of the woman who taught half the factory to sew.',
      options: [
        { id: 'heritage', label: '“Sài Gòn 1979”', effect: 'Older customers trust it, and Má’s friends run the shops: demand +30%, shops take 20% instead of 30%' },
        { id: 'lan', label: '“Lan & Co.”', effect: 'Young customers pay more but come less often: prices +15%, demand −15%' },
      ],
    },
  },
];

export const CHAPTER_BY_ID: Record<string, ChapterDef> = Object.fromEntries(CHAPTERS.map((c) => [c.id, c]));
