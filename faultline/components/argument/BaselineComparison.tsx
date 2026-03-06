'use client';

import { useState } from 'react';
import type { QuestionResult } from '@/lib/argument/benchmarks/types';
import { CONDITION_LABELS } from '@/lib/argument/benchmarks/types';

interface BaselineComparisonProps {
  questions: QuestionResult[];
}

export default function BaselineComparison({ questions }: BaselineComparisonProps) {
  const [filter, setFilter] = useState<'all' | 'disagree' | 'argora_correct' | 'argora_wrong'>(
    'all',
  );
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  if (questions.length === 0) {
    return (
      <div className="rounded-lg border border-card-border bg-card-bg p-6">
        <p className="text-muted">No per-question results available.</p>
      </div>
    );
  }

  // Determine which conditions are present
  const allConditions = new Set<string>();
  for (const q of questions) {
    for (const c of q.conditions) {
      allConditions.add(c.condition);
    }
  }
  const conditionOrder = [
    'direct_1x',
    'direct_cot_1x',
    'mv3',
    'argora_cot_1x',
    'argora_cot_mv3',
    'argora',
  ];
  const presentConditions = conditionOrder.filter((c) => allConditions.has(c));

  // Filter questions
  const filtered = questions.filter((q) => {
    if (filter === 'all') return true;

    const baseline = q.conditions.find((c) => c.condition === 'direct_cot_1x');
    const argora = q.conditions.find((c) => c.condition === 'argora');

    if (filter === 'disagree') {
      return (
        baseline &&
        argora &&
        baseline.answer !== null &&
        argora.answer !== null &&
        baseline.answer !== argora.answer
      );
    }
    if (filter === 'argora_correct') {
      return argora?.correct === true;
    }
    if (filter === 'argora_wrong') {
      return argora?.correct === false;
    }
    return true;
  });

  const indexToLetter = (idx: number | null): string => {
    if (idx === null) return '-';
    return 'ABCDEFGHIJ'[idx] ?? String(idx);
  };

  return (
    <div className="rounded-lg border border-card-border bg-card-bg p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Per-Question Comparison</h3>
        <div className="flex gap-2">
          {(
            [
              ['all', 'All'],
              ['disagree', 'Disagreements'],
              ['argora_correct', 'ARGORA Correct'],
              ['argora_wrong', 'ARGORA Wrong'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`rounded px-3 py-1 text-xs transition-colors ${
                filter === key
                  ? 'bg-accent text-foreground'
                  : 'bg-surface text-muted hover:text-foreground'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <p className="mb-3 text-xs text-muted">
        Showing {filtered.length} of {questions.length} questions
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-card-border">
              <th className="pb-2 pr-3 text-left font-medium text-muted">#</th>
              <th className="pb-2 pr-3 text-left font-medium text-muted">Question</th>
              <th className="pb-2 pr-3 text-center font-medium text-muted">Correct</th>
              {presentConditions.map((c) => (
                <th key={c} className="pb-2 px-2 text-center font-medium text-muted">
                  {(CONDITION_LABELS[c] ?? c).replace(/ /g, '\u00A0')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((q, i) => {
              const isExpanded = expandedIdx === i;
              return (
                <tr
                  key={i}
                  className="cursor-pointer border-b border-card-border/30 hover:bg-surface/50"
                  onClick={() => setExpandedIdx(isExpanded ? null : i)}
                >
                  <td className="py-2 pr-3 font-mono text-xs text-muted">{i + 1}</td>
                  <td className="max-w-xs truncate py-2 pr-3 text-foreground">
                    {isExpanded ? (
                      <div className="whitespace-normal">
                        <p className="mb-1">{q.question.question}</p>
                        {q.question.subject && (
                          <span className="text-xs text-muted">
                            Subject: {q.question.subject}
                          </span>
                        )}
                        <div className="mt-1 space-y-0.5">
                          {q.question.choices.map((choice, ci) => (
                            <div
                              key={ci}
                              className={`text-xs ${ci === q.question.answer ? 'font-semibold text-green-500' : 'text-muted'}`}
                            >
                              {indexToLetter(ci)}) {choice}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      q.question.question.slice(0, 80) +
                      (q.question.question.length > 80 ? '...' : '')
                    )}
                  </td>
                  <td className="py-2 pr-3 text-center font-mono text-xs text-green-500">
                    {indexToLetter(q.question.answer)}
                  </td>
                  {presentConditions.map((condKey) => {
                    const cond = q.conditions.find((c) => c.condition === condKey);
                    if (!cond) {
                      return (
                        <td key={condKey} className="py-2 px-2 text-center text-muted">
                          -
                        </td>
                      );
                    }
                    return (
                      <td
                        key={condKey}
                        className={`py-2 px-2 text-center font-mono text-xs ${
                          cond.correct ? 'text-green-500' : 'text-accent'
                        }`}
                      >
                        {indexToLetter(cond.answer)}
                        {cond.sigma !== undefined && (
                          <span className="ml-1 text-muted">
                            ({cond.sigma.toFixed(2)})
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
