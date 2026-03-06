'use client';

import type { BatchMetrics } from '@/lib/argument/benchmarks/types';
import { CONDITION_LABELS } from '@/lib/argument/benchmarks/types';

interface BenchmarkResultsProps {
  metrics: BatchMetrics | null;
  loading?: boolean;
}

export default function BenchmarkResults({ metrics, loading }: BenchmarkResultsProps) {
  if (loading) {
    return (
      <div className="rounded-lg border border-card-border bg-card-bg p-6">
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <span className="text-muted">Running benchmark...</span>
        </div>
      </div>
    );
  }

  if (!metrics) {
    return (
      <div className="rounded-lg border border-card-border bg-card-bg p-6">
        <p className="text-muted">No results yet. Run a benchmark to see results.</p>
      </div>
    );
  }

  const conditionOrder = [
    'direct_1x',
    'direct_cot_1x',
    'mv3',
    'argora_cot_1x',
    'argora_cot_mv3',
    'argora',
  ];

  const presentConditions = conditionOrder.filter((c) => c in metrics.accuracy);

  return (
    <div className="space-y-6">
      {/* Accuracy Table */}
      <div className="rounded-lg border border-card-border bg-card-bg p-6">
        <h3 className="mb-4 text-lg font-semibold text-foreground">Accuracy by Condition</h3>
        <table className="w-full">
          <thead>
            <tr className="border-b border-card-border">
              <th className="pb-2 text-left text-sm font-medium text-muted">Condition</th>
              <th className="pb-2 text-right text-sm font-medium text-muted">Accuracy</th>
              <th className="pb-2 text-right text-sm font-medium text-muted">Bar</th>
            </tr>
          </thead>
          <tbody>
            {presentConditions.map((condition) => {
              const acc = metrics.accuracy[condition];
              const isArgora = condition.startsWith('argora');
              return (
                <tr key={condition} className="border-b border-card-border/50">
                  <td className="py-2 text-sm text-foreground">
                    <span className={isArgora ? 'font-semibold text-accent' : ''}>
                      {CONDITION_LABELS[condition] ?? condition}
                    </span>
                  </td>
                  <td className="py-2 text-right font-mono text-sm text-foreground">
                    {(acc * 100).toFixed(1)}%
                  </td>
                  <td className="py-2 pl-4">
                    <div className="h-3 w-full rounded-full bg-surface">
                      <div
                        className={`h-3 rounded-full ${isArgora ? 'bg-accent' : 'bg-muted'}`}
                        style={{ width: `${acc * 100}%` }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-muted">
          {metrics.questionCount} questions evaluated
        </p>
      </div>

      {/* NRE & Correctness Margin */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {/* NRE */}
        <div className="rounded-lg border border-card-border bg-card-bg p-4">
          <h4 className="mb-1 text-sm font-medium text-muted">Net Reversal Efficiency</h4>
          {metrics.nre !== null ? (
            <div className="flex items-baseline gap-2">
              <span
                className={`text-2xl font-bold ${
                  metrics.nre > 0 ? 'text-green-500' : metrics.nre < 0 ? 'text-accent' : 'text-muted'
                }`}
              >
                {metrics.nre > 0 ? '+' : ''}
                {(metrics.nre * 100).toFixed(1)}%
              </span>
            </div>
          ) : (
            <span className="text-sm text-muted">N/A (no disagreements)</span>
          )}
          <p className="mt-1 text-xs text-muted">
            Positive = ARGORA fixes more than it breaks
          </p>
        </div>

        {/* Correctness Margin */}
        <div className="rounded-lg border border-card-border bg-card-bg p-4">
          <h4 className="mb-1 text-sm font-medium text-muted">Correctness Margin</h4>
          {metrics.correctnessMargin !== null ? (
            <span
              className={`text-2xl font-bold ${
                metrics.correctnessMargin > 0
                  ? 'text-green-500'
                  : metrics.correctnessMargin < 0
                    ? 'text-accent'
                    : 'text-muted'
              }`}
            >
              {metrics.correctnessMargin > 0 ? '+' : ''}
              {metrics.correctnessMargin.toFixed(3)}
            </span>
          ) : (
            <span className="text-sm text-muted">N/A</span>
          )}
          <p className="mt-1 text-xs text-muted">
            Mean sigma difference (correct vs wrong)
          </p>
        </div>

        {/* Disagree Count */}
        <div className="rounded-lg border border-card-border bg-card-bg p-4">
          <h4 className="mb-1 text-sm font-medium text-muted">Disagreements</h4>
          <span className="text-2xl font-bold text-foreground">{metrics.disagreeCount}</span>
          <span className="ml-1 text-sm text-muted">/ {metrics.questionCount}</span>
          <p className="mt-1 text-xs text-muted">
            Questions where baseline and ARGORA disagreed
          </p>
        </div>
      </div>
    </div>
  );
}
