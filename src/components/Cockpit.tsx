import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, Lock } from 'lucide-react';
import type { TestResult, UnitContentPack, UserProfile, UserStats } from '../types';
import type { RoadmapUnitId } from '../roadmap';
import { ROADMAP, getUnitMastery, isUnitUnlocked, computeLevelFromMastery } from '../roadmap';
import { addDoc, collection, db, doc, getDoc, limit, onSnapshot, orderBy, query, setDoc, where } from '../firebase';
import { UnitPlayer } from './UnitPlayer';

const FLOWER_BY_LEVEL: Record<string, string> = {
  A3: '🌸',
  B1: '🌻',
  B2: '🌹',
  C1: '🌵',
};

function cn(...xs: Array<string | false | null | undefined>) {
  return xs.filter(Boolean).join(' ');
}

function seedsFromRatio(ratio: number) {
  const r = Math.max(0, Math.min(1, ratio));
  return Math.max(1, Math.min(5, Math.round(5 * r)));
}

function updateMastery(prev: number, latest: number) {
  const next = prev * 0.7 + latest * 0.3;
  return Math.max(0, Math.min(1, next));
}

function useUnitHistory(unitId: string | null, uid: string | null) {
  const [history, setHistory] = useState<TestResult[]>([]);
  useEffect(() => {
    if (!unitId || !uid) {
      setHistory([]);
      return;
    }
    const q = query(
      collection(db, 'testResults'),
      where('studentUid', '==', uid),
      where('unitId', '==', unitId),
      orderBy('timestamp', 'desc'),
      limit(5)
    );
    return onSnapshot(q, (s) => {
      const rows: TestResult[] = s.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
      setHistory(rows);
    });
  }, [unitId, uid]);
  return history;
}

export function Cockpit({
  user,
  stats,
}: {
  user: UserProfile;
  stats: UserStats | null;
}) {
  const [activeUnitId, setActiveUnitId] = useState<RoadmapUnitId | null>(null);
  const [content, setContent] = useState<UnitContentPack | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'briefing' | 'mission'>('briefing');

  const grouped = useMemo(() => {
    const levels = ['A3', 'B1', 'B2', 'C1'] as const;
    return levels.map((lvl) => ({
      level: lvl,
      units: ROADMAP.filter((u) => u.level === lvl),
    }));
  }, []);

  const activeUnit = useMemo(() => {
    if (!activeUnitId) return null;
    return ROADMAP.find((u) => u.id === activeUnitId) || null;
  }, [activeUnitId]);

  const history = useUnitHistory(activeUnitId, user.uid);
  // (keep same name usage below)
  const best = useMemo(() => {
    if (!history.length) return null;
    const bestRatio = Math.max(...history.map((h) => (h.total ? h.score / h.total : 0)));
    return Math.round(bestRatio * 100);
  }, [history]);

  const loadUnit = async (id: RoadmapUnitId) => {
    setActiveUnitId(id);
    setMode('briefing');
    setContent(null);
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, 'units', id));
      if (snap.exists()) {
        setContent(snap.data() as UnitContentPack);
      } else {
        setContent(null);
      }
    } catch {
      setContent(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr_320px] gap-4">
      {/* Sidebar */}
      <aside className="lg:sticky lg:top-6 h-fit rounded-3xl border border-white/20 bg-white/10 backdrop-blur-md shadow-sm overflow-hidden">
        <div className="p-5 border-b border-white/20">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500">Roadmap</p>
          <p className="text-lg font-bold text-gray-900">Pilotní plán</p>
        </div>
        <div className="p-3 space-y-4">
          {grouped.map((g) => (
            <div key={g.level}>
              <div className="px-2 py-1 text-xs font-bold text-gray-500 flex items-center justify-between">
                <span>{g.level}</span>
                <span className="opacity-70">{FLOWER_BY_LEVEL[g.level]}</span>
              </div>
              <div className="mt-2 space-y-1">
                {g.units.map((u) => {
                  const unlocked = isUnitUnlocked(stats, u);
                  const m = Math.round(getUnitMastery(stats, u.id as RoadmapUnitId) * 100);
                  const mastered = m >= Math.round(u.masteryThreshold * 100);
                  const active = activeUnitId === u.id;
                  return (
                    <button
                      key={u.id}
                      disabled={!unlocked}
                      onClick={() => loadUnit(u.id)}
                      className={cn(
                        'w-full text-left px-3 py-3 rounded-2xl border transition-all',
                        active ? 'border-l-4 border-pink-500 bg-pink-50/50 border-pink-100' : 'border-white/20 bg-white/20 hover:bg-white/30',
                        !unlocked && 'opacity-60 cursor-not-allowed'
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-gray-900 truncate">{u.title}</p>
                          <p className="text-[11px] text-gray-600 truncate">{u.topics.slice(0, 3).join(' · ')}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          {mastered ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          ) : !unlocked ? (
                            <Lock className="w-4 h-4 text-gray-500" />
                          ) : (
                            <span className="text-lg leading-none">{FLOWER_BY_LEVEL[u.level]}</span>
                          )}
                        </div>
                      </div>
                      <div className="mt-2 h-1.5 bg-white/40 rounded-full overflow-hidden">
                        <div className="h-full bg-pink-500" style={{ width: `${m}%` }} />
                      </div>
                      <div className="mt-1 text-[10px] text-gray-600">Mastery: <span className="font-bold">{m}%</span></div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Command Center */}
      <section className="rounded-3xl border border-black/5 bg-white shadow-sm overflow-hidden">
        <div className="p-5 border-b border-black/5 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Command Center</p>
            <p className="text-lg font-bold text-gray-900">Briefing & Mise</p>
          </div>
          <div className="text-right text-xs text-gray-500">
            Úroveň: <span className="font-bold text-pink-600">{stats?.level ?? 'A2'}</span>
          </div>
        </div>

        <div className="p-5">
          <AnimatePresence mode="wait">
            {!activeUnitId ? (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div className="text-center py-16 text-gray-500">
                  Vyber jednotku vlevo a začni misi.
                </div>
              </motion.div>
            ) : (
              <motion.div key={activeUnitId} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <div className="space-y-4">
                  <div className="p-5 rounded-2xl bg-gray-50 border border-gray-100">
                    <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Briefing</p>
                    <p className="text-xl font-bold text-gray-900 mt-1">{activeUnit?.title}</p>
                    <p className="text-sm text-gray-600 mt-2">
                      Témata: <span className="font-medium">{activeUnit?.topics.join(', ')}</span>
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <span className="px-2 py-1 rounded-full bg-white border border-gray-200">High score: <span className="font-bold">{best ?? '—'}%</span></span>
                      <span className="px-2 py-1 rounded-full bg-white border border-gray-200">Mastery: <span className="font-bold">{Math.round(getUnitMastery(stats, activeUnitId) * 100)}%</span></span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setMode('mission')}
                      className="flex-1 py-4 bg-pink-500 text-white font-bold rounded-2xl hover:bg-pink-600 transition-all shadow-md"
                    >
                      START MISSION
                    </button>
                    <button
                      onClick={() => setActiveUnitId(null)}
                      className="px-4 py-4 bg-white text-gray-700 font-bold rounded-2xl border border-gray-200 hover:bg-gray-50 transition-all"
                    >
                      Zpět
                    </button>
                  </div>

                  {mode === 'mission' && (
                    <div className="mt-4">
                      {!content ? (
                        <div className="p-5 rounded-2xl bg-yellow-50 border border-yellow-100 text-yellow-900">
                          Tahle jednotka ještě nemá obsah v databázi. Požádej admina o doplnění přes „AI Content Factory“.
                        </div>
                      ) : (
                        <UnitPlayer
                          content={content}
                          onFinish={async ({ correct, total }) => {
                            const ratio = total > 0 ? correct / total : 0;
                            await addDoc(collection(db, 'testResults'), {
                              studentUid: user.uid,
                              testType: `Unit: ${content.unitId}`,
                              unitId: content.unitId,
                              score: correct,
                              total,
                              timestamp: new Date().toISOString(),
                            });

                            const unitId = content.unitId as RoadmapUnitId;
                            const prevM = getUnitMastery(stats, unitId);
                            const nextM = updateMastery(prevM, ratio);
                            const nextMasteryMap = { ...(stats?.mastery ?? {}), [unitId]: nextM };

                            const earnedSeeds = seedsFromRatio(ratio);
                            const statsRef = doc(db, 'stats', user.uid);
                            const nextSeeds = (stats?.seeds ?? 0) + earnedSeeds;
                            const flowerGain = Math.floor(nextSeeds / 5) - Math.floor((stats?.seeds ?? 0) / 5);
                            const nextFlowers = (stats?.flowers ?? 0) + Math.max(0, flowerGain);
                            const nextLevel = computeLevelFromMastery({
                              ...(stats ?? { uid: user.uid, seeds: 0, flowers: 0, level: 'A2', updatedAt: '' }),
                              mastery: nextMasteryMap,
                            } as any);

                            await setDoc(
                              statsRef,
                              {
                                uid: user.uid,
                                seeds: nextSeeds,
                                flowers: nextFlowers,
                                level: nextLevel,
                                mastery: nextMasteryMap,
                                updatedAt: new Date().toISOString(),
                              },
                              { merge: true }
                            );

                            setMode('briefing');
                          }}
                        />
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* History */}
      <aside className="lg:sticky lg:top-6 h-fit rounded-3xl border border-black/5 bg-white shadow-sm overflow-hidden">
        <div className="p-5 border-b border-black/5">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">History & Stats</p>
          <p className="text-lg font-bold text-gray-900">Letový deník</p>
        </div>
        <div className="p-5 space-y-4">
          {!activeUnitId ? (
            <div className="text-sm text-gray-500">Vyber jednotku pro zobrazení historie.</div>
          ) : history.length === 0 ? (
            <div className="text-sm text-gray-500">Zatím žádné pokusy. První let čeká!</div>
          ) : (
            <div className="space-y-2">
              {history.map((h) => {
                const ratio = h.total ? h.score / h.total : 0;
                return (
                  <div key={h.id} className="p-3 rounded-2xl bg-gray-50 border border-gray-100">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-bold text-gray-900">{Math.round(ratio * 100)}%</span>
                      <span className="text-xs text-gray-500">{new Date(h.timestamp).toLocaleString()}</span>
                    </div>
                    <div className="mt-2 h-1.5 bg-white rounded-full overflow-hidden border border-gray-100">
                      <div className="h-full bg-emerald-500" style={{ width: `${Math.round(ratio * 100)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

