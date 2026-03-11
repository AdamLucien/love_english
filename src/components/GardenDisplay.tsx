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
    <div className="p-6 bg-white rounded-2xl shadow-sm border border-pink-100">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Moje zahrada</h2>
          <p className="text-sm text-gray-500">Učení jako zahrada — semínka se mění v květiny.</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">Úroveň</p>
          <p className="text-xl font-bold text-pink-600">{stats.level}</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-3 text-4xl">
        {Array.from({ length: Math.min(80, stats.flowers) }).map((_, i) => (
          <span key={i} className="animate-pop-in">
            {currentFlower}
          </span>
        ))}
        {sprout && (
          <span className="opacity-60 animate-pulse" title="Rozpracovaná květina">
            {sprout}
          </span>
        )}
        {stats.flowers === 0 && !sprout && (
          <span className="text-base text-gray-500">
            Zatím tu nic neroste. Udělej test a zasadíš první semínka.
          </span>
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm text-gray-600">
        <div className="p-3 rounded-xl bg-floral-pink border border-pink-100">
          <p className="text-xs text-gray-500">Semínka (celkem)</p>
          <p className="text-lg font-bold text-emerald-700">{stats.seeds}</p>
        </div>
        <div className="p-3 rounded-xl bg-floral-pink border border-pink-100">
          <p className="text-xs text-gray-500">Květiny</p>
          <p className="text-lg font-bold text-pink-700">{stats.flowers}</p>
        </div>
        <div className="p-3 rounded-xl bg-floral-pink border border-pink-100">
          <p className="text-xs text-gray-500">Do další květiny</p>
          <p className="text-lg font-bold text-gray-800">
            {toNext}/5
          </p>
        </div>
      </div>
    </div>
  );
}

