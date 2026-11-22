import type { RngState } from '../core/rng';
import type { FaxDef, SystemId } from '../data/chapters';
import type { DifficultyId } from '../data/difficulty';
import type { Role, TraitId } from '../data/people';
import type { MachineType } from '../data/products';
import type { Tuning } from '../data/tuning';

export type { MachineType, Role, TraitId, SystemId, DifficultyId };

export interface Bundle {
  id: number;
  orderId: number;
  pieces: number;
  /** Pieces completed at the current operation (fractional). */
  done: number;
  /** Defective pieces inside this bundle. */
  defects: number;
  /** Defects by the operation that caused them. */
  origins: Record<string, number>;
  /** A rework bundle returns to QC (or packing) after its repair operation. */
  rework: boolean;
  /** Condition of the roll it was cut from (sourcing chapters). */
  fabric?: RollCondition;
  /** Accumulated defect probability × pieces at the current operation. */
  pAcc: number;
}

export interface Station {
  index: number;
  /** Which sewing line the machine belongs to. */
  line: number;
  machine: MachineType;
  opId: string | null;
  workerId: string | null;
  broken: boolean;
  wear: number;
  /** A mechanic is changing the needle until this minute. */
  serviceUntil: number;
  current: Bundle | null;
  pile: Bundle[];
  /** Pieces finished here today (fractional). */
  output: number;
  /** Defective pieces made here today (for the quality overlay). */
  defects: number;
}

export interface Worker {
  id: string;
  name: string;
  role: Role;
  skill: Record<MachineType, number>;
  traits: TraitId[];
  wage: number;
  station: number | null;
  arriveAt: number;
  from: number | null;
  leftAt: number;
  learn: Record<string, number>;
  fatigue: number;
  /** 0..1: how the worker feels about the factory (Chapter 5+). */
  morale: number;
  absent: boolean;
  note: string;
  /** A senior who is teaching this worker (mentoring, Chapter 5+). */
  mentor: string | null;
  /** Off sick today (paid: sick pay), as opposed to on holiday. */
  sick?: boolean;
  /** Chapter 9+: the city where this worker lives and works (used while on the bench). */
  site?: string;
}

export interface Agent {
  id: string;
  kind: 'director' | 'mechanic';
  /** Station being walked to / serviced, or null. */
  target: number | null;
  task: 'fix' | 'needle' | null;
  /** Position: station index, -1 = office/corner. */
  pos: number;
  leftAt: number;
  arriveAt: number;
  until: number;
}

export interface Line {
  name: string;
  activeOrderId: number | null;
  /** Line leader (a worker with role "leader") who balances this line. */
  leaderId: string | null;
  /** Chapter 9+: the city this line is in. */
  site?: string;
}

export interface PowerState {
  off: boolean;
  rain: boolean;
  cuts: { start: number; end: number }[];
  generator: { running: boolean; startAt: number; tested: boolean };
  /** Everything stops between these minutes (the flood afternoon). */
  closedFrom: number;
  closedUntil: number;
  minutesLost: number;
}

export type RollCondition = 'good' | 'flawed' | 'offShade';

export interface Roll {
  id: number;
  orderId: number;
  metres: number;
  condition: RollCondition;
  /** Set aside after inspection: never cut. */
  rejected: boolean;
  supplier: string;
  /** Stored on pallets (safe from roof leaks). */
  dry: boolean;
}

export interface Shipment {
  id: number;
  supplier: string;
  orderId: number;
  rolls: number;
  cost: number;
  arriveDay: number;
  arriveMinute: number;
  delayed: boolean;
  wrongColour: boolean;
  status: 'transit' | 'arrived';
}

export type OrderStatus = 'queued' | 'active' | 'shipped' | 'short';

export interface DefectCause {
  count: number;
  skill: number;
  learn: number;
  wear: number;
  fatigue: number;
  fabric: number;
  byWorker: Record<string, number>;
}

export interface InspectionResult {
  day: number;
  lot: number;
  sample: number;
  found: number;
  accept: number;
  passed: boolean;
}

export interface Order {
  id: number;
  tag: string;
  buyer: string;
  product: string;
  qty: number;
  price: number;
  dueDay: number;
  originalDue: number;
  line: number;
  /** CMT: buyer supplies fabric. FOB: you buy it. */
  mode: 'cmt' | 'fob';
  /** Bundles still to be cut at the cutting table (sourcing chapters). */
  uncut: number;
  markerEff: number;
  markerSet: boolean;
  /** Fabric condition of each cut bundle waiting for the first operation. */
  cutFabric: RollCondition[];
  /** Pieces scrapped for fabric defects, waiting to be cut again. */
  recutPieces: number;
  status: OrderStatus;
  /** Bundles not yet cut into the line. */
  cut: number;
  finished: number;
  /** Defective pieces among the finished ones. */
  lotDefects: number;
  lotOrigins: Record<string, number>;
  sampleFactor: number;
  sampled: boolean;
  airFreight: boolean;
  discount: number;
  inspections: InspectionResult[];
  causes: Record<string, DefectCause>;
  caughtByQc: number;
  shippedDay: number | null;
  shippedPieces: number;
  revenue: number;
  onTime: boolean | null;
  /** American orders (Chapter 8+): export quota bought. */
  quotaPaid?: boolean;
}

export interface DecisionOption {
  id: string;
  label: string;
  detail?: string;
}

export type DecisionKind = 'fax' | 'family' | 'cutoff' | 'inspection' | 'change' | 'sample' | 'marker' | 'fabric' | 'power' | 'bonus' | 'info';

export interface Decision {
  id: number;
  kind: DecisionKind;
  title: string;
  body: string;
  options: DecisionOption[];
  orderId?: number;
  shipmentId?: number;
  fax?: FaxDef;
  flag?: string;
  addPct?: number;
}

export interface Applicant {
  id: string;
  name: string;
  role: Role;
  skill: Record<MachineType, number>;
  traits: TraitId[];
  wage: number;
  note: string;
}

export interface Ledger {
  revenue: number;
  materials: number;
  wages: number;
  rent: number;
  electricity: number;
  freight: number;
  penalties: number;
}

export interface DayReport {
  day: number;
  ledger: Ledger;
  cash: number;
  pieces: number;
  breakdowns: number;
  efficiency: number;
}

export interface GameState {
  version: 2;
  seed: number;
  rng: RngState;
  chapterId: string;
  difficulty: DifficultyId;
  campaign: Record<string, string>;
  systems: SystemId[];
  tuning: Tuning;
  mods: { breakdowns: number; defects: number; inspectionShift: number; suppliers?: number };
  day: number;
  minute: number;
  overtime: boolean;
  phase: 'shift' | 'report' | 'done';
  stations: Station[];
  warehouse: Roll[];
  shipments: Shipment[];
  /** Family loan to repay at the end of the chapter. */
  loan: number;
  pallets: boolean;
  power: PowerState | null;
  welfare: { fans: boolean; canteen: boolean; water: boolean };
  /** Tết (Chapter 5): the holiday day, whether the 13th-month bonus was paid, who came back. */
  tet: { bonusPaid: boolean; closed: boolean; volunteers: boolean; returned: number; left: string[] } | null;
  /** Merchandiser policy: which quote to pick on routine faxes, and whether to take optional orders. */
  policy: { quote: number; extras: boolean };
  /** Chapter 7: new markets being explored (the first fax arrives on `day`). */
  prospects: { market: string; day: number; sent: boolean }[];
  /** Chapter 9+: where the director is, and when the current flight lands (0 = on the ground). */
  director: { site: string; flightUntil: number } | null;
  /** Chapter 8: the US quota price per dozen (and its history). */
  quota: { price: number; history: number[] } | null;
  /** Chapter 8: the compliance audit. */
  audit: { visits: number; score: number; passed: boolean | null; firstPassed: boolean | null } | null;
  /** Chapter 7: the macro shock, once it has happened. */
  macro: { day: number; buyer: string; cutPieces: number } | null;
  /** Today the factory is closed (no wages, nobody sews). */
  closedToday: boolean;
  workers: Worker[];
  agents: Agent[];
  repairQueue: number[];
  orders: Order[];
  lines: Line[];
  nextId: number;
  cash: number;
  ledger: Ledger;
  history: DayReport[];
  decisions: Decision[];
  applicants: Applicant[];
  negativeDays: number;
  firedEvents: number[];
  stats: {
    breakdowns: number;
    dayBreakdowns: number;
    dayPieces: number;
    quietMinutes: number;
    dayMinutes: number;
    overtimeDays: number;
    quits: number;
    sickDays: number;
    leaderMoves: number;
    perfectSample: boolean;
    bestMarker: number;
    layoffs: number;
    flights?: number;
  };
  failed: string | null;
}

export type SimEvent =
  | { kind: 'bundleDone'; station: number; to: number | null }
  | { kind: 'broke'; station: number }
  | { kind: 'fixed'; station: number }
  | { kind: 'decision'; id: number }
  | { kind: 'shipped'; orderId: number; amount: number }
  | { kind: 'lunch'; start: boolean }
  | { kind: 'shiftEnd' }
  | { kind: 'note'; text: string };
