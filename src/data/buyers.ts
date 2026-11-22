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
  saigon: {
    id: 'saigon',
    name: 'Sông Sài Fashion House',
    contact: 'Anh Duy',
    habit: 'Young, in a hurry, pays on delivery. Dreams of a Vietnamese brand.',
    origin: 'Saigon',
    inspection: 'none',
    colour: '#8e24aa',
  },
  nordlicht: {
    id: 'nordlicht',
    name: 'Nordlicht Versand',
    contact: 'Mrs. Becker',
    habit: 'A German mail-order catalogue. Writes through an agent in Kowloon; checks every carton against the sample.',
    origin: 'Germany',
    inspection: 'strict',
    colour: '#455a64',
  },
  kansai: {
    id: 'kansai',
    name: 'Kansai Uniform Works',
    contact: 'Mr. Mori',
    habit: 'Makes uniforms for car plants. Introduced by Mr. Watanabe; quiet, punctual, loyal.',
    origin: 'Japan',
    inspection: 'normal',
    colour: '#5d4037',
  },
  atlantic: {
    id: 'atlantic',
    name: 'Atlantic Outfitters',
    contact: 'Mr. Brooks',
    habit: 'An American chain store. Huge orders, thin prices, compliance auditors with clipboards. Only after 2007.',
    origin: 'USA',
    inspection: 'normal',
    colour: '#283593',
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
