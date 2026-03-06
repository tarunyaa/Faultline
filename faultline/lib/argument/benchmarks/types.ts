// Types for ARGORA benchmark evaluation pipeline

export interface BenchmarkQuestion {
  question: string;
  choices: string[];
  answer: number; // correct answer index
  subject?: string;
}

export interface MainArgScore {
  statement: string;
  initialScore: number; // pre-QBAF base score
  finalScore: number;   // post-QBAF DF-QuAD strength
  answerIndex: number | null; // which answer this arg supports
  correct: boolean;     // does this arg's answer match gold?
}

export interface ConditionResult {
  condition: string; // 'direct_1x' | 'direct_cot_1x' | 'mv3' | 'argora_cot_1x' | 'argora_cot_mv3' | 'argora'
  answer: number | null;
  correct: boolean;
  sigma?: number; // QBAF root strength (ARGORA only)
  // ARGORA-internal: pre/post QBAF predictions for NRE computation
  preQbafAnswer?: number | null;  // answer based on highest initial_score
  postQbafAnswer?: number | null; // answer based on highest final_score
  preQbafCorrect?: boolean;
  postQbafCorrect?: boolean;
  // All main argument scores for correctness margin
  mainArgScores?: MainArgScore[];
}

export interface QuestionResult {
  question: BenchmarkQuestion;
  conditions: ConditionResult[];
}

export interface BatchMetrics {
  accuracy: Record<string, number>; // per condition
  nre: number | null; // Net Reversal Efficiency
  correctnessMargin: number | null;
  questionCount: number;
  disagreeCount: number; // questions where experts disagreed
}

export interface BatchResult {
  dataset: string;
  metrics: BatchMetrics;
  questions: QuestionResult[];
  timestamp: string;
}

// Progress events emitted by the runner
export type BenchmarkProgressEvent =
  | { type: 'status'; message: string }
  | { type: 'condition_start'; condition: string; total: number }
  | { type: 'condition_progress'; condition: string; completed: number; total: number }
  | { type: 'condition_complete'; condition: string; accuracy: number }
  | { type: 'question_result'; questionIndex: number; result: QuestionResult }
  | { type: 'batch_complete'; result: BatchResult }
  | { type: 'error'; message: string };

// Available datasets matching ARGORA's eval_argora.py
export const DATASETS = [
  'mmlu',
  'mmlu_pro',
  'gpqa',
  'gsm8k',
  'truthfulqa',
  'medqa',
  'strategyqa',
] as const;

export type Dataset = (typeof DATASETS)[number];

// Condition labels for display
export const CONDITION_LABELS: Record<string, string> = {
  direct_1x: 'Direct (1x)',
  direct_cot_1x: 'Direct CoT (1x)',
  mv3: 'Majority Vote (3x)',
  argora_cot_1x: 'ARGORA CoT (1x)',
  argora_cot_mv3: 'ARGORA CoT MV(3)',
  argora: 'ARGORA (full)',
};
