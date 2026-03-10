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
  score: number;
  total: number;
  timestamp: string;
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
  title: string;
  description?: string;
  level: string;
  questions: GrammarExercise[];
  createdAt: string;
}
