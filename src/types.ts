export type UserRole = 'admin' | 'student';

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  displayName?: string;
}

export type VocabCategory = 'Family' | 'Food' | 'House' | 'Work' | 'Nature' | 'Other';

export interface VocabularyWord {
  id?: string;
  word: string;
  translation: string;
  category: VocabCategory;
  example?: string;
  level: string;
}

export interface TestResult {
  id?: string;
  studentUid: string;
  testType: string;
  unitId?: string;
  score: number;
  total: number;
  timestamp: string;
}

export type CefrLevel = 'A1' | 'A2' | 'A3' | 'B1' | 'B2' | 'C1';

export interface UserStats {
  uid: string;
  seeds: number;   // currency
  flowers: number; // every 5 seeds -> +1 flower
  level: CefrLevel;
  // mastery keys are roadmap unit ids
  mastery?: Record<string, number>; // 0..1
  updatedAt: string;
}

export interface UnitTestQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation: string; // Czech
}

export interface UnitContentPack {
  unitId: string;
  level: CefrLevel;
  title: string;
  topics: string[];
  contextText: string; // English article
  grammarExplanation: string; // Czech
  testSuite: UnitTestQuestion[];
  createdAt: string;
  model?: string;
}

export interface GrammarExercise {
  id: string;
  question: string;
  options: string[];
  correctAnswer: string;
  explanation?: string;
}

export interface GrammarTest {
  id?: string;
  roadmapUnitId?: string;
  title: string;
  description?: string;
  level: string;
  questions: GrammarExercise[];
  createdAt: string;
}

export interface VocabularyWordEnriched extends VocabularyWord {
  ipa?: string;
  definition?: string;
  synonyms?: string[];
  wordLower?: string;
}

export interface AILesson {
  id?: string;
  topic: string;
  content: string;
  createdAt: string;
}
