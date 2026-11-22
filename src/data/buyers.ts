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
