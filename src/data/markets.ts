/**
 * Diversification (Chapter 7, PRD §11): when Korea stops buying, you look for new customers.
 * Each market costs money up front (samples, a trip, an agent's fee) and sends its first fax a
 * day or two later. Companies are fictional (D3).
 */
import type { QuoteOption } from './chapters';

export interface MarketDef {
  id: string;
  name: string;
  text: string;
  /** Paid when you start looking. */
  cost: number;
  /** Days until the first fax arrives (at 07:00). */
  delay: number;
  buyer: string;
  product: string;
  fob?: boolean;
  sample?: boolean;
  faxText: string;
  /** Quote options; `dueIn` is counted from the day the fax arrives. */
  options: (Omit<QuoteOption, 'dueDay'> & { dueIn: number })[];
}

export const MARKETS: MarketDef[] = [
  {
    id: 'saigon',
    name: 'A Saigon fashion house',
    text: 'Vietnamese shoppers have more money every year. Small orders, low prices, no inspection, quick.',
    cost: 40,
    delay: 1,
    buyer: 'saigon',
    product: 'shirt',
    faxText: 'We saw your shirts at the fair. Our first own collection, for the shops on Đồng Khởi street. Anh Duy.',
    options: [
      { label: 'First collection', qty: 600, price: 6.8, dueIn: 2 },
      { label: 'Two colours', qty: 800, price: 6.8, dueIn: 3 },
      { label: 'Every shop', qty: 1000, price: 6.6, dueIn: 3 },
    ],
  },
  {
    id: 'europe',
    name: 'A Hong Kong agent for Europe',
    text: 'Mr. Leung’s cousin sells to a German mail-order catalogue. Big orders and good prices, a strict inspector, and a sample first.',
    cost: 150,
    delay: 2,
    buyer: 'nordlicht',
    product: 'polo',
    sample: true,
    faxText: 'Polo shirts for the spring catalogue. We check every carton against the sample. Mrs. Becker, through Kowloon.',
    options: [
      { label: 'Trial lot', qty: 500, price: 13.5, dueIn: 3 },
      { label: 'Catalogue lot', qty: 650, price: 13.5, dueIn: 3 },
      { label: 'Big lot', qty: 800, price: 13.2, dueIn: 3 },
    ],
  },
  {
    id: 'uniform',
    name: 'Company uniforms for Japan',
    text: 'Mr. Watanabe knows a uniform maker in Osaka who needs a second factory. Steady work jackets, normal inspection.',
    cost: 80,
    delay: 1,
    buyer: 'kansai',
    product: 'workwear',
    faxText: 'Work jackets for a car factory in Aichi. Mr. Watanabe says you are careful. Mr. Mori.',
    options: [
      { label: 'First lot', qty: 400, price: 20, dueIn: 3 },
      { label: 'Two plants', qty: 550, price: 20, dueIn: 4 },
      { label: 'All plants', qty: 700, price: 19.5, dueIn: 4 },
    ],
  },
];

export const MARKET_BY_ID: Record<string, MarketDef> = Object.fromEntries(MARKETS.map((m) => [m.id, m]));
