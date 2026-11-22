/** Fabric suppliers (PRD §6). Lead times are in game days; a roll is 100 metres. */

export interface SupplierDef {
  id: string;
  name: string;
  origin: string;
  /** USD per 100 m roll. */
  price: number;
  /** Share of rolls with weaving flaws, and share dyed off-shade. */
  flawed: number;
  offShade: number;
  leadDays: number;
  /** Chance a shipment is held at customs or late, and by how many days. */
  late: number;
  lateDays: number;
  /** Chance the whole shipment comes in the wrong colour. */
  wrongColour: number;
  note: string;
}

export const ROLL_METRES = 100;

export const SUPPLIERS: Record<string, SupplierDef> = {
  binhminh: {
    id: 'binhminh',
    name: 'Bình Minh Textile Union',
    origin: 'Vietnam (state mill)',
    price: 9,
    flawed: 0.1,
    offShade: 0.1,
    leadDays: 1,
    late: 0.2,
    lateDays: 1,
    wrongColour: 0,
    note: 'Cheap and close, but the shade changes from roll to roll.',
  },
  daegu: {
    id: 'daegu',
    name: 'Daegu Weaving Co.',
    origin: 'Korea, via Busan',
    price: 15,
    flawed: 0.03,
    offShade: 0.02,
    leadDays: 3,
    late: 0.35,
    lateDays: 1,
    wrongColour: 0,
    note: 'Beautiful fabric. Three days by sea, and customs can hold it.',
  },
  kowloon: {
    id: 'kowloon',
    name: 'Kowloon Fabric House',
    origin: 'Hong Kong',
    price: 18,
    flawed: 0.06,
    offShade: 0.05,
    leadDays: 2,
    late: 0.1,
    lateDays: 1,
    wrongColour: 0.2,
    note: 'Has everything, fast, at a price. Check the colour.',
  },
};
