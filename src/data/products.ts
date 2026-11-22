/** Products as data: each is a sequence of operations with a standard minute value (SMV). */

export type MachineType = 'lockstitch' | 'overlock' | 'buttonhole' | 'bartack' | 'cutting' | 'qc';

export interface OperationDef {
  id: string;
  name: string;
  /** Minutes per piece at 100% efficiency. */
  smv: number;
  machine: MachineType;
  /** Base chance per piece of a defect at this operation (before skill, learning, wear, fatigue). */
  risk: number;
}

export interface ProductDef {
  id: string;
  name: string;
  plural: string;
  ops: OperationDef[];
  fabric: string;
  tie: string;
  /** Metres of fabric per piece at 100% marker efficiency. */
  metres: number;
}

const op = (product: string, id: string, name: string, smv: number, machine: MachineType, risk = 0.0025): OperationDef => ({
  id: `${product}.${id}`,
  name,
  smv,
  machine,
  risk,
});

export const PRODUCTS: Record<string, ProductDef> = {
  shorts: {
    id: 'shorts',
    name: 'school shorts',
    plural: 'shorts',
    fabric: '#2f4b7c',
    tie: '#e8c547',
    metres: 0.7,
    ops: [
      op('shorts', 'join', 'Join panels', 0.9, 'overlock'),
      op('shorts', 'side', 'Side seams', 1.0, 'lockstitch'),
      op('shorts', 'pocket', 'Back pocket', 1.5, 'lockstitch', 0.004),
      op('shorts', 'waist', 'Waistband', 1.1, 'lockstitch'),
      op('shorts', 'elastic', 'Elastic', 0.8, 'overlock'),
      op('shorts', 'hem', 'Hem & trim', 0.7, 'lockstitch'),
    ],
  },
  shirt: {
    id: 'shirt',
    name: 'basic shirt',
    plural: 'shirts',
    fabric: '#cfe0f2',
    tie: '#c0392b',
    metres: 1.3,
    ops: [
      op('shirt', 'collar', 'Collar', 1.92, 'lockstitch', 0.0045),
      op('shirt', 'cuffs', 'Cuffs', 1.2, 'lockstitch', 0.0025),
      op('shirt', 'placket', 'Front placket', 1.08, 'lockstitch', 0.0035),
      op('shirt', 'shoulders', 'Join shoulders', 0.72, 'overlock', 0.0025),
      op('shirt', 'sleeves', 'Set sleeves', 1.44, 'overlock', 0.0035),
      op('shirt', 'sides', 'Side seams', 1.2, 'overlock', 0.0025),
      op('shirt', 'holes', 'Buttonholes', 0.96, 'buttonhole', 0.002),
      op('shirt', 'buttons', 'Buttons & hem', 0.84, 'lockstitch', 0.0025),
    ],
  },
  polo: {
    id: 'polo',
    name: 'polo shirt',
    plural: 'polos',
    fabric: '#3f8f5f',
    tie: '#f3ead7',
    metres: 1.1,
    ops: [
      op('polo', 'placket', 'Placket', 1.68, 'lockstitch', 0.0065),
      op('polo', 'collar', 'Collar attach', 1.44, 'lockstitch', 0.00585),
      op('polo', 'shoulders', 'Shoulders', 0.72, 'overlock', 0.00325),
      op('polo', 'sleeves', 'Sleeves', 1.32, 'overlock', 0.00455),
      op('polo', 'sides', 'Side seams', 1.2, 'overlock', 0.00325),
      op('polo', 'slvhem', 'Sleeve hems', 0.96, 'lockstitch', 0.00325),
      op('polo', 'hem', 'Bottom hem', 0.84, 'lockstitch', 0.00325),
      op('polo', 'holes', 'Buttonholes', 0.6, 'buttonhole', 0.0026),
      op('polo', 'buttons', 'Buttons', 0.72, 'lockstitch', 0.00325),
      op('polo', 'label', 'Label', 0.48, 'lockstitch', 0.0026),
    ],
  },
};

PRODUCTS.workwear = {
  id: 'workwear',
  name: 'work jacket',
  plural: 'work jackets',
  fabric: '#5d6d7e',
  tie: '#f39c12',
  metres: 1.6,
  ops: [
    op('workwear', 'pockets', 'Patch pockets', 1.5, 'lockstitch', 0.0035),
    op('workwear', 'flaps', 'Pocket flaps', 1.1, 'lockstitch'),
    op('workwear', 'shoulders', 'Shoulders', 0.8, 'overlock'),
    op('workwear', 'sleeves', 'Set sleeves', 1.5, 'overlock', 0.0035),
    op('workwear', 'sides', 'Side seams', 1.3, 'overlock'),
    op('workwear', 'collar', 'Collar', 1.6, 'lockstitch', 0.004),
    op('workwear', 'placket', 'Front placket', 1.2, 'lockstitch'),
    op('workwear', 'holes', 'Buttonholes', 0.9, 'buttonhole', 0.002),
    op('workwear', 'buttons', 'Buttons', 0.8, 'lockstitch'),
    op('workwear', 'hem', 'Hem', 0.9, 'lockstitch'),
  ],
};

PRODUCTS.jeans = {
  id: 'jeans',
  name: 'jeans',
  plural: 'jeans',
  fabric: '#2c3e70',
  tie: '#e67e22',
  metres: 1.4,
  ops: [
    op('jeans', 'backpockets', 'Back pockets', 1.6, 'lockstitch', 0.004),
    op('jeans', 'frontpockets', 'Front pockets', 1.4, 'lockstitch', 0.0035),
    op('jeans', 'fly', 'Zip fly', 1.7, 'lockstitch', 0.0045),
    op('jeans', 'yoke', 'Yoke & seat', 1.2, 'overlock'),
    op('jeans', 'sides', 'Side seams', 1.3, 'overlock'),
    op('jeans', 'inseam', 'Inseam', 1.1, 'overlock'),
    op('jeans', 'waistband', 'Waistband', 1.5, 'lockstitch', 0.004),
    op('jeans', 'loops', 'Belt loops', 0.9, 'lockstitch'),
    op('jeans', 'holes', 'Buttonhole', 0.5, 'buttonhole', 0.002),
    op('jeans', 'tacks', 'Bartacks', 0.8, 'bartack', 0.002),
    op('jeans', 'hem', 'Hem', 0.8, 'lockstitch'),
  ],
};

/** The QC table and the cutting table are pseudo-operations shared by every product. */
export const QC_OP: OperationDef = { id: 'qc', name: 'QC table', smv: 0.25, machine: 'qc', risk: 0 };
export const CUT_OP: OperationDef = { id: 'cut', name: 'Cutting table', smv: 0.2, machine: 'cutting', risk: 0 };
/** Pseudo-operation for defects that come from the fabric itself (flaws, wrong shade). */
export const FABRIC_OP: OperationDef = { id: 'fabric', name: 'Fabric (roll)', smv: 0, machine: 'cutting', risk: 0 };

export const ALL_OPS: Record<string, OperationDef> = Object.fromEntries(
  [...Object.values(PRODUCTS).flatMap((p) => p.ops), QC_OP, CUT_OP, FABRIC_OP].map((o) => [o.id, o]),
);

export const MACHINE_LABEL: Record<MachineType, string> = {
  lockstitch: 'Lockstitch',
  overlock: 'Overlock',
  buttonhole: 'Buttonhole',
  bartack: 'Bartack',
  cutting: 'Cutting table',
  qc: 'QC table',
};
