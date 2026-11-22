/** Simulation tuning. Balance changes live here, never in the simulation code. */
export const TUNING = {
  bundleSize: 10,
  shiftStart: 7 * 60,
  lunchStart: 11 * 60 + 30,
  lunchEnd: 12 * 60,
  shiftEnd: 16 * 60 + 30,
  overtimeEnd: 19 * 60,
  /** Game minutes per real second at 1×. */
  gameMinutesPerSecond: 1.5,

  learnStart: 0.5,
  learnFamiliar: 0.85,
  learnPerPiece: 0.02,
  /** Learning kept overnight (people forget a little). */
  learnKeep: 1,

  breakBase: 0.0005,
  wearPerPiece: 0.006,
  wearFactor: 2,
  fixMinutes: 8,
  mechanicFixMinutes: 4,
  needleChangeMinutes: 3,
  /** Mechanics change needles on machines above this wear. */
  preventiveWear: 0.45,
  walkPerStation: 0.6,

  /** Fatigue per working minute (0..1), overtime multiplier, overnight recovery. */
  fatiguePerMinute: 0.0004,
  overtimeFatigue: 3,
  lunchRecovery: 0.08,
  nightRecovery: 0.75,
  fatigueSpeed: 0.3,
  fatigueDefects: 1.5,

  /** Quality model multipliers (see sim/quality.ts). */
  defectSkill: 1.5,
  defectLearn: 2,
  defectWear: 1.5,
  qcCatch: 0.75,
  reworkFactor: 1.5,

  /** Economy. */
  electricityPerMachine: 0.4,
  overtimeWagePremium: 1.5,
  airFreightShare: 0.5,
  shortShipPenaltyShare: 0.25,
  shipAnywayDiscount: 0.4,
  bankruptDays: 2,

  applicants: 4,

  /** Sourcing and cutting (Chapter 3+). */
  markerAuto: 0.78,
  markerBest: 0.92,
  cutterCatch: 0.6,
  flawedRisk: 0.08,
  palletsCost: 25,

  /** Power and weather (Chapter 4). */
  generatorStartMinutes: 8,
  electricianStartMinutes: 3,
  generatorFailUntested: 0.4,
  fuelPerHour: 4,

  /** People (Chapter 5+). */
  moraleStart: 0.7,
  moraleSpeed: 0.4,
  moraleDefects: 1,
  quitBelow: 0.35,
  quitChance: 0.3,
  sickChance: 0.025,
  overtimeCap: 3,
  overtimeMorale: 0.08,
  welfareMorale: 0.025,
  bonusDays: 5,
  tetReturnBase: 0.72,
  tetBonusReturn: 0.15,
  welfareCost: { fans: 60, canteen: 80, water: 25 } as Record<'fans' | 'canteen' | 'water', number>,
  mentorSkillPerPiece: 0.0006,
  mentorLearning: 1.8,
  mentorSeniorSpeed: 0.85,
};

export type Tuning = typeof TUNING;
