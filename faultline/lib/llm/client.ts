import Anthropic from '@anthropic-ai/sdk'

// ─── Models ──────────────────────────────────────────────────

const SONNET = 'claude-sonnet-4-5-20250929'
const HAIKU = 'claude-haiku-4-5-20251001'

export type ModelTier = 'sonnet' | 'haiku'

function modelId(tier: ModelTier): string {
  return tier === 'sonnet' ? SONNET : HAIKU
}

// ─── Token Tracking ──────────────────────────────────────────

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
}

let _totalUsage: TokenUsage = { inputTokens: 0, outputTokens: 0 }

export function getTotalUsage(): TokenUsage {
  return { ..._totalUsage }
}

export function resetUsage(): void {
  _totalUsage = { inputTokens: 0, outputTokens: 0 }
}

// ─── Client Singleton ────────────────────────────────────────

let _client: Anthropic | null = null

function getClient(): Anthropic {
  if (!_client) {
    _client = new Anthropic()  // reads ANTHROPIC_API_KEY from env
  }
  return _client
}

// ─── Chat Completion ─────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface CompletionOptions {
  system?: string
  messages: ChatMessage[]
  model?: ModelTier
  maxTokens?: number
  temperature?: number
}

const MAX_RETRIES = 2
const RETRY_DELAY_MS = 1000

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export interface CompletionResult {
  text: string
  truncated: boolean
}

/**
 * Send a chat completion request. Retries on transient errors.
 * Returns the raw text response.
 */
export async function complete(opts: CompletionOptions): Promise<string> {
  const result = await completeRaw(opts)
  return result.text
}

async function completeRaw(opts: CompletionOptions): Promise<CompletionResult> {
  const client = getClient()
  const tier = opts.model ?? 'sonnet'

  let lastError: unknown
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await client.messages.create({
        model: modelId(tier),
        max_tokens: opts.maxTokens ?? 4096,
        temperature: opts.temperature ?? 0.7,
        ...(opts.system ? { system: opts.system } : {}),
        messages: opts.messages,
      })

      // Track tokens
      _totalUsage.inputTokens += response.usage.input_tokens
      _totalUsage.outputTokens += response.usage.output_tokens

      // Extract text from response
      const textBlock = response.content.find(b => b.type === 'text')
      return {
        text: textBlock?.text ?? '',
        truncated: response.stop_reason === 'max_tokens',
      }
    } catch (err: unknown) {
      lastError = err
      const isRetryable =
        err instanceof Anthropic.APIError &&
        (err.status === 429 || err.status === 500 || err.status === 529)

      if (isRetryable && attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * (attempt + 1))
        continue
      }
      throw err
    }
  }

  throw lastError
}

// ─── Structured JSON Completion ──────────────────────────────

/**
 * Send a chat completion and parse the response as JSON.
 * The prompt should instruct the model to respond with valid JSON.
 * Strips markdown code fences if present.
 * Uses higher default maxTokens (8192) to avoid truncation.
 * Attempts JSON repair on truncated responses.
 */
export async function completeJSON<T>(opts: CompletionOptions): Promise<T> {
  const result = await completeRaw({
    ...opts,
    maxTokens: opts.maxTokens ?? 8192,
  })

  // Strip ```json ... ``` fences if present
  let cleaned = result.text
    .replace(/^```(?:json)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim()

  try {
    return JSON.parse(cleaned) as T
  } catch (err) {
    // If truncated, attempt to repair the JSON
    if (result.truncated) {
      const repaired = repairTruncatedJSON(cleaned)
      if (repaired) {
        return JSON.parse(repaired) as T
      }
    }
    throw err
  }
}

/**
 * Attempt to repair truncated JSON by closing open strings, arrays, and objects.
 * Returns null if repair is not possible.
 */
function repairTruncatedJSON(json: string): string | null {
  try {
    // If it's already valid, return as-is
    JSON.parse(json)
    return json
  } catch {
    // continue to repair
  }

  let repaired = json

  // If we're inside an unterminated string, close it
  // Count unescaped quotes to determine if we're inside a string
  let inString = false
  for (let i = 0; i < repaired.length; i++) {
    if (repaired[i] === '\\') { i++; continue }
    if (repaired[i] === '"') inString = !inString
  }
  if (inString) {
    repaired += '"'
  }

  // Close any unclosed brackets/braces
  const stack: string[] = []
  inString = false
  for (let i = 0; i < repaired.length; i++) {
    if (repaired[i] === '\\' && inString) { i++; continue }
    if (repaired[i] === '"') { inString = !inString; continue }
    if (inString) continue
    if (repaired[i] === '{') stack.push('}')
    else if (repaired[i] === '[') stack.push(']')
    else if (repaired[i] === '}' || repaired[i] === ']') stack.pop()
  }

  // Remove trailing comma before closing
  repaired = repaired.replace(/,\s*$/, '')

  // Close in reverse order
  while (stack.length > 0) {
    repaired += stack.pop()
  }

  try {
    JSON.parse(repaired)
    return repaired
  } catch {
    return null
  }
}
