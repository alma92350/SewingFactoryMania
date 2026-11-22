import { pick, rand, randInt } from '../core/rng';
import { APPLICANT_NAMES, APPLICANT_NOTES, ROLE_NOTES, TRAITS, type Role, type TraitId } from '../data/people';
import type { MachineType } from '../data/products';
import { chapterOf } from './selectors';
import type { Applicant, GameState } from './types';

const r2 = (v: number) => Math.round(v * 100) / 100;

/** Three applicants each morning. The first morning of a chapter guarantees one of each special role. */
export function generateApplicants(s: GameState, firstMorning = false): Applicant[] {
  const roles = chapterOf(s).applicantRoles;
  if (roles.length === 0) return [];
  const taken = new Set(s.workers.map((w) => w.name));
  const out: Applicant[] = [];
  const wanted: Role[] = [];
  if (firstMorning) for (const r of roles) if (r !== 'operator') wanted.push(r);
  while (wanted.length < s.tuning.applicants) wanted.push(rand(s.rng) < 0.75 || roles.length === 1 ? 'operator' : pick(s.rng, roles));
  for (const role of wanted) {
    let name = pick(s.rng, APPLICANT_NAMES);
    for (let i = 0; taken.has(name) && i < 20; i++) name = pick(s.rng, APPLICANT_NAMES);
    taken.add(name);
    out.push(makeApplicant(s, role, name));
  }
  return out;
}

function makeApplicant(s: GameState, role: Role, name: string): Applicant {
  const base = () => r2(0.45 + rand(s.rng) * 0.45);
  const bh = base();
  const skill: Record<MachineType, number> = {
    lockstitch: base(),
    overlock: base(),
    buttonhole: bh,
    bartack: bh,
    cutting: r2(0.4 + rand(s.rng) * 0.25),
    qc: r2(0.3 + rand(s.rng) * 0.2),
  };
  if (role === 'qc') skill.qc = r2(0.8 + rand(s.rng) * 0.15);
  if (role === 'cutter') skill.cutting = r2(0.85 + rand(s.rng) * 0.12);
  if (role !== 'operator') skill.qc = role === 'qc' ? skill.qc : 0.3;
  const traits: TraitId[] = [];
  if (role === 'operator' && rand(s.rng) < 0.6) traits.push(pick(s.rng, Object.keys(TRAITS) as TraitId[]));
  const avg = (skill.lockstitch + skill.overlock) / 2;
  const wage = { mechanic: 2.2, qc: 1.7, cutter: 1.8, electrician: 2.4, leader: 2.8, operator: r2(0.9 + avg * 0.9) }[role];
  return {
    id: `a${s.day}-${randInt(s.rng, 1000, 9999)}-${name}`,
    name,
    role,
    skill,
    traits,
    wage,
    note: role === 'operator' ? pick(s.rng, APPLICANT_NOTES) : ROLE_NOTES[role],
  };
}
