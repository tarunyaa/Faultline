import { spawn } from 'child_process';
import path from 'path';

const REPO_ROOT = path.resolve(process.cwd(), '..');
const ARGORA_DIR = path.join(REPO_ROOT, 'argora');

function getPythonPath(): string {
  if (process.platform === 'win32') {
    return path.join(ARGORA_DIR, '.venv', 'Scripts', 'python.exe');
  }
  return path.join(ARGORA_DIR, '.venv', 'bin', 'python');
}

export interface BaselineEvent {
  type: BaselineEventType;
  data?: unknown;
}

export type BaselineEventType =
  | 'baselines_start'
  | 'baseline_running'
  | 'baseline_result'
  | 'baselines_complete'
  | 'error';

export interface BaselineResultData {
  method: string;
  label: string;
  answer: string | null;
  reasoning: string | null;
  main_task?: string;
  token_usage?: Record<string, number>;
  error?: string;
}

export async function* runBaselines(
  topic: string,
  model = 'gpt-4o-mini',
  cotModel = 'o3',
): AsyncGenerator<BaselineEvent> {
  const pythonPath = getPythonPath();
  const bridgePath = path.join(ARGORA_DIR, 'bridge_baselines.py');

  const args = [bridgePath, '--topic', topic, '--model', model, '--cot-model', cotModel];

  const proc = spawn(pythonPath, args, {
    cwd: ARGORA_DIR,
    env: { ...process.env },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let buffer = '';
  let stderrBuffer = '';

  proc.stderr.on('data', (chunk: Buffer) => {
    stderrBuffer += chunk.toString();
  });

  const lineQueue: string[] = [];
  let resolveWait: (() => void) | null = null;
  let processEnded = false;

  proc.stdout.on('data', (chunk: Buffer) => {
    buffer += chunk.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed) {
        lineQueue.push(trimmed);
        if (resolveWait) {
          resolveWait();
          resolveWait = null;
        }
      }
    }
  });

  proc.on('close', () => {
    if (buffer.trim()) {
      lineQueue.push(buffer.trim());
    }
    processEnded = true;
    if (resolveWait) {
      resolveWait();
      resolveWait = null;
    }
  });

  while (true) {
    if (lineQueue.length > 0) {
      const line = lineQueue.shift()!;
      try {
        const event = JSON.parse(line) as BaselineEvent;
        yield event;
        if (event.type === 'baselines_complete' || event.type === 'error') {
          break;
        }
      } catch {
        // Skip non-JSON lines
        continue;
      }
    } else if (processEnded) {
      break;
    } else {
      await new Promise<void>((resolve) => {
        resolveWait = resolve;
      });
    }
  }

  if (stderrBuffer.trim() && processEnded) {
    yield {
      type: 'error',
      data: { message: 'Baseline process error', stderr: stderrBuffer.trim() },
    };
  }
}
