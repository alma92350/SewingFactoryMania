/** Difficulty levels (PRD §12). All multipliers in one place. */

export type DifficultyId = 'apprentice' | 'seamstress' | 'lineleader';

export interface DifficultyDef {
  id: DifficultyId;
  name: string;
  blurb: string;
  cash: number;
  breakdowns: number;
  defects: number;
  /** Added to the buyer's accept number (positive = more forgiving). */
  inspectionShift: number;
  score: number;
}

export const DIFFICULTIES: Record<DifficultyId, DifficultyDef> = {
  apprentice: { id: 'apprentice', name: 'Apprentice', blurb: 'More cash, fewer breakdowns, forgiving inspectors.', cash: 2, breakdowns: 0.5, defects: 0.6, inspectionShift: 1, score: 0.5 },
  seamstress: { id: 'seamstress', name: 'Seamstress', blurb: 'The intended experience.', cash: 1, breakdowns: 1, defects: 1, inspectionShift: 0, score: 1 },
  lineleader: { id: 'lineleader', name: 'Line Leader', blurb: 'Tight cash, more breakdowns, stricter inspectors.', cash: 0.8, breakdowns: 1.3, defects: 1.25, inspectionShift: -1, score: 1.5 },
};
