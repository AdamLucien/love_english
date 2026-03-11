import type { CefrLevel, UserStats } from './types';

export type RoadmapUnitId =
  // A3
  | 'a3-past-simple-vs-continuous'
  | 'a3-present-perfect-intro'
  | 'a3-comparisons'
  | 'a3-future-will-going-to'
  | 'a3-modal-verbs-basic'
  // B1
  | 'b1-present-perfect-continuous'
  | 'b1-past-perfect'
  | 'b1-modals-of-deduction'
  | 'b1-conditionals-0-1'
  | 'b1-passive-voice-basic'
  // B2
  | 'b2-conditionals-2-3'
  | 'b2-reported-speech'
  | 'b2-relative-clauses'
  | 'b2-gerund-vs-infinitive'
  | 'b2-used-to-would-get-used-to'
  | 'b2-modals-in-the-past'
  // C1
  | 'c1-mixed-conditionals'
  | 'c1-inversion'
  | 'c1-cleft-sentences'
  | 'c1-subjunctive'
  | 'c1-advanced-linkers'
  | 'c1-nuances-of-modals';

export interface RoadmapUnit {
  id: RoadmapUnitId;
  title: string;
  level: CefrLevel;
  prerequisites: RoadmapUnitId[];
  masteryThreshold: number; // 0..1
  topics: string[];
}

export const ROADMAP: RoadmapUnit[] = [
  {
    id: 'a3-past-simple-vs-continuous',
    title: 'Past Simple vs. Past Continuous',
    level: 'A3',
    prerequisites: [],
    masteryThreshold: 0.85,
    topics: ['Past Simple', 'Past Continuous', 'Time expressions', 'Story telling'],
  },
  {
    id: 'a3-present-perfect-intro',
    title: 'Present Perfect (intro)',
    level: 'A3',
    prerequisites: ['a3-past-simple-vs-continuous'],
    masteryThreshold: 0.85,
    topics: ['Present Perfect', 'Ever/Never/Just/Already/Yet', 'For vs Since (intro)'],
  },
  {
    id: 'a3-comparisons',
    title: 'Comparisons (as…as, than, -er/-est)',
    level: 'A3',
    prerequisites: ['a3-present-perfect-intro'],
    masteryThreshold: 0.85,
    topics: ['Comparatives', 'Superlatives', 'as…as', 'than'],
  },
  {
    id: 'a3-future-will-going-to',
    title: 'Future: will vs going to',
    level: 'A3',
    prerequisites: ['a3-comparisons'],
    masteryThreshold: 0.85,
    topics: ['will', 'be going to', 'Predictions vs plans'],
  },
  {
    id: 'a3-modal-verbs-basic',
    title: 'Modal verbs (can/must/should)',
    level: 'A3',
    prerequisites: ['a3-future-will-going-to'],
    masteryThreshold: 0.85,
    topics: ['can', 'must', 'should', 'have to', 'obligation vs advice'],
  },
  {
    id: 'b1-present-perfect-continuous',
    title: 'Present Perfect Continuous',
    level: 'B1',
    prerequisites: ['a3-modal-verbs-basic'],
    masteryThreshold: 0.85,
    topics: ['Present Perfect Continuous', 'for/since', 'duration', 'result vs activity'],
  },
  {
    id: 'b1-past-perfect',
    title: 'Past Perfect',
    level: 'B1',
    masteryThreshold: 0.85,
    prerequisites: ['b1-present-perfect-continuous'],
    topics: ['Past Perfect', 'Sequence of events', 'before/after', 'by the time'],
  },
  {
    id: 'b1-modals-of-deduction',
    title: 'Modals of deduction',
    level: 'B1',
    prerequisites: ['b1-past-perfect'],
    masteryThreshold: 0.85,
    topics: ['must/might/can’t', 'present deduction', 'evidence language'],
  },
  {
    id: 'b1-conditionals-0-1',
    title: '0. & 1. Conditional',
    level: 'B1',
    prerequisites: ['b1-modals-of-deduction'],
    masteryThreshold: 0.85,
    topics: ['Zero conditional', 'First conditional', 'unless', 'if vs when'],
  },
  {
    id: 'b1-passive-voice-basic',
    title: 'Passive Voice (basic)',
    level: 'B1',
    prerequisites: ['b1-conditionals-0-1'],
    masteryThreshold: 0.85,
    topics: ['Passive (present/past)', 'by-agent', 'when passive is used'],
  },
  {
    id: 'b2-conditionals-2-3',
    title: '2. & 3. Conditional',
    level: 'B2',
    prerequisites: ['b1-passive-voice-basic'],
    masteryThreshold: 0.85,
    topics: ['Second conditional', 'Third conditional', 'wish/if only (intro)'],
  },
  {
    id: 'b2-reported-speech',
    title: 'Reported Speech',
    level: 'B2',
    prerequisites: ['b2-conditionals-2-3'],
    masteryThreshold: 0.85,
    topics: ['Say/tell', 'backshifting', 'reported questions', 'time/place changes'],
  },
  {
    id: 'b2-relative-clauses',
    title: 'Relative Clauses',
    level: 'B2',
    prerequisites: ['b2-reported-speech'],
    masteryThreshold: 0.85,
    topics: ['who/which/that', 'defining vs non-defining', 'where/when', 'whose'],
  },
  {
    id: 'b2-gerund-vs-infinitive',
    title: 'Gerund vs. Infinitive',
    level: 'B2',
    prerequisites: ['b2-relative-clauses'],
    masteryThreshold: 0.85,
    topics: ['verb patterns', 'like/enjoy/avoid', 'want/decide/hope', 'stop/remember/try'],
  },
  {
    id: 'b2-used-to-would-get-used-to',
    title: 'Used to / Would / Get used to',
    level: 'B2',
    prerequisites: ['b2-gerund-vs-infinitive'],
    masteryThreshold: 0.85,
    topics: ['used to', 'would (past habits)', 'be/get used to', 'contrast'],
  },
  {
    id: 'b2-modals-in-the-past',
    title: 'Modals in the past',
    level: 'B2',
    prerequisites: ['b2-used-to-would-get-used-to'],
    masteryThreshold: 0.85,
    topics: ['should have', 'could have', 'might have', 'must have', 'regret & speculation'],
  },
  {
    id: 'c1-mixed-conditionals',
    title: 'Mixed Conditionals',
    level: 'C1',
    prerequisites: ['b2-modals-in-the-past'],
    masteryThreshold: 0.85,
    topics: ['mixed conditional patterns', 'time reference shifts', 'nuanced hypotheticals'],
  },
  {
    id: 'c1-inversion',
    title: 'Inversion (Hardly had I…)',
    level: 'C1',
    prerequisites: ['c1-mixed-conditionals'],
    masteryThreshold: 0.85,
    topics: ['negative adverbial inversion', 'hardly/scarcely/no sooner', 'formal style'],
  },
  {
    id: 'c1-cleft-sentences',
    title: 'Cleft sentences (It was then that…)',
    level: 'C1',
    prerequisites: ['c1-inversion'],
    masteryThreshold: 0.85,
    topics: ['it-clefts', 'what-clefts', 'emphasis', 'contrast'],
  },
  {
    id: 'c1-subjunctive',
    title: 'Subjunctive',
    level: 'C1',
    prerequisites: ['c1-cleft-sentences'],
    masteryThreshold: 0.85,
    topics: ['mandative subjunctive', 'suggest/insist', 'were-subjunctive (if I were)'],
  },
  {
    id: 'c1-advanced-linkers',
    title: 'Advanced linkers',
    level: 'C1',
    prerequisites: ['c1-subjunctive'],
    masteryThreshold: 0.85,
    topics: ['nevertheless', 'whereas', 'notwithstanding', 'insofar as', 'concession'],
  },
  {
    id: 'c1-nuances-of-modals',
    title: 'Nuances of modal verbs',
    level: 'C1',
    prerequisites: ['c1-advanced-linkers'],
    masteryThreshold: 0.85,
    topics: ['modal nuance', 'softening/hedging', 'degrees of certainty', 'politeness'],
  },
];

export function getUnitMastery(stats: UserStats | null, unitId: RoadmapUnitId): number {
  const v = stats?.mastery?.[unitId];
  if (typeof v !== 'number' || Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

export function isUnitUnlocked(stats: UserStats | null, unit: RoadmapUnit): boolean {
  const mastery = (id: RoadmapUnitId) => getUnitMastery(stats, id);
  return unit.prerequisites.every((pid) => mastery(pid) >= unit.masteryThreshold);
}

export function computeLevelFromMastery(stats: UserStats | null): CefrLevel {
  const m = (id: RoadmapUnitId) => getUnitMastery(stats, id);
  const c1Ok = m('c1-nuances-of-modals') >= 0.85;
  const b2Ok = m('b2-modals-in-the-past') >= 0.85;
  const b1Ok = m('b1-passive-voice-basic') >= 0.85;
  const a3Ok = m('a3-modal-verbs-basic') >= 0.85;
  if (c1Ok) return 'C1';
  if (b2Ok) return 'B2';
  if (b1Ok) return 'B1';
  if (a3Ok) return 'A3';
  return 'A2';
}

export function getUnitById(id: RoadmapUnitId) {
  return ROADMAP.find(u => u.id === id) || null;
}
