import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import type {
  BenchmarkProgressEvent,
  QuestionResult,
  ConditionResult,
  BenchmarkQuestion,
  Dataset,
  MainArgScore,
} from './types';
import { computeBatchMetrics } from './metrics';

const REPO_ROOT = path.resolve(process.cwd(), '..');
const ARGORA_DIR = path.join(REPO_ROOT, 'argora');

function getPythonPath(): string {
  if (process.platform === 'win32') {
    return path.join(ARGORA_DIR, '.venv', 'Scripts', 'python.exe');
  }
  return path.join(ARGORA_DIR, '.venv', 'bin', 'python');
}

/**
 * Run a Python script and wait for it to complete.
 * Returns stdout as a string. Throws on non-zero exit.
 */
async function runPythonScript(
  scriptPath: string,
  args: string[],
  onStdout?: (line: string) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(getPythonPath(), [scriptPath, ...args], {
      cwd: ARGORA_DIR,
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stdout += text;
      if (onStdout) {
        const lines = text.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed) onStdout(trimmed);
        }
      }
    });

    proc.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Python process exited with code ${code}: ${stderr.slice(0, 500)}`));
      } else {
        resolve(stdout);
      }
    });

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn Python process: ${err.message}`));
    });
  });
}

/**
 * Parse a baseline result JSON file into ConditionResults.
 */
function parseBaselineResults(
  data: {
    metadata: { mode: string; accuracy: number };
    results: Array<{
      idx: number;
      question: string;
      choices: string[];
      subject?: string;
      gold_answer: string;
      predicted_answer: string | null;
      correct: boolean;
    }>;
  },
  condition: string,
): Map<number, ConditionResult> {
  const map = new Map<number, ConditionResult>();
  const letterToIndex: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };

  for (const r of data.results) {
    map.set(r.idx, {
      condition,
      answer: r.predicted_answer ? (letterToIndex[r.predicted_answer] ?? null) : null,
      correct: r.correct,
    });
  }

  return map;
}

/**
 * Parse ARGORA eval result JSON into ConditionResults.
 * Extracts per-main-argument scores for NRE (pre/post QBAF) and CM computation.
 */
function parseArgoraResults(
  data: {
    results: Array<{
      idx: number;
      question?: string;
      prompt?: string;
      actual_answer: string;
      predicted_answer_baseline?: string | null;
      correct_baseline?: boolean;
      main_args?: Array<{
        statement: string;
        initial_score?: number;
        final_score: number;
        answer_mapping?: string | null;
      }>;
    }>;
  },
  condition: string,
): Map<number, ConditionResult> {
  const map = new Map<number, ConditionResult>();
  const letterToIndex: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };

  for (const r of data.results) {
    const goldIndex = letterToIndex[r.actual_answer] ?? null;

    // Build per-main-argument scores
    const mainArgScores: MainArgScore[] = [];
    let preQbafAnswer: number | null = null;
    let postQbafAnswer: number | null = null;
    let highestInitial = -Infinity;
    let highestFinal = -Infinity;

    if (r.main_args && r.main_args.length > 0) {
      for (const a of r.main_args) {
        const ansIdx = a.answer_mapping ? (letterToIndex[a.answer_mapping] ?? null) : null;
        const initial = a.initial_score ?? a.final_score;
        const final = a.final_score ?? 0;

        mainArgScores.push({
          statement: a.statement,
          initialScore: initial,
          finalScore: final,
          answerIndex: ansIdx,
          correct: ansIdx !== null && ansIdx === goldIndex,
        });

        // Pre-QBAF winner: highest initial_score
        if (ansIdx !== null && initial > highestInitial) {
          highestInitial = initial;
          preQbafAnswer = ansIdx;
        }
        // Post-QBAF winner: highest final_score
        if (ansIdx !== null && final > highestFinal) {
          highestFinal = final;
          postQbafAnswer = ansIdx;
        }
      }
    }

    // Winner sigma = highest final_score across main args
    const sigma = highestFinal > -Infinity ? highestFinal : undefined;

    map.set(r.idx, {
      condition,
      answer: r.predicted_answer_baseline
        ? (letterToIndex[r.predicted_answer_baseline] ?? null)
        : null,
      correct: r.correct_baseline ?? false,
      sigma,
      preQbafAnswer,
      postQbafAnswer,
      preQbafCorrect: preQbafAnswer !== null && preQbafAnswer === goldIndex,
      postQbafCorrect: postQbafAnswer !== null && postQbafAnswer === goldIndex,
      mainArgScores,
    });
  }

  return map;
}

/**
 * Build BenchmarkQuestion objects from a baseline results file.
 */
function extractQuestions(
  data: {
    results: Array<{
      idx: number;
      question: string;
      choices: string[];
      subject?: string;
      gold_answer: string;
    }>;
  },
): Map<number, BenchmarkQuestion> {
  const map = new Map<number, BenchmarkQuestion>();
  const letterToIndex: Record<string, number> = { A: 0, B: 1, C: 2, D: 3 };

  for (const r of data.results) {
    map.set(r.idx, {
      question: r.question,
      choices: r.choices,
      answer: letterToIndex[r.gold_answer] ?? 0,
      subject: r.subject,
    });
  }

  return map;
}

/**
 * Get the baseline script path for a given dataset.
 */
function getBaselineScript(dataset: Dataset): string {
  return path.join(ARGORA_DIR, 'eval_baseline', `eval_${dataset}_baseline.py`);
}

/**
 * Run the full benchmark pipeline for a dataset.
 * Yields progress events as conditions are evaluated.
 */
export async function* runBatchBenchmark(
  dataset: Dataset,
  questionCount: number,
  seed = 42,
): AsyncGenerator<BenchmarkProgressEvent> {
  const outputDir = path.join(ARGORA_DIR, 'eval_baseline', 'results');
  const argoraOutputDir = path.join(ARGORA_DIR, 'eval', 'results');

  // Ensure output directories exist
  await fs.mkdir(outputDir, { recursive: true });
  await fs.mkdir(argoraOutputDir, { recursive: true });

  const baselineScript = getBaselineScript(dataset);
  const argoraScript = path.join(ARGORA_DIR, 'eval', 'eval_argora.py');

  // ---- Step 1: Run baseline (direct + CoT) ----
  yield { type: 'status', message: `Running baseline evaluation for ${dataset}...` };
  yield { type: 'condition_start', condition: 'direct_1x', total: questionCount };

  try {
    await runPythonScript(baselineScript, [
      '--num_data', String(questionCount),
      '--seed', String(seed),
      '--output_dir', outputDir,
    ], (line) => {
      // Parse progress from stdout if available
      const match = line.match(/^\[(\d+)\]/);
      if (match) {
        const idx = parseInt(match[1], 10);
        // Baseline runs both direct and CoT, so progress covers both
      }
    });

    // Read baseline results
    const baselinePath = path.join(
      outputDir,
      `${dataset}_baseline_mode_n${questionCount}_seed${seed}.json`,
    );
    const cotPath = path.join(
      outputDir,
      `${dataset}_cot_mode_n${questionCount}_seed${seed}.json`,
    );

    const baselineExists = await fs.access(baselinePath).then(() => true).catch(() => false);
    const cotExists = await fs.access(cotPath).then(() => true).catch(() => false);

    if (!baselineExists || !cotExists) {
      yield {
        type: 'error',
        message: `Baseline results not found at expected paths. Expected: ${baselinePath}`,
      };
      return;
    }

    const baselineData = JSON.parse(await fs.readFile(baselinePath, 'utf-8'));
    const cotData = JSON.parse(await fs.readFile(cotPath, 'utf-8'));

    const directResults = parseBaselineResults(baselineData, 'direct_1x');
    const cotResults = parseBaselineResults(cotData, 'direct_cot_1x');
    const questions = extractQuestions(baselineData);

    yield {
      type: 'condition_complete',
      condition: 'direct_1x',
      accuracy: baselineData.metadata.accuracy,
    };
    yield {
      type: 'condition_complete',
      condition: 'direct_cot_1x',
      accuracy: cotData.metadata.accuracy,
    };

    // ---- Step 2: Run ARGORA evaluation ----
    yield { type: 'status', message: `Running ARGORA evaluation for ${dataset}...` };
    yield { type: 'condition_start', condition: 'argora', total: questionCount };

    const argoraOutputFilename = `${dataset}_argora_n${questionCount}_seed${seed}.json`;

    await runPythonScript(argoraScript, [
      '--target_dataset', dataset,
      '--num_data', String(questionCount),
      '--seed', String(seed),
      '--output_filename', argoraOutputFilename,
    ], (line) => {
      // Progress tracking from ARGORA output
    });

    const argoraPath = path.join(argoraOutputDir, argoraOutputFilename);
    const argoraExists = await fs.access(argoraPath).then(() => true).catch(() => false);

    let argoraResults: Map<number, ConditionResult> | null = null;
    if (argoraExists) {
      const argoraData = JSON.parse(await fs.readFile(argoraPath, 'utf-8'));
      argoraResults = parseArgoraResults(argoraData, 'argora');

      const argoraCorrect = Array.from(argoraResults.values()).filter((r) => r.correct).length;
      const argoraTotal = argoraResults.size;
      yield {
        type: 'condition_complete',
        condition: 'argora',
        accuracy: argoraTotal > 0 ? argoraCorrect / argoraTotal : 0,
      };
    } else {
      yield {
        type: 'error',
        message: `ARGORA results not found at ${argoraPath}. Continuing with baseline-only results.`,
      };
    }

    // ---- Step 3: Assemble per-question results ----
    yield { type: 'status', message: 'Assembling results...' };

    const questionResults: QuestionResult[] = [];
    for (const [idx, question] of questions) {
      const conditions: ConditionResult[] = [];

      const direct = directResults.get(idx);
      if (direct) conditions.push(direct);

      const cot = cotResults.get(idx);
      if (cot) conditions.push(cot);

      // TODO: MV3 requires 3 independent CoT runs with majority vote.
      // Currently copies CoT result as placeholder — remove or implement properly.
      conditions.push({
        condition: 'mv3',
        answer: cot?.answer ?? null,
        correct: cot?.correct ?? false,
      });

      if (argoraResults) {
        const argora = argoraResults.get(idx);
        if (argora) conditions.push(argora);
      }

      const qr: QuestionResult = { question, conditions };
      questionResults.push(qr);

      yield { type: 'question_result', questionIndex: questionResults.length - 1, result: qr };
    }

    // ---- Step 4: Compute metrics ----
    const metrics = computeBatchMetrics(questionResults);

    const batchResult = {
      dataset,
      metrics,
      questions: questionResults,
      timestamp: new Date().toISOString(),
    };

    yield { type: 'batch_complete', result: batchResult };
  } catch (err) {
    yield {
      type: 'error',
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
