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
  /** Accumulated defect probability × pieces at the current operation. */
  pAcc: number;
}

export interface Station {
  index: number;
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
  absent: boolean;
  note: string;
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

export type OrderStatus = 'queued' | 'active' | 'shipped' | 'short';

export interface DefectCause {
  count: number;
  skill: number;
  learn: number;
  wear: number;
  fatigue: number;
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
}

export interface DecisionOption {
  id: string;
  label: string;
  detail?: string;
}

export type DecisionKind = 'fax' | 'family' | 'cutoff' | 'inspection' | 'change' | 'sample' | 'info';

export interface Decision {
  id: number;
  kind: DecisionKind;
  title: string;
  body: string;
  options: DecisionOption[];
  orderId?: number;
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
  mods: { breakdowns: number; defects: number; inspectionShift: number };
  day: number;
  minute: number;
  overtime: boolean;
  phase: 'shift' | 'report' | 'done';
  stations: Station[];
  workers: Worker[];
  agents: Agent[];
  repairQueue: number[];
  orders: Order[];
  activeOrderId: number | null;
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
