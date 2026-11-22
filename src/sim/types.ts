import type { RngState } from '../core/rng';
import type { Tuning } from '../data/prototype';

export type MachineType = 'lockstitch' | 'overlock';

export interface Bundle {
  id: number;
  pieces: number;
  /** Pieces completed at the current operation (fractional). */
  done: number;
}

export interface Station {
  index: number;
  machine: MachineType;
  opId: string | null;
  workerId: string | null;
  broken: boolean;
  /** 0..1, raises breakdown chance; reset by a fix. */
  wear: number;
  current: Bundle | null;
  pile: Bundle[];
  /** Pieces finished at this station today. */
  output: number;
}

export interface Worker {
  id: string;
  name: string;
  skill: Record<MachineType, number>;
  /** Station index, or null when on the bench. */
  station: number | null;
  /** Game minute the worker reaches the station (walking until then). */
  arriveAt: number;
  /** Where the current walk started (station index, null = bench) and when. */
  from: number | null;
  leftAt: number;
  /** Per-operation learning, 0..1. */
  learn: Record<string, number>;
  note: string;
}

export interface Director {
  /** Station being walked to / fixed, or null when idle in the office. */
  target: number | null;
  /** Position (station index; -1 = office). */
  pos: number;
  leftAt: number;
  arriveAt: number;
  fixUntil: number;
  queue: number[];
}

export interface GameState {
  version: 1;
  seed: number;
  rng: RngState;
  minute: number;
  tuning: Tuning;
  stations: Station[];
  workers: Worker[];
  director: Director;
  cutStack: number;
  nextBundleId: number;
  finished: number;
  breakdowns: number;
  ended: boolean;
}

export type SimEvent =
  | { kind: 'bundleDone'; station: number; to: number | null; pieces: number }
  | { kind: 'broke'; station: number }
  | { kind: 'fixed'; station: number }
  | { kind: 'lunch'; start: boolean }
  | { kind: 'ended' };
