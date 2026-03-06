import type { QuestionResult, BatchMetrics } from './types';

/**
 * Compute per-condition accuracy from question results.
 */
export function computeAccuracy(results: QuestionResult[]): Record<string, number> {
  if (results.length === 0) return {};

  // Collect all condition names
  const conditions = new Set<string>();
  for (const q of results) {
    for (const c of q.conditions) {
      conditions.add(c.condition);
    }
  }

  const accuracy: Record<string, number> = {};
  for (const condition of conditions) {
    let correct = 0;
    let total = 0;
    for (const q of results) {
      const c = q.conditions.find((r) => r.condition === condition);
      if (c && c.answer !== null) {
        total++;
        if (c.correct) correct++;
      }
    }
    accuracy[condition] = total > 0 ? correct / total : 0;
  }

  return accuracy;
}

/**
 * Compute Net Reversal Efficiency (paper-correct internal metric).
 *
 * Compares pre-QBAF predictions (based on initial_score) vs post-QBAF
 * predictions (based on final_score) within the ARGORA condition.
 * NRE = (n_correct_from_wrong - n_wrong_from_correct) / n_disagree
 *
 * Positive NRE means the QBAF evaluation flips more wrong pre-QBAF
 * predictions to correct than correct ones to wrong.
 */
export function computeNRE(
  results: QuestionResult[],
  argoraCondition = 'argora',
): number | null {
  let nCorrectFromWrong = 0;
  let nWrongFromCorrect = 0;
  let nDisagree = 0;

  for (const q of results) {
    const argora = q.conditions.find((c) => c.condition === argoraCondition);

    if (
      !argora ||
      argora.preQbafAnswer === undefined || argora.preQbafAnswer === null ||
      argora.postQbafAnswer === undefined || argora.postQbafAnswer === null
    ) {
      continue;
    }

    if (argora.preQbafAnswer !== argora.postQbafAnswer) {
      nDisagree++;

      if (!argora.preQbafCorrect && argora.postQbafCorrect) {
        nCorrectFromWrong++;
      } else if (argora.preQbafCorrect && !argora.postQbafCorrect) {
        nWrongFromCorrect++;
      }
    }
  }

  if (nDisagree === 0) return null;
  return (nCorrectFromWrong - nWrongFromCorrect) / nDisagree;
}

/**
 * Compute Correctness Margin (paper-correct metric).
 *
 * For each question, computes mean(sigma_correct) - mean(sigma_wrong) across
 * all main arguments, where sigma is the post-QBAF final_score.
 * Then averages across all questions.
 *
 * Positive CM means ARGORA assigns higher QBAF strength to correct-answer
 * arguments than wrong-answer arguments on average.
 */
export function computeCorrectnessMargin(
  results: QuestionResult[],
  argoraCondition = 'argora',
): number | null {
  const margins: number[] = [];

  for (const q of results) {
    const argora = q.conditions.find((c) => c.condition === argoraCondition);
    if (!argora || !argora.mainArgScores || argora.mainArgScores.length === 0) continue;

    const correctScores = argora.mainArgScores
      .filter((a) => a.correct)
      .map((a) => a.finalScore);
    const wrongScores = argora.mainArgScores
      .filter((a) => !a.correct && a.answerIndex !== null)
      .map((a) => a.finalScore);

    if (correctScores.length === 0 || wrongScores.length === 0) continue;

    const meanCorrect = correctScores.reduce((a, b) => a + b, 0) / correctScores.length;
    const meanWrong = wrongScores.reduce((a, b) => a + b, 0) / wrongScores.length;
    margins.push(meanCorrect - meanWrong);
  }

  if (margins.length === 0) return null;
  return margins.reduce((a, b) => a + b, 0) / margins.length;
}

/**
 * Compute all batch metrics from question results.
 */
export function computeBatchMetrics(results: QuestionResult[]): BatchMetrics {
  const accuracy = computeAccuracy(results);
  const nre = computeNRE(results);
  const correctnessMargin = computeCorrectnessMargin(results);

  // Count questions where baseline and ARGORA disagreed
  let disagreeCount = 0;
  for (const q of results) {
    const baseline = q.conditions.find((c) => c.condition === 'direct_cot_1x');
    const argora = q.conditions.find((c) => c.condition === 'argora');
    if (
      baseline &&
      argora &&
      baseline.answer !== null &&
      argora.answer !== null &&
      baseline.answer !== argora.answer
    ) {
      disagreeCount++;
    }
  }

  return {
    accuracy,
    nre,
    correctnessMargin,
    questionCount: results.length,
    disagreeCount,
  };
}
