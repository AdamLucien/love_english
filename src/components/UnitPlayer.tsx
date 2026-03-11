import React, { useMemo, useState } from 'react';
import Markdown from 'react-markdown';
import type { UnitContentPack } from '../types';

type Step = 'lesson' | 'test' | 'result';

export function UnitPlayer({
  content,
  onFinish,
}: {
  content: UnitContentPack;
  onFinish: (result: { correct: number; total: number }) => Promise<void> | void;
}) {
  const [step, setStep] = useState<Step>('lesson');
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  const total = content.testSuite.length;
  const q = content.testSuite[currentQuestion];

  const pct = useMemo(() => {
    if (!total) return 0;
    return Math.round((correct / total) * 100);
  }, [correct, total]);

  const answer = (opt: string) => {
    if (selected) return;
    setSelected(opt);
    const isCorrect = opt === q.correctAnswer;
    if (isCorrect) setCorrect((c) => c + 1);

    setTimeout(() => {
      if (currentQuestion + 1 < total) {
        setCurrentQuestion((i) => i + 1);
        setSelected(null);
      } else {
        setStep('result');
      }
    }, 900);
  };

  if (step === 'lesson') {
    return (
      <div className="max-w-3xl mx-auto p-8 bg-white rounded-3xl shadow-lg border-2 border-pink-50 space-y-6">
        <div className="space-y-1">
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">{content.level} · {content.unitId}</p>
          <h1 className="text-3xl font-bold text-pink-600">Dnešní mise 🌸</h1>
          <h2 className="text-xl font-bold text-gray-900">{content.title}</h2>
        </div>

        <div className="markdown-body">
          <div className="p-5 rounded-2xl bg-gray-50 border border-gray-100">
            <p className="text-sm font-bold text-gray-700 mb-2">Context Text (EN)</p>
            <Markdown>{content.contextText}</Markdown>
          </div>

          <div className="mt-5 p-5 rounded-2xl bg-blue-50 border border-blue-100">
            <p className="text-sm font-bold text-blue-900 mb-2">Gramatické okénko (CZ)</p>
            <Markdown>{content.grammarExplanation}</Markdown>
          </div>
        </div>

        <button
          onClick={() => setStep('test')}
          className="w-full py-4 bg-pink-500 text-white font-bold rounded-2xl hover:bg-pink-600 transition-all shadow-md"
        >
          Jsem připravená na výzvu!
        </button>
      </div>
    );
  }

  if (step === 'result') {
    return (
      <div className="max-w-3xl mx-auto p-8 bg-white rounded-3xl shadow-lg border-2 border-pink-50 space-y-6 text-center">
        <h2 className="text-3xl font-bold text-gray-900">Mise dokončena!</h2>
        <p className="text-gray-600">Skóre: <span className="font-bold text-pink-600">{correct}</span> / {total} ({pct}%)</p>
        <button
          onClick={() => onFinish({ correct, total })}
          className="w-full py-4 bg-emerald-600 text-white font-bold rounded-2xl hover:bg-emerald-700 transition-all shadow-md"
        >
          Zapsat progres a pokračovat
        </button>
      </div>
    );
  }

  // step === 'test'
  return (
    <div className="max-w-3xl mx-auto p-8 bg-white rounded-3xl shadow-lg border-2 border-indigo-50 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-400">Test Suite</p>
          <p className="font-bold text-gray-900">{content.title}</p>
        </div>
        <div className="text-right text-sm text-gray-500">
          Otázka <span className="font-bold">{currentQuestion + 1}</span> / {total}
        </div>
      </div>

      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-500 transition-all duration-300"
          style={{ width: `${((currentQuestion + 1) / total) * 100}%` }}
        />
      </div>

      <div className="space-y-3">
        <h3 className="text-2xl font-medium text-gray-900">{q.question}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {q.options.map((opt) => {
            const isCorrect = opt === q.correctAnswer;
            const isSelected = selected === opt;
            const showCorrect = selected && isCorrect;
            const showWrong = isSelected && !isCorrect;
            return (
              <button
                key={opt}
                disabled={!!selected}
                onClick={() => answer(opt)}
                className={[
                  'p-4 rounded-xl border-2 transition-all text-left font-medium',
                  isSelected
                    ? (isCorrect ? 'border-green-500 bg-green-50 text-green-800' : 'border-red-500 bg-red-50 text-red-800')
                    : (showCorrect ? 'border-green-500 bg-green-50 text-green-800' : 'border-gray-200 hover:border-indigo-300'),
                ].join(' ')}
              >
                {opt}
              </button>
            );
          })}
        </div>

        {selected && (
          <div className={['p-4 rounded-xl border text-sm', selected === q.correctAnswer ? 'bg-green-50 border-green-200 text-green-900' : 'bg-red-50 border-red-200 text-red-900'].join(' ')}>
            <p className="font-bold">{selected === q.correctAnswer ? 'Správně!' : 'Chyba!'}</p>
            <p className="mt-1">{q.explanation}</p>
          </div>
        )}
      </div>
    </div>
  );
}

