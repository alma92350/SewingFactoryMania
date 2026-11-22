/**
 * Phase 0 "Paper Pattern" content: one product, one line, seven workers.
 * All tuning numbers live here so balance changes never touch the simulation code.
 */
import type { MachineType } from '../sim/types';

export interface OperationDef {
  id: string;
  name: string;
  /** Standard minute value: minutes per piece at 100% efficiency. */
  smv: number;
  machine: MachineType;
}

export interface StationDef {
  machine: MachineType;
  /** Operation the station starts on; null = spare machine. */
  opId: string | null;
}

export interface WorkerDef {
  id: string;
  name: string;
  skill: Record<MachineType, number>;
  /** Station index at shift start; null = on the bench. */
  start: number | null;
  /** Operation the worker already knows from yesterday (starts near full speed). */
  familiar: string | null;
  note: string;
}

/** School shorts for Cô Mai: six operations. */
export const OPERATIONS: OperationDef[] = [
  { id: 'join', name: 'Join panels', smv: 0.9, machine: 'overlock' },
  { id: 'side', name: 'Side seams', smv: 1.0, machine: 'lockstitch' },
  { id: 'pocket', name: 'Back pocket', smv: 1.5, machine: 'lockstitch' },
  { id: 'waist', name: 'Waistband', smv: 1.1, machine: 'lockstitch' },
  { id: 'elastic', name: 'Elastic', smv: 0.8, machine: 'overlock' },
  { id: 'hem', name: 'Hem & trim', smv: 0.7, machine: 'lockstitch' },
];

/** Physical order of machines along the line (bundles still follow the operation order). */
export const STATIONS: StationDef[] = [
  { machine: 'overlock', opId: 'join' },
  { machine: 'lockstitch', opId: 'side' },
  { machine: 'lockstitch', opId: 'pocket' },
  { machine: 'lockstitch', opId: null },
  { machine: 'lockstitch', opId: 'waist' },
  { machine: 'overlock', opId: 'elastic' },
  { machine: 'lockstitch', opId: 'hem' },
];

export const WORKERS: WorkerDef[] = [
  { id: 'hoa', name: 'Hoa', skill: { lockstitch: 0.7, overlock: 0.95 }, start: 0, familiar: 'join', note: 'Overlock is her machine.' },
  { id: 'thao', name: 'Thảo', skill: { lockstitch: 0.85, overlock: 0.6 }, start: 1, familiar: 'side', note: 'Steady and careful.' },
  { id: 'huong', name: 'Hương', skill: { lockstitch: 0.65, overlock: 0.7 }, start: 2, familiar: null, note: 'Joined last month.' },
  { id: 'linh', name: 'Linh', skill: { lockstitch: 0.9, overlock: 0.55 }, start: 4, familiar: 'waist', note: 'Fast on straight seams.' },
  { id: 'ngan', name: 'Ngân', skill: { lockstitch: 0.6, overlock: 0.85 }, start: 5, familiar: 'elastic', note: 'Sings with the radio.' },
  { id: 'trang', name: 'Trang', skill: { lockstitch: 0.8, overlock: 0.65 }, start: 6, familiar: 'hem', note: 'Never misses a day.' },
  { id: 'lan', name: 'Lan', skill: { lockstitch: 1.0, overlock: 0.75 }, start: null, familiar: 'pocket', note: '14 years on the line. Pockets are her speciality.' },
];

export const TUNING = {
  bundleSize: 10,
  cutBundles: 50,
  shiftStart: 7 * 60,
  lunchStart: 11 * 60 + 30,
  lunchEnd: 12 * 60,
  shiftEnd: 16 * 60 + 30,
  /** Game minutes per real second at 1×. */
  gameMinutesPerSecond: 1.5,
  learnStart: 0.5,
  learnFamiliar: 0.85,
  learnPerPiece: 0.02,
  /** Breakdown chance per working minute, scaled up by wear. */
  breakBase: 0.0005,
  wearPerPiece: 0.006,
  wearFactor: 2,
  fixMinutes: 8,
  /** Game minutes to walk past one station. */
  walkPerStation: 0.6,
  /** Pieces for ★ / ★★ / ★★★. */
  stars: [290, 340, 370] as [number, number, number],
};

export type Tuning = typeof TUNING;

export const ORDER = { buyer: 'Cô Mai’s School', product: 'School shorts', target: TUNING.stars[0] };
