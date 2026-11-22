/** Crew, traits and the applicant pool (PRD §7). */
import type { MachineType } from './products';

export type Role = 'operator' | 'mechanic' | 'qc';
export type TraitId = 'fastLoose' | 'careful' | 'oldHand' | 'quickLearner' | 'tireless' | 'radio';

export interface TraitDef {
  id: TraitId;
  name: string;
  text: string;
  speed: number;
  defects: number;
  learning: number;
  fatigue: number;
}

export const TRAITS: Record<TraitId, TraitDef> = {
  fastLoose: { id: 'fastLoose', name: 'Fast Hands, Loose Stitches', text: '+15% speed, +50% defects', speed: 1.15, defects: 1.5, learning: 1, fatigue: 1 },
  careful: { id: 'careful', name: 'Careful', text: '−10% speed, −50% defects', speed: 0.9, defects: 0.5, learning: 1, fatigue: 1 },
  oldHand: { id: 'oldHand', name: 'Old Cooperative Hand', text: '−40% defects, learns new styles slowly', speed: 1, defects: 0.6, learning: 0.6, fatigue: 1 },
  quickLearner: { id: 'quickLearner', name: 'Quick Learner', text: 'Learns new operations 60% faster', speed: 1, defects: 1, learning: 1.6, fatigue: 1 },
  tireless: { id: 'tireless', name: 'Tireless', text: 'Gets tired half as fast in overtime', speed: 1, defects: 1, learning: 1, fatigue: 0.5 },
  radio: { id: 'radio', name: 'Radio Singer', text: 'Neighbours sew 5% faster', speed: 1, defects: 1, learning: 1, fatigue: 1 },
};

export interface PersonDef {
  id: string;
  name: string;
  role: Role;
  skill: Record<MachineType, number>;
  traits: TraitId[];
  /** USD per day. */
  wage: number;
  /** Operations already known (start near full speed). */
  familiar: string[];
  note: string;
}

const sk = (lockstitch: number, overlock: number, buttonhole = 0.5, qc = 0.4): Record<MachineType, number> => ({ lockstitch, overlock, buttonhole, qc });

/** The original workshop crew. Chapters pick from this list. */
export const CREW: Record<string, PersonDef> = {
  hoa: { id: 'hoa', name: 'Hoa', role: 'operator', skill: sk(0.7, 0.95), traits: [], wage: 1.5, familiar: ['shorts.join'], note: 'Overlock is her machine.' },
  thao: { id: 'thao', name: 'Thảo', role: 'operator', skill: sk(0.85, 0.6, 0.6, 0.6), traits: ['careful'], wage: 1.5, familiar: ['shorts.side'], note: 'Steady and careful.' },
  huong: { id: 'huong', name: 'Hương', role: 'operator', skill: sk(0.65, 0.7), traits: ['quickLearner'], wage: 1.2, familiar: [], note: 'Joined last month.' },
  linh: { id: 'linh', name: 'Linh', role: 'operator', skill: sk(0.9, 0.55, 0.7), traits: ['fastLoose'], wage: 1.6, familiar: ['shorts.waist'], note: 'Fast on straight seams.' },
  ngan: { id: 'ngan', name: 'Ngân', role: 'operator', skill: sk(0.6, 0.85), traits: ['radio'], wage: 1.4, familiar: ['shorts.elastic'], note: 'Sings with the radio.' },
  trang: { id: 'trang', name: 'Trang', role: 'operator', skill: sk(0.8, 0.65, 0.8), traits: ['tireless'], wage: 1.5, familiar: ['shorts.hem'], note: 'Never misses a day.' },
  lan: { id: 'lan', name: 'Lan', role: 'operator', skill: sk(1.0, 0.75, 0.7, 0.7), traits: ['oldHand'], wage: 1.8, familiar: ['shorts.pocket'], note: '14 years on the line. Pockets are her speciality.' },
  ut: { id: 'ut', name: 'Út', role: 'operator', skill: sk(0.6, 0.6, 0.6, 0.6), traits: ['quickLearner', 'radio'], wage: 0, familiar: [], note: 'Your youngest sibling. Family: no wage.' },
};

export const APPLICANT_NAMES = [
  'Bích', 'Cúc', 'Dung', 'Giang', 'Hạnh', 'Hằng', 'Kim', 'Loan', 'Mỹ', 'Nga', 'Nhung', 'Oanh', 'Phượng', 'Quyên', 'Sương', 'Tâm', 'Thu', 'Thuý', 'Tuyết', 'Vân', 'Xuân', 'Yến',
  'Bảo', 'Dũng', 'Hải', 'Khánh', 'Minh', 'Phúc', 'Quang', 'Sơn', 'Tài', 'Vinh',
];

export const APPLICANT_NOTES = [
  'Came from Long An on the night bus.',
  'Her aunt works at the Phong Lan cooperative.',
  'Sewed at home for a tailor in Chợ Lớn.',
  'Fresh out of vocational school.',
  'Left a state factory that stopped paying.',
  'Wants to save for a Honda Cub.',
  'Sends money home to Bến Tre.',
  'Learned on her grandmother’s machine.',
];

/** Role-specific notes for mechanics and QC applicants. */
export const ROLE_NOTES: Record<Role, string> = {
  operator: '',
  mechanic: 'Fixes machines fast and changes needles before they snap.',
  qc: 'Checks every garment at the QC table and sends defects back for repair.',
};
