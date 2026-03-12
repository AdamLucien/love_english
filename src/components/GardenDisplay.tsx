import React from 'react';
import type { UserStats } from '../types';

const FLOWER_MAP: Record<string, string> = {
  A1: '🌱',
  A2: '📗',
  A3: '🌸',
  B1: '🌻',
  B2: '🌹',
  C1: '🌵',
};

function seedStage(progress: number): '' | '🌱' | '🌿' {
  if (progress >= 3) return '🌿';
  if (progress >= 1) return '🌱';
  return '';
}

export function GardenDisplay({ stats }: { stats: UserStats }) {
  const currentFlower = FLOWER_MAP[stats.level] || '🌸';
  const progress = ((stats.seeds % 5) + 5) % 5;
  const sprout = seedStage(progress);
  const toNext = 5 - progress;

  return (
    <div className="p-6 sm:p-8 bg-gradient-to-br from-pink-50 via-white to-pink-100 rounded-3xl shadow-lg border border-pink-200 overflow-hidden relative">
      <div className="absolute top-0 right-0 -mr-16 -mt-16 text-pink-200 opacity-30 transform rotate-12 pointer-events-none text-9xl">
        {currentFlower}
      </div>
      
      <div className="flex items-start justify-between gap-4 relative z-10">
        <div>
          <h2 className="text-3xl font-bold text-pink-900 drop-shadow-sm flex items-center gap-2">
             Moje zahrada
          </h2>
          <p className="text-sm text-pink-700/80 mt-1 font-medium">Učení jako zahrada — semínka se mění v květiny.</p>
        </div>
        <div className="text-right bg-white/60 backdrop-blur-sm px-4 py-2 rounded-2xl border border-pink-100 shadow-sm">
          <p className="text-xs text-pink-500 uppercase tracking-widest font-bold">Úroveň</p>
          <p className="text-2xl font-black text-pink-600">{stats.level}</p>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-4 text-5xl min-h-[80px] relative z-10">
        {Array.from({ length: Math.min(80, stats.flowers) }).map((_, i) => (
          <span key={i} className="animate-pop-in hover:scale-125 transition-transform cursor-pointer drop-shadow-md" style={{ animationDelay: `${i * 50}ms` }}>
            {currentFlower}
          </span>
        ))}
        {sprout && (
          <span className="opacity-70 animate-bounce cursor-help" title="Rozpracovaná květina">
            {sprout}
          </span>
        )}
        {stats.flowers === 0 && !sprout && (
          <div className="w-full flex justify-center py-6">
            <span className="text-lg text-pink-600/60 font-medium bg-white/50 px-6 py-3 rounded-full italic">
              Zatím tu nic neroste. Zkus si první test, lásko! 🌱
            </span>
          </div>
        )}
      </div>

      <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 relative z-10">
        <div className="p-4 rounded-2xl bg-white/80 backdrop-blur-md border border-pink-100 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-xs uppercase tracking-wider font-bold text-gray-500 mb-1">Semínka celkem</p>
          <p className="text-2xl font-black text-emerald-600 drop-shadow-sm">{stats.seeds}</p>
        </div>
        <div className="p-4 rounded-2xl bg-white/80 backdrop-blur-md border border-pink-100 shadow-sm hover:shadow-md transition-shadow">
          <p className="text-xs uppercase tracking-wider font-bold text-gray-500 mb-1">Květiny</p>
          <p className="text-2xl font-black text-pink-600 drop-shadow-sm">{stats.flowers}</p>
        </div>
        <div className="p-4 rounded-2xl flex flex-col justify-center bg-gradient-to-r from-pink-100 to-pink-50 border border-pink-200 shadow-inner">
          <div className="flex justify-between items-end mb-2">
            <p className="text-xs uppercase tracking-wider font-bold text-pink-800">Do další květiny</p>
            <p className="text-sm font-black text-pink-600">{toNext}/5</p>
          </div>
          <div className="w-full h-3 bg-white/50 rounded-full overflow-hidden shadow-inner backdrop-blur-sm">
            <div 
              className="h-full bg-gradient-to-r from-pink-400 to-pink-600 transition-all duration-1000 ease-out rounded-full" 
              style={{ width: `${(progress / 5) * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

