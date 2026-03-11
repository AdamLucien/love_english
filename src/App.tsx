import React, { useState, useEffect, createContext, useContext } from 'react';
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  onSnapshot, 
  query, 
  where,
  addDoc,
  getDocs,
  handleFirestoreError,
  OperationType,
  writeBatch,
  orderBy,
  deleteDoc
} from './firebase';
import { GoogleGenAI, Type } from "@google/genai";
import { UserProfile, UserRole, VocabularyWord, TestResult, VocabCategory, GrammarTest, GrammarExercise, UserStats, VocabularyWordEnriched, UnitContentPack, AILesson } from './types';
import { ROADMAP, type RoadmapUnitId, computeLevelFromMastery, getUnitMastery, isUnitUnlocked } from './roadmap';
import { 
  BookOpen, 
  GraduationCap, 
  LayoutDashboard, 
  LogOut, 
  Plus, 
  Settings, 
  User, 
  CheckCircle2, 
  XCircle, 
  ChevronRight, 
  Search,
  FileJson,
  BarChart3,
  BrainCircuit,
  Home,
  Briefcase,
  Leaf,
  Users,
  Utensils,
  Flower,
  Heart,
  Sparkles,
  Lock,
  MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import Markdown from 'react-markdown';
import { GardenDisplay } from './components/GardenDisplay';
import { UnitPlayer } from './components/UnitPlayer';
import { Cockpit } from './components/Cockpit';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

// --- Utility ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function normalizeWord(w: string) {
  return w.trim().toLowerCase();
}

function safeJsonParse<T = any>(text: string): { ok: true; data: T } | { ok: false; error: string } {
  try {
    return { ok: true, data: JSON.parse(text) as T };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function isValidGeneratedGrammarTest(x: any): x is { title: string; description?: string; questions: any[] } {
  if (!x || typeof x !== 'object') return false;
  if (typeof x.title !== 'string' || !Array.isArray(x.questions)) return false;
  for (const q of x.questions) {
    if (!q || typeof q !== 'object') return false;
    if (typeof q.question !== 'string') return false;
    if (!Array.isArray(q.options) || q.options.some((o: any) => typeof o !== 'string')) return false;
    if (typeof q.correctAnswer !== 'string') return false;
    if (q.explanation != null && typeof q.explanation !== 'string') return false;
  }
  return true;
}

function isValidUnitContentPack(x: any): x is UnitContentPack {
  if (!x || typeof x !== 'object') return false;
  if (typeof x.unitId !== 'string') return false;
  if (typeof x.level !== 'string') return false;
  if (typeof x.title !== 'string') return false;
  if (!Array.isArray(x.topics) || x.topics.some((t: any) => typeof t !== 'string')) return false;
  if (typeof x.contextText !== 'string') return false;
  if (typeof x.grammarExplanation !== 'string') return false;
  if (!Array.isArray(x.testSuite) || x.testSuite.length < 5) return false;
  for (const q of x.testSuite) {
    if (!q || typeof q !== 'object') return false;
    if (typeof q.question !== 'string') return false;
    if (!Array.isArray(q.options) || q.options.some((o: any) => typeof o !== 'string')) return false;
    if (typeof q.correctAnswer !== 'string') return false;
    if (typeof q.explanation !== 'string') return false;
  }
  if (typeof x.createdAt !== 'string') return false;
  return true;
}

function masteryFromResults(results: TestResult[]): number {
  if (!results.length) return 0;
  const recent = results
    .slice()
    .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
    .slice(0, 8);
  const ratios = recent.map(r => (r.total > 0 ? r.score / r.total : 0));
  const avg = ratios.reduce((s, v) => s + v, 0) / ratios.length;
  return Math.max(0, Math.min(1, avg));
}

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n));
}

function updateMastery(prev: number, latest: number) {
  // Exponential moving average: stable but reactive
  const next = prev * 0.7 + latest * 0.3;
  return clamp01(next);
}

function seedsFromRatio(ratio: number) {
  // 1..5 seeds
  return Math.max(1, Math.min(5, Math.round(5 * clamp01(ratio))));
}

// --- Context ---
interface AuthContextType {
  user: UserProfile | null;
  stats: UserStats | null;
  loading: boolean;
  loginGoogle: () => Promise<void>;
  loginStudent: () => Promise<void>;
  loginAdmin: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

// --- Components ---

const Button = ({ 
  children, 
  className, 
  variant = 'primary', 
  ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }) => {
  const variants = {
    primary: 'bg-pink-500 text-white hover:bg-pink-600 shadow-sm',
    secondary: 'bg-white text-pink-600 border border-pink-200 hover:bg-pink-50',
    ghost: 'bg-transparent text-gray-600 hover:bg-gray-100',
    danger: 'bg-red-500 text-white hover:bg-red-600'
  };
  
  return (
    <button 
      className={cn(
        'px-4 py-2 rounded-xl font-medium transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2',
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
};

const Card = ({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) => (
  <div 
    onClick={onClick}
    className={cn('bg-white border border-black/5 rounded-2xl shadow-sm p-6', className)}
  >
    {children}
  </div>
);

// --- Modules ---

const VocabularyModule = () => {
  const { user } = useAuth();
  const [words, setWords] = useState<VocabularyWord[]>([]);
  const [filter, setFilter] = useState<VocabCategory | 'All'>('All');
  const [search, setSearch] = useState('');
  const [selectedWord, setSelectedWord] = useState<VocabularyWord | null>(null);

  useEffect(() => {
    const q = filter === 'All' 
      ? collection(db, 'vocabulary')
      : query(collection(db, 'vocabulary'), where('category', '==', filter));
      
    return onSnapshot(q, (snapshot) => {
      setWords(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as VocabularyWord)));
    });
  }, [filter]);

  const filteredWords = words.filter(w => 
    w.word.toLowerCase().includes(search.toLowerCase()) || 
    w.translation.toLowerCase().includes(search.toLowerCase())
  );

  const categories: { name: VocabCategory | 'All'; icon: any; label: string }[] = [
    { name: 'All', icon: BookOpen, label: 'Vše' },
    { name: 'Family', icon: Users, label: 'Rodina' },
    { name: 'Food', icon: Utensils, label: 'Jídlo' },
    { name: 'House', icon: Home, label: 'Dům' },
    { name: 'Work', icon: Briefcase, label: 'Práce' },
    { name: 'Nature', icon: Leaf, label: 'Příroda' },
    { name: 'Other', icon: Flower, label: 'Ostatní' },
  ];

  const categoryMap: Record<string, string> = {
    'All': 'Vše',
    'Family': 'Rodina',
    'Food': 'Jídlo',
    'House': 'Dům',
    'Work': 'Práce',
    'Nature': 'Příroda',
    'Other': 'Ostatní'
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-gray-900">Slovíčka A2</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input 
            type="text" 
            placeholder="Hledej slovíčka..." 
            className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none w-full md:w-64"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {categories.map(cat => (
          <button
            key={cat.name}
            onClick={() => setFilter(cat.name)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all",
              filter === cat.name 
                ? "bg-pink-500 text-white shadow-md" 
                : "bg-white text-gray-600 border border-gray-200 hover:border-pink-300"
            )}
          >
            <cat.icon className="w-4 h-4" />
            {cat.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredWords.map(word => (
          <Card 
            key={word.id} 
            className="hover:shadow-md transition-shadow group cursor-pointer border-pink-50 hover:border-pink-200 relative"
            onClick={() => setSelectedWord(word)}
          >
            {user?.role === 'admin' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm(`Opravdu smazat slovíčko "${word.word}"?`)) {
                    deleteDoc(doc(db, 'vocabulary', word.id!));
                  }
                }}
                className="absolute top-4 right-4 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <XCircle className="w-5 h-5" />
              </button>
            )}
            <div className="flex justify-between items-start mb-2 mr-6">
              <span className="text-xs font-bold text-pink-600 uppercase tracking-wider bg-pink-50 px-2 py-1 rounded">
                {categoryMap[word.category] || word.category}
              </span>
              <span className="text-xs text-gray-400">{word.level}</span>
            </div>
            <h3 className="text-xl font-bold text-gray-900 group-hover:text-pink-600 transition-colors">{word.word}</h3>
            <p className="text-gray-600 mb-4">{word.translation}</p>
            {word.example && (
              <div className="text-sm italic text-gray-500 border-l-2 border-pink-200 pl-3 py-1">
                "{word.example}"
              </div>
            )}
          </Card>
        ))}
        {filteredWords.length === 0 && (
          <div className="col-span-full py-12 text-center text-gray-500">
            V této kategorii nebyla nalezena žádná slovíčka, Viktorko.
          </div>
        )}
      </div>

      {selectedWord && (
        <WordDetailsModal word={selectedWord} onClose={() => setSelectedWord(null)} />
      )}
    </div>

  );
};

const GrammarModule = () => {
  const [view, setView] = useState<'practice' | 'ai-tests'>('practice');
  const [activeTab, setActiveTab] = useState<'a1-be' | 'be-have' | 'do-does' | 'modals' | 'state-dynamic'>('a1-be');
  const { stats, user } = useAuth();

  const exercises = {
    'a1-be': [
      { q: "___ you a student?", a: "Are", options: ["Am", "Is", "Are"] },
      { q: "She ___ from Prague.", a: "is", options: ["am", "is", "are"] },
      { q: "I ___ happy today.", a: "am", options: ["am", "is", "are"] },
      { q: "They ___ my friends.", a: "are", options: ["am", "is", "are"] },
      { q: "He ___ not tired.", a: "is", options: ["am", "is", "are"] },
    ],
    'be-have': [
      { q: "I ___ a big family.", a: "have", options: ["am", "have", "has"] },
      { q: "She ___ very happy today.", a: "is", options: ["is", "has", "am"] },
      { q: "They ___ a new car.", a: "have", options: ["are", "have", "has"] },
      { q: "It ___ a beautiful day.", a: "is", options: ["is", "has", "are"] },
    ],
    'do-does': [
      { q: "___ you like pizza?", a: "Do", options: ["Do", "Does", "Are"] },
      { q: "She ___ not work on Sundays.", a: "does", options: ["do", "does", "is"] },
      { q: "___ he live in London?", a: "Does", options: ["Do", "Does", "Is"] },
      { q: "We ___ not have any milk.", a: "do", options: ["do", "does", "are"] },
    ],
    'modals': [
      { q: "I ___ swim very well.", a: "can", options: ["can", "must", "should"] },
      { q: "You ___ study for the test.", a: "should", options: ["can", "must", "should"] },
      { q: "We ___ stop at the red light.", a: "must", options: ["can", "must", "should"] },
    ],
    'state-dynamic': [
      { q: "I ___ (know) the answer.", a: "know", options: ["know", "am knowing"] },
      { q: "She ___ (run) in the park right now.", a: "is running", options: ["runs", "is running"] },
      { q: "They ___ (love) Italian food.", a: "love", options: ["love", "are loving"] },
    ]
  };

  const [currentIdx, setCurrentIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const currentExercises = exercises[activeTab];

  const handleAnswer = (option: string) => {
    setSelected(option);
    if (option === currentExercises[currentIdx].a) {
      setScore(s => s + 1);
    }
    
    setTimeout(() => {
      if (currentIdx + 1 < currentExercises.length) {
        setCurrentIdx(i => i + 1);
        setSelected(null);
      } else {
        setShowResult(true);
      }
    }, 600);
  };

  const reset = () => {
    setCurrentIdx(0);
    setScore(0);
    setShowResult(false);
    setSelected(null);
  };

  return (
    <div className="space-y-6">
      {user && <Cockpit user={user} stats={stats} />}
      <div className="flex gap-6 border-b border-black/5">
        <button 
          onClick={() => setView('practice')}
          className={cn(
            "pb-4 text-sm font-bold transition-all relative",
            view === 'practice' ? "text-pink-600" : "text-gray-400 hover:text-gray-600"
          )}
        >
          Procvičování
          {view === 'practice' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-pink-500" />}
        </button>
        <button 
          onClick={() => setView('ai-tests')}
          className={cn(
            "pb-4 text-sm font-bold transition-all relative",
            view === 'ai-tests' ? "text-indigo-600" : "text-gray-400 hover:text-gray-600"
          )}
        >
          AI Gramatické testy
          {view === 'ai-tests' && <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500" />}
        </button>
      </div>

      {view === 'practice' ? (
        <div className="space-y-6">
          <div className="flex overflow-x-auto pb-2 gap-2">
            {[
              { id: 'a1-be', label: '🌱 A1: Být (am/is/are)' },
              { id: 'be-have', label: 'Být & Mít' },
              { id: 'do-does', label: 'Do & Does' },
              { id: 'modals', label: 'Modální slovesa' },
              { id: 'state-dynamic', label: 'Stavová vs Dynamická' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id as any); reset(); }}
                className={cn(
                  "whitespace-nowrap px-4 py-2 rounded-xl text-sm font-medium transition-all",
                  activeTab === tab.id ? "bg-pink-500 text-white" : "bg-white text-gray-600 border border-gray-200 hover:border-pink-200"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <Card className="max-w-2xl mx-auto min-h-[300px] flex flex-col justify-center overflow-hidden">
            <AnimatePresence mode="wait">
              {!showResult ? (
                <motion.div 
                  key={currentIdx}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-8"
                >
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-400">Otázka {currentIdx + 1} z {currentExercises.length}</span>
                    <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-pink-500 transition-all duration-300" 
                        style={{ width: `${((currentIdx + 1) / currentExercises.length) * 100}%` }}
                      />
                    </div>
                  </div>
                  
                  <h3 className="text-2xl font-medium text-center text-gray-800 py-4">
                    {currentExercises[currentIdx].q}
                  </h3>

                  <div className="grid grid-cols-1 gap-3">
                    {currentExercises[currentIdx].options.map(opt => (
                      <motion.button
                        key={opt}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        animate={selected === opt 
                          ? (opt === currentExercises[currentIdx].a ? { scale: [1, 1.03, 1] } : { x: [-4, 4, -4, 4, 0] }) 
                          : {}
                        }
                        transition={{ duration: 0.4 }}
                        onClick={() => !selected && handleAnswer(opt)}
                        className={cn(
                          "p-4 rounded-xl border-2 transition-all text-left font-medium relative overflow-hidden",
                          selected === opt 
                            ? (opt === currentExercises[currentIdx].a ? "border-green-500 bg-green-50 text-green-700" : "border-red-500 bg-red-50 text-red-700")
                            : (selected && opt === currentExercises[currentIdx].a ? "border-green-500 bg-green-50 text-green-700" : "border-gray-200 hover:border-pink-300")
                        )}
                      >
                        <span className="relative z-10">{opt}</span>
                        {selected === opt && (
                          <motion.div 
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className={cn(
                              "absolute inset-0 opacity-10",
                              opt === currentExercises[currentIdx].a ? "bg-green-500" : "bg-red-500"
                            )}
                          />
                        )}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="result"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center space-y-6"
                >
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', damping: 12 }}
                    className="inline-flex p-4 bg-pink-50 rounded-full text-pink-600 mb-4"
                  >
                    <CheckCircle2 className="w-12 h-12" />
                  </motion.div>
                  <h3 className="text-3xl font-bold text-gray-900">Procvičování hotovo, lásko!</h3>
                  <p className="text-xl text-gray-600">Získala jsi <span className="font-bold text-pink-600">{score}</span> bodů z {currentExercises.length}</p>
                  <Button onClick={reset} className="mx-auto">Zkusit znovu</Button>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </div>
      ) : (
        <GrammarTestList />
      )}
    </div>
  );
};

const LessonGenerator = () => {
  const [topic, setTopic] = useState('');
  const [lesson, setLesson] = useState('');
  const [loading, setLoading] = useState(false);

  const generateLesson = async () => {
    if (!topic) return;
    setLoading(true);
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Generate a short English lesson for A2 level students about "${topic}". 
        The student is a girl named Viktorka, address her affectionately in Czech in the introduction and conclusion.
        Include: 
        1. A short text (5-7 sentences).
        2. 5 key vocabulary words with translations to Czech.
        3. 3 comprehension questions.
        Format as Markdown.`,
      });
      setLesson(response.text || 'Nepodařilo se vygenerovat lekci.');
    } catch (e) {
      console.error(e);
      setLesson('Chyba při generování lekce.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="space-y-4 border-pink-100">
      <div className="flex items-center gap-2 text-pink-600 font-bold">
        <Flower className="w-5 h-5" />
        <h3>AI Generátor lekcí</h3>
      </div>
      <div className="flex gap-2">
        <input 
          type="text" 
          placeholder="Téma (např. Cestování vlakem)" 
          className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-pink-500 outline-none"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        />
        <Button onClick={generateLesson} disabled={loading}>
          {loading ? 'Generuji...' : 'Generovat'}
        </Button>
      </div>
      {lesson && (
        <div className="mt-6 p-6 bg-gray-50 rounded-2xl border border-gray-100 space-y-4">
          <div className="markdown-body">
            <Markdown>{lesson}</Markdown>
          </div>
          <div className="flex justify-end pt-4 border-t border-gray-200">
            <Button
              onClick={async () => {
                setLoading(true);
                try {
                  await addDoc(collection(db, 'lessons'), {
                    topic,
                    content: lesson,
                    createdAt: new Date().toISOString()
                  });
                  alert('Lekce byla uložena do databáze!');
                  setLesson('');
                  setTopic('');
                } catch (e) {
                  alert('Chyba při ukládání lekce.');
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
              className="bg-pink-600 hover:bg-pink-700 text-white"
            >
              Uložit lekci do databáze
            </Button>
          </div>
        </div>
      )}

    </Card>
  );
};

const GrammarTestGenerator = () => {
  const [topic, setTopic] = useState('');
  const [level, setLevel] = useState('A1');
  const [unitId, setUnitId] = useState<RoadmapUnitId>('a3-past-simple-vs-continuous');
  const [loading, setLoading] = useState(false);
  const [generatedTest, setGeneratedTest] = useState<GrammarTest | null>(null);

  const generateTest = async () => {
    if (!topic) return;
    setLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Generate a grammar test for level ${level} on topic: ${topic}. 
        Return 5 multiple choice questions. 
        Each question must have 4 options and one correct answer.
        Provide a short explanation for each correct answer.
        Explanations MUST be in Czech and friendly (for a girl named Viktorka).`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              questions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    question: { type: Type.STRING },
                    options: { type: Type.ARRAY, items: { type: Type.STRING } },
                    correctAnswer: { type: Type.STRING },
                    explanation: { type: Type.STRING }
                  },
                  required: ["question", "options", "correctAnswer"]
                }
              }
            },
            required: ["title", "questions"]
          }
        }
      });

      const parsed = safeJsonParse(response.text || '{}');
      if (!parsed.ok || !isValidGeneratedGrammarTest(parsed.data)) {
        console.error('Invalid AI JSON:', parsed.ok ? parsed.data : 'parse_error');
        alert('AI vrátila neplatný JSON. Zkus to prosím znovu (nebo změň téma).');
        return;
      }
      const data = parsed.data;
      const newTest: GrammarTest = {
        roadmapUnitId: unitId,
        title: data.title || `Grammar: ${topic}`,
        description: data.description || `Test na téma ${topic}`,
        level: level,
        questions: data.questions.map((q: any, i: number) => ({
          ...q,
          id: `q-${Date.now()}-${i}`
        })),
        createdAt: new Date().toISOString()
      };
      setGeneratedTest(newTest);
    } catch (e) {
      console.error(e);
      alert('Chyba při generování testu.');
    } finally {
      setLoading(false);
    }
  };

  const saveTest = async () => {
    if (!generatedTest) return;
    setLoading(true);
    try {
      await addDoc(collection(db, 'grammarTests'), generatedTest);
      alert('Test byl úspěšně uložen pro studenta!');
      setGeneratedTest(null);
      setTopic('');
    } catch (e) {
      console.error(e);
      alert('Chyba při ukládání testu.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="space-y-4 border-indigo-100">
      <div className="flex items-center gap-2 text-indigo-600 font-bold">
        <BrainCircuit className="w-5 h-5" />
        <h3>AI Generátor gramatických testů</h3>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Téma (např. Present Simple, Prepositions...)</label>
          <input 
            type="text"
            className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Např. Past Continuous"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Úroveň</label>
          <select 
            className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
            value={level}
            onChange={(e) => setLevel(e.target.value)}
          >
            <option value="A1">A1 - Beginner</option>
            <option value="A2">A2 - Elementary</option>
            <option value="B1">B1 - Intermediate</option>
            <option value="B2">B2 - Upper Intermediate</option>
          </select>
        </div>
        <div className="space-y-2 md:col-span-2">
          <label className="text-sm font-medium text-gray-700">Roadmap jednotka (kvůli zamykání)</label>
          <select
            className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
            value={unitId}
            onChange={(e) => setUnitId(e.target.value as RoadmapUnitId)}
          >
            {ROADMAP.map(u => (
              <option key={u.id} value={u.id}>{u.title} ({u.level})</option>
            ))}
          </select>
        </div>
      </div>

      <Button 
        onClick={generateTest} 
        disabled={loading || !topic} 
        className="w-full bg-indigo-600 hover:bg-indigo-700"
      >
        {loading ? <Sparkles className="animate-spin mr-2" /> : <Sparkles className="mr-2" />}
        {loading ? 'Generuji...' : 'Vygenerovat test pomocí AI'}
      </Button>

      {generatedTest && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 p-4 bg-indigo-50 rounded-xl border border-indigo-100 space-y-4"
        >
          <h4 className="font-bold text-indigo-900">{generatedTest.title}</h4>
          <div className="space-y-4">
            {generatedTest.questions.map((q, i) => (
              <div key={i} className="text-sm">
                <p className="font-medium">{i + 1}. {q.question}</p>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {q.options.map((opt, oi) => (
                    <div key={oi} className={clsx(
                      "p-1 px-2 rounded border",
                      opt === q.correctAnswer ? "bg-green-100 border-green-200 text-green-800" : "bg-white border-gray-200"
                    )}>
                      {opt}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button onClick={saveTest} className="flex-1">Uložit a publikovat</Button>
            <Button variant="secondary" onClick={() => setGeneratedTest(null)}>Zrušit</Button>
          </div>
        </motion.div>
      )}
    </Card>
  );
};

const GrammarTestPlayer = ({ test, onComplete }: { test: GrammarTest; onComplete: () => void }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const { user, stats } = useAuth();

  const handleAnswer = async (option: string) => {
    setSelected(option);
    const isCorrect = option === test.questions[currentIdx].correctAnswer;
    if (isCorrect) setScore(s => s + 1);

    setTimeout(async () => {
      if (currentIdx + 1 < test.questions.length) {
        setCurrentIdx(i => i + 1);
        setSelected(null);
      } else {
        setShowResult(true);
        if (user) {
          const finalScore = score + (isCorrect ? 1 : 0);
          await addDoc(collection(db, 'testResults'), {
            studentUid: user.uid,
            testType: `Grammar: ${test.title}`,
            score: finalScore,
            total: test.questions.length,
            timestamp: new Date().toISOString()
          });

          // Update mastery + garden rewards
          const ratio = test.questions.length > 0 ? finalScore / test.questions.length : 0;
          const earnedSeeds = seedsFromRatio(ratio);
          const statsRef = doc(db, 'stats', user.uid);

          const unit = (test.roadmapUnitId && typeof test.roadmapUnitId === 'string')
            ? (test.roadmapUnitId as RoadmapUnitId)
            : ('a3-past-simple-vs-continuous' as RoadmapUnitId);

          const prevM = getUnitMastery(stats, unit);
          const nextMasteryMap = { ...(stats?.mastery ?? {}), [unit]: updateMastery(prevM, ratio) };

          const nextSeeds = (stats?.seeds ?? 0) + earnedSeeds;
          const flowerGain = Math.floor(nextSeeds / 5) - Math.floor((stats?.seeds ?? 0) / 5);
          const nextFlowers = (stats?.flowers ?? 0) + Math.max(0, flowerGain);
          const nextLevel = computeLevelFromMastery({ ...(stats ?? { uid: user.uid, seeds: 0, flowers: 0, level: 'A1', updatedAt: '' }), mastery: nextMasteryMap } as any);

          await setDoc(statsRef, {
            uid: user.uid,
            seeds: nextSeeds,
            flowers: nextFlowers,
            level: nextLevel,
            mastery: nextMasteryMap,
            updatedAt: new Date().toISOString()
          } satisfies UserStats, { merge: true });
        }
      }
    }, 1500); // Longer delay to read explanation if needed
  };

  if (showResult) {
    return (
      <Card className="text-center space-y-6 py-12">
        <div className="inline-flex p-4 bg-green-50 rounded-full text-green-600">
          <CheckCircle2 className="w-12 h-12" />
        </div>
        <h3 className="text-3xl font-bold text-gray-900">Gramatika hotova!</h3>
        <p className="text-xl text-gray-600">Skóre: <span className="font-bold text-indigo-600">{score}</span> / {test.questions.length}</p>
        <Button onClick={onComplete} className="mx-auto">Zpět na seznam</Button>
      </Card>
    );
  }

  const q = test.questions[currentIdx];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-bold text-gray-900">{test.title}</h3>
        <span className="text-sm font-medium text-gray-400">Otázka {currentIdx + 1} z {test.questions.length}</span>
      </div>
      
      <Card className="space-y-8 min-h-[400px] flex flex-col justify-center overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div 
            key={currentIdx}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            <h4 className="text-2xl font-medium text-center text-gray-800">{q.question}</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {q.options.map(opt => (
                <motion.button
                  key={opt}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  animate={selected === opt 
                    ? (opt === q.correctAnswer ? { scale: [1, 1.03, 1] } : { x: [-4, 4, -4, 4, 0] }) 
                    : {}
                  }
                  transition={{ duration: 0.4 }}
                  disabled={!!selected}
                  onClick={() => handleAnswer(opt)}
                  className={cn(
                    "p-4 rounded-xl border-2 transition-all text-left font-medium relative overflow-hidden",
                    selected === opt 
                      ? (opt === q.correctAnswer ? "border-green-500 bg-green-50 text-green-700" : "border-red-500 bg-red-50 text-red-700")
                      : (selected && opt === q.correctAnswer ? "border-green-500 bg-green-50 text-green-700" : "border-gray-200 hover:border-indigo-300")
                  )}
                >
                  <span className="relative z-10">{opt}</span>
                  {selected === opt && (
                    <motion.div 
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className={cn(
                        "absolute inset-0 opacity-10",
                        opt === q.correctAnswer ? "bg-green-500" : "bg-red-500"
                      )}
                    />
                  )}
                </motion.button>
              ))}
            </div>

            {selected && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "p-4 rounded-xl text-sm",
                  selected === q.correctAnswer ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  {selected === q.correctAnswer ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                  <p className="font-bold">{selected === q.correctAnswer ? 'Správně!' : 'Chyba!'}</p>
                </div>
                {q.explanation && <p className="mt-1">{q.explanation}</p>}
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      </Card>
    </div>
  );
};

const GrammarTestList = () => {
  const [tests, setTests] = useState<GrammarTest[]>([]);
  const [selectedTest, setSelectedTest] = useState<GrammarTest | null>(null);
  const [loading, setLoading] = useState(true);
  const { user, stats } = useAuth();

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'grammarTests'), (s) => {
      setTests(s.docs.map(d => ({ id: d.id, ...d.data() } as GrammarTest)));
      setLoading(false);
    });
    return unsub;
  }, []);

  if (selectedTest) {
    return <GrammarTestPlayer test={selectedTest} onComplete={() => setSelectedTest(null)} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold text-gray-900">Gramatické testy</h2>
        <p className="text-gray-500 text-sm">Testy připravené speciálně pro tebe pomocí AI.</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Načítám testy...</div>
      ) : tests.length === 0 ? (
        <Card className="text-center py-12 space-y-4">
          <BrainCircuit className="w-12 h-12 text-gray-300 mx-auto" />
          <p className="text-gray-500">Zatím tu nejsou žádné testy. Počkej, až ti nějaký připravím!</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tests.map(test => (
            (() => {
              const unit = (test.roadmapUnitId && typeof test.roadmapUnitId === 'string')
                ? (test.roadmapUnitId as RoadmapUnitId)
                : null;
              const unitDef = unit ? ROADMAP.find(u => u.id === unit) : null;
              const levelOrder = ['A1', 'A2', 'A3', 'B1', 'B2', 'C1'];
              const studentLevelIdx = levelOrder.indexOf(stats?.level || 'A1');
              const testLevelIdx = levelOrder.indexOf(test.level || 'A1');
              const unlocked = user?.role === 'admin' || testLevelIdx <= studentLevelIdx || !unitDef;
              return (
                <Card
                  key={test.id}
                  className={cn(
                    "transition-all group",
                    unlocked ? "hover:border-indigo-300 cursor-pointer" : "opacity-70 bg-gray-50 border-gray-200"
                  )}
                  onClick={() => unlocked && setSelectedTest(test)}
                >
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded uppercase tracking-wider">
                      {test.level}
                    </span>
                    {unitDef && (
                      <span className="px-2 py-0.5 bg-gray-50 text-gray-600 text-[10px] font-bold rounded uppercase tracking-wider">
                        {unitDef.title}
                      </span>
                    )}
                    <span className="text-[10px] text-gray-400">
                      {new Date(test.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <h4 className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">{test.title}</h4>
                  <p className="text-xs text-gray-500">{test.questions.length} otázek</p>
                </div>
                <div className="p-2 bg-gray-50 rounded-lg text-gray-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all">
                  {unlocked ? <ChevronRight className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                </div>
              </div>
              {!unlocked && (
                <p className="mt-3 text-xs text-gray-500">
                  Nejdřív zvládni prerequisite jednotky na 85 % a test se odemkne.
                </p>
              )}
                </Card>
              );
            })()
          ))}
        </div>
      )}
    </div>
  );
};

const AdminDashboard = () => {

  const [importText, setImportText] = useState('');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ words: 0, tests: 0, successfulTests: 0, students: 0 });
  const [fillBusy, setFillBusy] = useState(false);
  const [fillLog, setFillLog] = useState<string[]>([]);

  useEffect(() => {
    const unsubWords = onSnapshot(collection(db, 'vocabulary'), s => setStats(prev => ({ ...prev, words: s.size })));
    const unsubTests = onSnapshot(collection(db, 'testResults'), s => {
      const allTests = s.docs.map(d => d.data());
      const successful = allTests.filter(t => (t.score / t.total) >= 0.7).length;
      setStats(prev => ({ ...prev, tests: s.size, successfulTests: successful }));
    });
    const unsubUsers = onSnapshot(query(collection(db, 'users'), where('role', '==', 'student')), s => setStats(prev => ({ ...prev, students: s.size })));
    return () => { unsubWords(); unsubTests(); unsubUsers(); };
  }, []);

  const handleImport = async () => {
    if (!importText.trim()) return;
    setLoading(true);
    try {
      const data = JSON.parse(importText);
      const words = Array.isArray(data) ? data : [data];
      
      // Use batches for efficiency (max 500 per batch)
      const batchSize = 400; // Safe limit
      let addedCount = 0;

      for (let i = 0; i < words.length; i += batchSize) {
        const batch = writeBatch(db);
        const chunk = words.slice(i, i + batchSize);
        
        chunk.forEach((word) => {
          if (!word.word || !word.translation) return; // Skip invalid entries

          const docRef = doc(collection(db, 'vocabulary'));
          // Clean data to match rules and ensure consistency
          const cleanWord = {
            word: String(word.word).trim(),
            translation: String(word.translation).trim(),
            category: word.category ? String(word.category).trim() : 'Other',
            example: word.example ? String(word.example).trim() : '',
            level: word.level ? String(word.level).trim() : 'A1'
          };
          
          batch.set(docRef, cleanWord);
          addedCount++;
        });
        
        await batch.commit();
      }
      
      alert(`Import úspěšný! Přidáno ${addedCount} slov.`);
      setImportText('');
    } catch (e) {
      console.error(e);
      alert('Neplatný formát JSON nebo chyba databáze.');
    } finally {
      setLoading(false);
    }
  };

  const handleResetProgress = async () => {
    if (!window.confirm('Opravdu chceš resetovat veškerý pokrok studentů? Tato akce je nevratná.')) return;
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, 'testResults'));
      const batch = writeBatch(db);
      snapshot.docs.forEach((d) => {
        batch.delete(d.ref);
      });
      await batch.commit();
      alert('Pokrok byl úspěšně resetován!');
    } catch (e) {
      console.error(e);
      alert('Chyba při resetování pokroku.');
    } finally {
      setLoading(false);
    }
  };

  const generateUnitPack = async (unit: { id: RoadmapUnitId; title: string; level: any; topics: string[]; prerequisites: RoadmapUnitId[]; masteryThreshold: number; }) => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are a senior English teacher and content creator.
Create a complete JSON content pack for ONE LMS unit.

UnitId: ${unit.id}
Level: ${unit.level}
Title: ${unit.title}
Topics: ${unit.topics.join(', ')}

Rules:
- contextText: an English article suitable for the level (approx 180-260 words), include the target grammar naturally.
- grammarExplanation: detailed explanation in CZECH, friendly tone for a girl named Viktorka.
- testSuite: 10 multiple-choice questions, each with 4 options, correctAnswer, and Czech explanation "proč".
- Return ONLY valid JSON and match the requested schema.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            unitId: { type: Type.STRING },
            level: { type: Type.STRING },
            title: { type: Type.STRING },
            topics: { type: Type.ARRAY, items: { type: Type.STRING } },
            contextText: { type: Type.STRING },
            grammarExplanation: { type: Type.STRING },
            testSuite: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  options: { type: Type.ARRAY, items: { type: Type.STRING } },
                  correctAnswer: { type: Type.STRING },
                  explanation: { type: Type.STRING },
                },
                required: ['question', 'options', 'correctAnswer', 'explanation'],
              },
            },
            createdAt: { type: Type.STRING },
            model: { type: Type.STRING },
          },
          required: ['unitId', 'level', 'title', 'topics', 'contextText', 'grammarExplanation', 'testSuite', 'createdAt'],
        },
      },
    });

    const parsed = safeJsonParse(response.text || '{}');
    if (!parsed.ok || !isValidUnitContentPack(parsed.data)) {
      throw new Error('Invalid unit content pack JSON');
    }
    const pack = parsed.data as UnitContentPack;
    // normalize
    pack.unitId = unit.id;
    pack.level = unit.level;
    pack.title = unit.title;
    pack.topics = unit.topics;
    pack.model = pack.model || 'gemini-3-flash-preview';
    return pack;
  };

  const fillMissingContent = async (mode: 'a3-first-3' | 'all') => {
    setFillBusy(true);
    setFillLog([]);
    try {
      const units = mode === 'a3-first-3'
        ? ROADMAP.filter(u => u.level === 'A3').slice(0, 3)
        : ROADMAP;

      for (const unit of units) {
        const unitRef = doc(db, 'units', unit.id);
        const snap = await getDoc(unitRef);
        if (snap.exists()) {
          setFillLog(prev => [...prev, `SKIP ${unit.id} (exists)`]);
          continue;
        }
        setFillLog(prev => [...prev, `GEN  ${unit.id}…`]);
        const pack = await generateUnitPack(unit as any);
        await setDoc(unitRef, pack);
        setFillLog(prev => [...prev, `OK   ${unit.id}`]);
      }

      alert('Doplnění obsahu dokončeno.');
    } catch (e) {
      console.error(e);
      alert('Chyba při doplňování obsahu (viz konzole).');
    } finally {
      setFillBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Admin Panel</h2>
        <Button variant="danger" onClick={handleResetProgress} disabled={loading}>
          Resetovat veškerý pokrok
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="flex items-center gap-4 border-blue-100">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><BookOpen /></div>
          <div>
            <p className="text-sm text-gray-500">Celkem slov</p>
            <p className="text-2xl font-bold">{stats.words}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4 border-green-100">
          <div className="p-3 bg-green-50 text-green-600 rounded-xl"><BarChart3 /></div>
          <div>
            <p className="text-sm text-gray-500">Hotové testy</p>
            <p className="text-2xl font-bold">{stats.tests}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4 border-pink-100">
          <div className="p-3 bg-pink-50 text-pink-600 rounded-xl"><CheckCircle2 /></div>
          <div>
            <p className="text-sm text-gray-500">Úspěšné testy</p>
            <p className="text-2xl font-bold">{stats.successfulTests}</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4 border-purple-100">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl"><Users /></div>
          <div>
            <p className="text-sm text-gray-500">Aktivní studenti</p>
            <p className="text-2xl font-bold">{stats.students}</p>
          </div>
        </Card>
      </div>

      <GrammarTestGenerator />
      <LessonGenerator />

      <Card className="space-y-4 border-amber-100">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-bold text-amber-900">AI Content Factory</h3>
            <p className="text-sm text-gray-600">Doplní chybějící obsah do `units/{'{unitId}'}'` podle `src/roadmap.ts`.</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => fillMissingContent('a3-first-3')}
              disabled={fillBusy || loading}
            >
              {fillBusy ? 'Pracuji…' : 'Vygenerovat 1. 3 jednotky A3'}
            </Button>
            <Button
              onClick={() => fillMissingContent('all')}
              disabled={fillBusy || loading}
              className="bg-amber-600 hover:bg-amber-700"
            >
              {fillBusy ? 'Pracuji…' : 'Doplnit chybějící obsah (vše)'}
            </Button>
          </div>
        </div>
        {fillLog.length > 0 && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-100 font-mono text-xs text-amber-900 whitespace-pre-wrap">
            {fillLog.join('\n')}
          </div>
        )}
      </Card>

      <AIVocabularyGenerator />

      <Card className="space-y-4 border-pink-100">
        <div className="flex items-center gap-2 text-pink-600 font-bold">
          <FileJson className="w-5 h-5" />
          <h3>Hromadný import slovíček (JSON)</h3>
        </div>
        <p className="text-sm text-gray-500">Formát: {"[{\"word\": \"Apple\", \"translation\": \"Jablko\", \"category\": \"Food\"}]"}</p>
        <textarea 
          className="w-full h-48 p-4 border border-gray-200 rounded-xl font-mono text-sm focus:ring-2 focus:ring-pink-500 outline-none"
          placeholder='[{"word": "Family", "translation": "Rodina", "category": "Family"}]'
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
        />
        <Button onClick={handleImport} disabled={loading} className="w-full">
          {loading ? 'Importuji...' : 'Importovat slova'}
        </Button>
      </Card>
    </div>
  );
};

const AIVocabularyGenerator = () => {
  const [word, setWord] = useState('');
  const [loading, setLoading] = useState(false);

  const generateAndSave = async () => {
    const w = word.trim();
    if (!w) return;
    setLoading(true);
    try {
      const resp = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Return JSON for a single English vocabulary entry for A2 learner.
Word: "${w}"
Return fields: word, translation (Czech), category (Family/Food/House/Work/Nature/Other), example (simple A2), level ("A2"), ipa (IPA), definition (simple English), synonyms (array of 3-6).
Return ONLY valid JSON.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              word: { type: Type.STRING },
              translation: { type: Type.STRING },
              category: { type: Type.STRING },
              example: { type: Type.STRING },
              level: { type: Type.STRING },
              ipa: { type: Type.STRING },
              definition: { type: Type.STRING },
              synonyms: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ["word", "translation", "category", "level"]
          }
        }
      });
      const parsed = safeJsonParse(resp.text || '{}');
      if (!parsed.ok) {
        alert('AI vrátila nečitelný JSON.');
        return;
      }
      const data = parsed.data as any;
      const clean: VocabularyWordEnriched = {
        word: String(data.word || w).trim(),
        translation: String(data.translation || '').trim(),
        category: (String(data.category || 'Other').trim() as any),
        example: data.example ? String(data.example).trim() : '',
        level: String(data.level || 'A1'),
        ipa: data.ipa ? String(data.ipa).trim() : '',
        definition: data.definition ? String(data.definition).trim() : '',
        synonyms: Array.isArray(data.synonyms) ? data.synonyms.filter((s: any) => typeof s === 'string').slice(0, 10) : [],
        wordLower: normalizeWord(String(data.word || w)),
      };

      if (!clean.translation) {
        alert('AI nevrátila překlad, zkus to prosím znovu.');
        return;
      }

      const existing = await getDocs(query(collection(db, 'vocabulary'), where('wordLower', '==', clean.wordLower)));
      if (!existing.empty) {
        alert('Tohle slovíčko už v databázi je (duplicitní).');
        return;
      }

      await addDoc(collection(db, 'vocabulary'), clean);
      alert('Slovíčko přidáno!');
      setWord('');
    } catch (e) {
      console.error(e);
      alert('Chyba při generování/ukládání slovíčka.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="space-y-4 border-emerald-100">
      <div className="flex items-center gap-2 text-emerald-700 font-bold">
        <Sparkles className="w-5 h-5" />
        <h3>AI Přidat slovíčko (enrichment)</h3>
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
          placeholder="Např. 'garden' nebo 'ticket'"
          value={word}
          onChange={(e) => setWord(e.target.value)}
        />
        <Button onClick={generateAndSave} disabled={loading || !word.trim()} className="bg-emerald-600 hover:bg-emerald-700">
          {loading ? 'Generuji...' : 'Přidat'}
        </Button>
      </div>
      <p className="text-xs text-gray-500">AI doplní překlad, IPA, definici, synonyma a příkladovou větu. Duplicity blokujeme přes `wordLower`.</p>
    </Card>
  );
};

// --- Main App ---

const WordDetailsModal = ({ word, onClose }: { word: VocabularyWord; onClose: () => void }) => {
  const [details, setDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word.word}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setDetails(data[0]);
        } else {
          setDetails(null);
        }
        setLoading(false);
      })
      .catch(() => {
        setDetails(null);
        setLoading(false);
      });
  }, [word.word]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-3xl max-w-lg w-full max-h-[80vh] overflow-y-auto p-8 relative"
      >
        <button onClick={onClose} className="absolute top-6 right-6 text-gray-400 hover:text-gray-600">
          <XCircle className="w-6 h-6" />
        </button>
        
        <div className="space-y-6">
          <div>
            <h2 className="text-4xl font-bold text-gray-900">{word.word}</h2>
            <p className="text-pink-600 font-medium">{word.translation}</p>
          </div>

          {loading ? (
            <div className="py-12 text-center text-gray-400">Načítám informace ze slovníku...</div>
          ) : details ? (
            <div className="space-y-4">
              {details.phonetic && <p className="text-gray-500 italic">{details.phonetic}</p>}
              {details.meanings?.map((m: any, i: number) => (
                <div key={i} className="space-y-2">
                  <p className="text-xs font-bold uppercase text-gray-400 tracking-widest">{m.partOfSpeech}</p>
                  <p className="text-gray-700">{m.definitions[0].definition}</p>
                  {m.definitions[0].example && (
                    <p className="text-sm text-gray-500 italic border-l-2 border-pink-100 pl-3">"{m.definitions[0].example}"</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 italic">Nebyly nalezeny žádné další informace.</p>
          )}
          
          <Button onClick={onClose} className="w-full">Zavřít</Button>
        </div>
      </motion.div>
    </div>
  );
};

const TestModule = () => {
  const { user, stats } = useAuth();
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch all vocabulary and pick a random subset for testing
    // To handle larger sets smoothly we just get everything once and pick. 
    // In production we would probably fetch a limited cursor or do random logic.
    getDocs(collection(db, 'vocabulary')).then(snapshot => {
      const words = snapshot.docs.map(d => d.data() as VocabularyWord);
      if (words.length < 4) {
        setQuestions([]);
        setLoading(false);
        return;
      }

      const testQuestions = words.sort(() => 0.5 - Math.random()).slice(0, 10).map(word => {
        const distractors = words
          .filter(w => w.translation !== word.translation)
          .sort(() => 0.5 - Math.random())
          .slice(0, 3)
          .map(w => w.translation);
        
        const options = [word.translation, ...distractors].sort(() => 0.5 - Math.random());
        
        return {
          q: `Jaký je překlad slova "${word.word}"?`,
          a: word.translation,
          options
        };
      });
      
      setQuestions(testQuestions);
      setLoading(false);
    });
  }, []);

  const handleAnswer = async (option: string) => {
    setSelected(option);
    if (option === questions[currentIdx].a) {
      setScore(s => s + 1);
    }
    
    setTimeout(async () => {
      if (currentIdx + 1 < questions.length) {
        setCurrentIdx(i => i + 1);
        setSelected(null);
      } else {
        setShowResult(true);
        // Save result to Firebase
        if (user) {
          const finalScore = score + (option === questions[currentIdx].a ? 1 : 0);
          await addDoc(collection(db, 'testResults'), {
            studentUid: user.uid,
            testType: 'Vocabulary Quiz',
            score: finalScore,
            total: questions.length,
            timestamp: new Date().toISOString()
          });

          // Gamification: seeds based on performance (min 1 if finished)
          const ratio = questions.length > 0 ? finalScore / questions.length : 0;
          const earnedSeeds = seedsFromRatio(ratio);
          const statsRef = doc(db, 'stats', user.uid);
          const nextSeeds = (stats?.seeds ?? 0) + earnedSeeds;
          const flowerGain = Math.floor(nextSeeds / 5) - Math.floor((stats?.seeds ?? 0) / 5);
          const nextFlowers = (stats?.flowers ?? 0) + Math.max(0, flowerGain);
          
          await setDoc(statsRef, {
            uid: user.uid,
            seeds: nextSeeds,
            flowers: nextFlowers,
            level: stats?.level ?? 'A1',
            mastery: stats?.mastery ?? {},
            updatedAt: new Date().toISOString()
          } satisfies UserStats, { merge: true });
        }
      }
    }, 600);
  };

  if (loading) return <div className="text-center py-20">Generuji test, Viktorko...</div>;
  if (questions.length === 0) return (
    <div className="text-center py-20 space-y-4">
      <div className="inline-flex p-6 bg-yellow-50 rounded-full text-yellow-600">
        <BrainCircuit className="w-12 h-12" />
      </div>
      <h2 className="text-2xl font-bold">Nedostatek slov</h2>
      <p className="text-gray-500">Přidej aspoň 4 slova, abych mohl vygenerovat test, lásko.</p>
    </div>
  );

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Test ze slovíček</h2>
      <Card className="max-w-2xl mx-auto min-h-[400px] flex flex-col justify-center">
        {!showResult ? (
          <div className="space-y-8">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-400">Otázka {currentIdx + 1} z {questions.length}</span>
              <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-pink-500 transition-all duration-300" 
                  style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
                />
              </div>
            </div>
            
            <h3 className="text-2xl font-medium text-center text-gray-800 py-4">
              {questions[currentIdx].q}
            </h3>

            <div className="grid grid-cols-1 gap-3">
              {questions[currentIdx].options.map(opt => (
                <button
                  key={opt}
                  onClick={() => !selected && handleAnswer(opt)}
                  className={cn(
                    "p-4 rounded-xl border-2 transition-all text-left font-medium",
                    selected === opt 
                      ? (opt === questions[currentIdx].a ? "border-green-500 bg-green-50 text-green-700" : "border-red-500 bg-red-50 text-red-700")
                      : (selected && opt === questions[currentIdx].a ? "border-green-500 bg-green-50 text-green-700" : "border-gray-200 hover:border-pink-300")
                  )}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center space-y-6">
            <div className="inline-flex p-4 bg-pink-50 rounded-full text-pink-600 mb-4">
              <CheckCircle2 className="w-12 h-12" />
            </div>
            <h3 className="text-3xl font-bold text-gray-900">Test dokončen, Viktorko!</h3>
            <p className="text-xl text-gray-600">Tvoje skóre: <span className="font-bold text-pink-600">{score}</span> / {questions.length}</p>
            <Button onClick={() => window.location.reload()} className="mx-auto">Nový test</Button>
          </div>
        )}
      </Card>
    </div>
  );
};

const LessonsModule = () => {
  const { user } = useAuth();
  const [lessons, setLessons] = useState<AILesson[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<AILesson | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'lessons'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (s) => {
      setLessons(s.docs.map(d => ({ id: d.id, ...d.data() } as AILesson)));
      setLoading(false);
    });
    return unsub;
  }, []);

  if (selectedLesson) {
    return (
      <div className="space-y-6">
        <button 
          onClick={() => setSelectedLesson(null)}
          className="flex items-center gap-2 text-pink-600 hover:text-pink-700 font-medium transition-colors"
        >
          <ChevronRight className="w-5 h-5 rotate-180" />
          Zpět na seznam příběhů
        </button>

        <Card className="max-w-4xl mx-auto p-8 lg:p-12">
          <div className="space-y-2 mb-8 pb-8 border-b border-gray-100 text-center">
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900">{selectedLesson.topic}</h2>
            <p className="text-gray-400">Příběh napsaný speciálně pro Viktorku</p>
          </div>
          <div className="markdown-body prose prose-pink max-w-none text-lg leading-relaxed text-gray-700">
            <Markdown>{selectedLesson.content}</Markdown>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-bold text-gray-900">Příběhy & Lekce</h2>
        <p className="text-gray-500 text-sm">Čti si vygenerované AI příběhy speciálně pro tebe.</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Načítám příběhy...</div>
      ) : lessons.length === 0 ? (
        <Card className="text-center py-12 space-y-4">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto" />
          <p className="text-gray-500">Zatím tu žádné příběhy nejsou. Ale určitě nějaké brzy přibudou!</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {lessons.map(lesson => (
            <Card 
              key={lesson.id}
              className="hover:border-pink-300 hover:shadow-md transition-all cursor-pointer group flex flex-col relative"
              onClick={() => setSelectedLesson(lesson)}
            >
              {user?.role === 'admin' && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Opravdu smazat příběh "${lesson.topic}"?`)) {
                      deleteDoc(doc(db, 'lessons', lesson.id!));
                    }
                  }}
                  className="absolute top-4 right-4 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity z-10 p-1"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              )}
              <div className="mb-4 text-pink-500 bg-pink-50 w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <MessageSquare className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-pink-600 transition-colors line-clamp-2">
                {lesson.topic}
              </h3>
              <p className="text-sm text-gray-500 mt-auto pt-4 border-t border-gray-50">
                Přidáno: {new Date(lesson.createdAt).toLocaleDateString()}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

const AppContent = () => {

  const { user, stats, loginGoogle, loginStudent, loginAdmin, logout, loading } = useAuth();
  const [activeView, setActiveView] = useState<'dashboard' | 'vocab' | 'grammar' | 'tests' | 'lessons' | 'admin'>('dashboard');

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
    </div>
  );

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center bg-floral-pink p-4">
      <Card className="max-w-md w-full text-center space-y-8 py-12 border-pink-200 relative overflow-hidden">
        <div className="absolute -top-10 -left-10 text-pink-100 opacity-50"><Flower className="w-32 h-32" /></div>
        <div className="absolute -bottom-10 -right-10 text-pink-100 opacity-50"><Flower className="w-32 h-32" /></div>
        <div className="space-y-4 relative z-10">
          <div className="inline-flex p-4 bg-pink-50 rounded-3xl text-pink-600 mb-2">
            <Heart className="w-12 h-12" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Květinová Angličtina</h1>
          <p className="text-gray-500">Vítej zpět, lásko! Přihlas se prosím.</p>
        </div>
        <div className="space-y-3 relative z-10">
          <Button onClick={loginGoogle} className="w-full py-3 text-lg bg-pink-500 hover:bg-pink-600 text-white font-bold">
            Přihlásit se přes Google
          </Button>
          <div className="pt-4 border-t border-pink-100 flex gap-2">
            <Button onClick={loginStudent} variant="secondary" className="flex-1 py-2 text-xs">
              Dev: Student
            </Button>
            <Button onClick={loginAdmin} variant="secondary" className="flex-1 py-2 text-xs">
              Dev: Admin
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );

  const menuItems = [
    { id: 'dashboard', label: 'Nástěnka', icon: LayoutDashboard, roles: ['admin', 'student'] },
    { id: 'vocab', label: 'Slovíčka', icon: BookOpen, roles: ['admin', 'student'] },
    { id: 'grammar', label: 'Gramatika', icon: BrainCircuit, roles: ['admin', 'student'] },
    { id: 'lessons', label: 'Příběhy', icon: MessageSquare, roles: ['admin', 'student'] },
    { id: 'tests', label: 'Testy', icon: CheckCircle2, roles: ['admin', 'student'] },
    { id: 'admin', label: 'Admin Panel', icon: Settings, roles: ['admin'] },
  ].filter(item => item.roles.includes(user.role));

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-black/5 relative overflow-hidden">
        <div className="absolute -bottom-10 -left-10 text-pink-50 opacity-20 pointer-events-none"><Flower className="w-40 h-40" /></div>
        <div className="p-6 flex items-center gap-3 border-b border-black/5 relative z-10">
          <div className="bg-pink-500 p-2 rounded-lg text-white">
            <Flower className="w-6 h-6" />
          </div>
          <span className="font-bold text-xl tracking-tight text-pink-600">Květinový Portál</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          {menuItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id as any)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all",
                activeView === item.id 
                  ? "bg-pink-50 text-pink-600 shadow-sm" 
                  : "text-gray-500 hover:bg-pink-50 hover:text-pink-600"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-black/5 space-y-4">
          <div className="flex items-center gap-3 px-4">
            <div className="w-8 h-8 rounded-full bg-pink-100 flex items-center justify-center text-pink-600">
              <User className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-gray-900 truncate">{user.displayName || 'Uživatel'}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest">{user.role}</p>
            </div>
          </div>
          <button 
            onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-500 hover:bg-red-50 rounded-xl transition-all"
          >
            <LogOut className="w-4 h-4" />
            Odhlásit se
          </button>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <header className="md:hidden bg-white border-b border-gray-200 p-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="bg-pink-500 p-1.5 rounded-lg text-white">
            <Flower className="w-5 h-5" />
          </div>
          <span className="font-bold text-lg tracking-tight text-pink-600">Květinový Portál</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right flex flex-col items-end">
            <span className="text-[10px] text-gray-400 uppercase tracking-widest leading-none mb-0.5">{user.role}</span>
            <span className="text-xs font-bold text-gray-900 leading-none">{user.displayName || 'Uživatel'}</span>
          </div>
          <button onClick={logout} className="text-gray-400 hover:text-red-500 transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8 overflow-y-auto">
        <div className="max-w-5xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeView === 'dashboard' && (
                <div className="space-y-8 relative">
                  <div className="absolute top-0 right-0 text-pink-100 opacity-40 pointer-events-none -z-10"><Flower className="w-64 h-64" /></div>
                  <div className="flex flex-col gap-2 relative">
                    <div className="absolute -top-6 -right-6 text-pink-200 animate-pulse"><Sparkles className="w-12 h-12" /></div>
                    <h1 className="text-3xl font-bold text-gray-900">Ahoj, Viktorko! 👋</h1>
                    <p className="text-gray-500">Jsi připravená si dnes zlepšit angličtinu, lásko?</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card className="bg-pink-500 text-white border-none relative overflow-hidden">
                      <div className="relative z-10 space-y-4">
                        <h3 className="text-xl font-bold">Čas na příběh</h3>
                        <p className="text-pink-100 text-sm">Přečti si příběhy a lekce, které pro tebe připravila umělá inteligence.</p>
                        <Button variant="secondary" onClick={() => setActiveView('lessons')}>Jít číst</Button>
                      </div>
                      <Flower className="absolute -right-4 -bottom-4 w-32 h-32 text-pink-400 opacity-30 rotate-12" />
                    </Card>
                    
                    <Card className="space-y-4 border-pink-100">
                      <h3 className="text-xl font-bold text-gray-900">Tvůj pokrok</h3>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="p-4 rounded-2xl bg-white border border-gray-100">
                            <p className="text-xs text-gray-500">Semínka</p>
                            <p className="text-2xl font-bold text-emerald-600">{stats?.seeds ?? 0}</p>
                            <p className="text-[11px] text-gray-400">Každých 5 = 1 květina</p>
                          </div>
                          <div className="p-4 rounded-2xl bg-white border border-gray-100">
                            <p className="text-xs text-gray-500">Květiny</p>
                            <p className="text-2xl font-bold text-pink-600">{stats?.flowers ?? 0}</p>
                            <p className="text-[11px] text-gray-400">Tvoje zahrada</p>
                          </div>
                        </div>
                        {stats && <GardenDisplay stats={stats} />}
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-500">Slovíčka</span>
                            <span className="font-bold">45%</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-pink-500 w-[45%]" />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-500">Gramatika</span>
                            <span className="font-bold">72%</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-400 w-[72%]" />
                          </div>
                        </div>
                      </div>
                    </Card>
                  </div>
                </div>
              )}
              {activeView === 'vocab' && <VocabularyModule />}
              {activeView === 'grammar' && <GrammarModule />}
              {activeView === 'lessons' && <LessonsModule />}
              {activeView === 'admin' && <AdminDashboard />}
              {activeView === 'tests' && <TestModule />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around p-2 z-50 pb-safe">
        {menuItems.map(item => (
          <button
            key={item.id}
            onClick={() => setActiveView(item.id as any)}
            className={cn(
              "flex flex-col items-center justify-center p-2 rounded-xl transition-all min-w-[64px]",
              activeView === item.id 
                ? "text-pink-600" 
                : "text-gray-400 hover:text-pink-500 hover:bg-pink-50"
            )}
          >
            <item.icon className="w-6 h-6 mb-1" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
};

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <Card className="max-w-md w-full text-center space-y-4">
            <XCircle className="w-12 h-12 text-red-500 mx-auto" />
            <h2 className="text-2xl font-bold">Něco se pokazilo, lásko.</h2>
            <p className="text-gray-600">Zkus prosím stránku obnovit.</p>
            <Button onClick={() => window.location.reload()} className="mx-auto">Obnovit</Button>
          </Card>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {

  const [user, setUser] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("Auth state changed:", firebaseUser?.email);
      if (!firebaseUser) {
        setUser(null);
        setStats(null);
        setLoading(false);
        return;
      }
      try {
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          setUser(userDoc.data() as UserProfile);
        } else {
          const role: UserRole =
            firebaseUser.email === 'dragon.systems.venture@gmail.com' ? 'admin' : 'student';
          const newUser: UserProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            role,
            displayName: firebaseUser.displayName || ''
          };
          await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
          setUser(newUser);
        }

        // Ensure stats doc exists (initial read)
        const statsRef = doc(db, 'stats', firebaseUser.uid);
        const statsSnap = await getDoc(statsRef);
        if (statsSnap.exists()) {
          setStats(statsSnap.data() as UserStats);
        } else {
          const initial: UserStats = {
            uid: firebaseUser.uid,
            seeds: 0,
            flowers: 0,
            level: 'A1',
            mastery: {},
            updatedAt: new Date().toISOString(),
          };
          await setDoc(statsRef, initial);
          setStats(initial);
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
        alert("Chyba při načítání profilu. Zkuste to prosím znovu.");
      } finally {
        setLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    if (!user?.uid) return;
    const statsRef = doc(db, 'stats', user.uid);
    return onSnapshot(statsRef, (s) => {
      if (s.exists()) setStats(s.data() as UserStats);
    });
  }, [user?.uid]);

  useEffect(() => {
    const checkInitialData = async () => {
      const snapshot = await getDocs(collection(db, 'vocabulary'));
      if (snapshot.empty) {
        const initialWords = [
          { word: 'Mother', translation: 'Matka', category: 'Family', level: 'A1', example: 'My mother is a doctor.' },
          { word: 'Bread', translation: 'Chléb', category: 'Food', level: 'A1', example: 'I buy fresh bread every morning.' },
          { word: 'Kitchen', translation: 'Kuchyně', category: 'House', level: 'A1', example: 'We cook in the kitchen.' },
          { word: 'Office', translation: 'Kancelář', category: 'Work', level: 'A1', example: 'He works in a modern office.' },
          { word: 'Tree', translation: 'Strom', category: 'Nature', level: 'A1', example: 'There is a big tree in the garden.' },
        ];
        for (const w of initialWords) {
          await addDoc(collection(db, 'vocabulary'), w);
        }
      }
    };
    checkInitialData();
  }, []);

  const devLogin = async (devUser: UserProfile) => {
    // Nastav uživatele v UI vždy, i když Firestore selže.
    setUser(devUser);

    try {
      const userRef = doc(db, 'users', devUser.uid);
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        await setDoc(userRef, {
          uid: devUser.uid,
          email: devUser.email || '',
          role: devUser.role,
          displayName: devUser.displayName || '',
        });
      }

      const statsRef = doc(db, 'stats', devUser.uid);
      const statsSnap = await getDoc(statsRef);
      if (statsSnap.exists()) {
        setStats(statsSnap.data() as UserStats);
      } else {
        const initial: UserStats = {
          uid: devUser.uid,
          seeds: 0,
          flowers: 0,
          level: 'A1',
          mastery: {},
          updatedAt: new Date().toISOString(),
        };
        await setDoc(statsRef, initial, { merge: true });
        setStats(initial);
      }
    } catch (e) {
      console.warn('Dev login: Firestore unavailable (OK for local dev).', e);
    }
  };

  const loginGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e) {
      console.error("Google sign in error", e);
      alert('Chyba při přihlašování přes Google.');
    }
  };

  const loginStudent = async () => {
    const devUser: UserProfile = {
      uid: 'dev-student-id',
      email: 'vika.mat@seznam.cz',
      role: 'student',
      displayName: 'Viktorka (Dev)',
    };
    await devLogin(devUser);
  };

  const loginAdmin = async () => {
    const devUser: UserProfile = {
      uid: 'dev-admin-id',
      email: 'dragon.systems.venture@gmail.com',
      role: 'admin',
      displayName: 'Admin (Dev)',
    };
    await devLogin(devUser);
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error(e);
    }
    setUser(null);
    setStats(null);
  };

  return (
    <ErrorBoundary>
      <AuthContext.Provider value={{ user, stats, loading, loginGoogle, loginStudent, loginAdmin, logout }}>
        <AppContent />
      </AuthContext.Provider>
    </ErrorBoundary>
  );
}

