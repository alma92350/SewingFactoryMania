/** Fictional buyers with a named contact and a habit (PRD §5.2, D3). */

export type Strictness = 'none' | 'relaxed' | 'normal' | 'strict';

export interface BuyerDef {
  id: string;
  name: string;
  contact: string;
  habit: string;
  origin: string;
  inspection: Strictness;
  colour: string;
}

export const BUYERS: Record<string, BuyerDef> = {
  comai: {
    id: 'comai',
    name: 'Cô Mai’s School',
    contact: 'Cô Mai',
    habit: 'Pays in cash and brings bánh bò for the workers.',
    origin: 'Saigon',
    inspection: 'none',
    colour: '#6a8f00',
  },
  hanil: {
    id: 'hanil',
    name: 'Hanil Apparel Buying Office',
    contact: 'Ms. Park',
    habit: 'Calls at 21:00 with “one more thing”.',
    origin: 'Korea',
    inspection: 'relaxed',
    colour: '#1565c0',
  },
  sakuraya: {
    id: 'sakuraya',
    name: 'Sakura-ya Department Store',
    contact: 'Mr. Watanabe',
    habit: 'Brings a ruler and white gloves. Very loyal once you pass.',
    origin: 'Japan',
    inspection: 'strict',
    colour: '#c2185b',
  },
  formosa: {
    id: 'formosa',
    name: 'Formosa Threadworks',
    contact: 'Mrs. Lin',
    habit: 'Sells you thread and machines, and sends small orders to friends.',
    origin: 'Taiwan',
    inspection: 'normal',
    colour: '#00897b',
  },
  pearl: {
    id: 'pearl',
    name: 'Pearl River Garments',
    contact: 'Mr. Zhou',
    habit: 'Sends his overflow when his own factory is full. Urgent, cheap, never twice the same.',
    origin: 'Guangdong',
    inspection: 'relaxed',
    colour: '#6d4c41',
  },
  golden: {
    id: 'golden',
    name: 'Golden Harbour Trading',
    contact: 'Mr. Leung',
    habit: 'Loves karaoke, hates surprises. Introduced by Uncle Sáu.',
    origin: 'Hong Kong',
    inspection: 'relaxed',
    colour: '#e65100',
  },
};
