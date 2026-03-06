/**
 * persona-builder/pipeline.ts
 *
 * Reusable pipeline functions for corpus fetching and contract generation.
 * Used by both the API route (create-persona) and the CLI script (build-personas).
 */

import { TwitterApi } from 'twitter-api-v2'
import Anthropic from '@anthropic-ai/sdk'
import RSSParser from 'rss-parser'

// ─── Types ───────────────────────────────────────────────────

export interface RawTweet {
  id: string
  text: string
  created_at: string
  public_metrics?: {
    like_count: number
    retweet_count: number
    reply_count: number
  }
}

export interface RawSubstackPost {
  title: string
  content: string
  url: string
  date: string
}

export interface CorpusEntry {
  id: string
  content: string
  source: string
  date: string
  platform: 'twitter' | 'substack'
  metrics?: {
    likes: number
    retweets: number
    replies: number
  }
}

export interface EvidencePolicy {
  acceptableSources: string[]
  unacceptableSources: string[]
  weightingRules: string
  toolPullTriggers: string
}

export interface AnchorExcerpt {
  id: string
  content: string
  source: string
  date: string
}

// ─── Constants ───────────────────────────────────────────────

export const MODEL = 'claude-sonnet-4-5-20250929'

export const CONTRACT_FIELDS = [
  'personality',
  'bias',
  'stakes',
  'epistemology',
  'timeHorizon',
  'flipConditions',
] as const

const FIELD_PROMPTS: Record<(typeof CONTRACT_FIELDS)[number], string> = {
  personality: `Analyze this person's communication style, rhetorical patterns, and personality traits.
Write 3-5 sentences describing their personality as it relates to debate and public discourse.
Include: tone (aggressive, measured, humorous?), rhetorical devices they favor, how they handle disagreement, their default emotional register.
Be specific — cite patterns you observe in their content.`,

  bias: `Analyze this person's biases and blind spots.
Write 3-5 sentences covering: ideological leanings, industry biases, confirmation bias patterns, topics they systematically avoid or dismiss, assumptions they treat as axioms.
Be specific and evidence-based — don't just list generic biases.`,

  stakes: `Analyze what this person has at stake in public discourse.
Write 3-5 sentences covering: financial interests, reputation concerns, organizational pressures, personal brand maintenance, what they gain or lose by taking various positions.
Be specific about their actual incentive structure.`,

  epistemology: `Analyze how this person evaluates truth and evidence.
Write 3-5 sentences covering: what they consider valid evidence, how they weigh different sources, their relationship with data vs. intuition, how they handle uncertainty, what constitutes proof in their worldview.
Be specific — note patterns in how they argue.`,

  timeHorizon: `Analyze this person's default time horizon for thinking about issues.
Write 3-5 sentences covering: do they think in quarters, years, decades, or centuries? How does this affect their arguments? Do they discount future risks? Are they focused on immediate execution or long-term vision?
Be specific about their temporal framing patterns.`,

  flipConditions: `Analyze what would make this person change their mind.
Write 3-5 sentences describing: specific types of evidence that would shift their position, conditions under which they'd reverse course, historical examples of them changing their mind (if any), what arguments they're most vulnerable to.
Be concrete — describe actual scenarios, not abstractions.`,
}

// ─── Helpers ─────────────────────────────────────────────────

export function extractJSON(text: string): string {
  const blockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
  if (blockMatch) return blockMatch[1].trim()
  const jsonMatch = text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/)
  if (jsonMatch) return jsonMatch[1].trim()
  return text.trim()
}

async function callClaude(
  client: Anthropic,
  systemPrompt: string,
  userPrompt: string,
  retries = 1
): Promise<string> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      })
      const block = response.content[0]
      if (block.type === 'text') return block.text
      throw new Error('Unexpected response type: ' + block.type)
    } catch (err) {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 2000))
        continue
      }
      throw err
    }
  }
  throw new Error('Unreachable')
}

// ─── Twitter ─────────────────────────────────────────────────

export async function fetchTwitterProfile(
  client: TwitterApi,
  handle: string
): Promise<{ id: string; name: string; profileImageUrl: string }> {
  const user = await client.v2.userByUsername(handle, {
    'user.fields': ['profile_image_url', 'name'],
  })
  if (!user.data) throw new Error(`Twitter user not found: @${handle}`)
  return {
    id: user.data.id,
    name: user.data.name,
    profileImageUrl: (user.data.profile_image_url ?? '').replace('_normal', '_400x400'),
  }
}

export async function fetchTweets(
  client: TwitterApi,
  userId: string,
  maxTweets: number
): Promise<RawTweet[]> {
  const tweets: RawTweet[] = []
  const paginator = await client.v2.userTimeline(userId, {
    max_results: Math.min(maxTweets, 100),
    'tweet.fields': ['created_at', 'public_metrics'],
    exclude: ['retweets'],
  })
  for await (const tweet of paginator) {
    tweets.push({
      id: tweet.id,
      text: tweet.text,
      created_at: tweet.created_at ?? new Date().toISOString(),
      public_metrics: tweet.public_metrics
        ? {
            like_count: tweet.public_metrics.like_count,
            retweet_count: tweet.public_metrics.retweet_count,
            reply_count: tweet.public_metrics.reply_count,
          }
        : undefined,
    })
    if (tweets.length >= maxTweets) break
  }
  return tweets
}

// ─── Substack ────────────────────────────────────────────────

export async function fetchSubstackPosts(
  substackUrl: string,
  maxPosts: number
): Promise<RawSubstackPost[]> {
  const parser = new RSSParser()
  const feedUrl = substackUrl.replace(/\/$/, '') + '/feed'
  const feed = await parser.parseURL(feedUrl)
  const posts: RawSubstackPost[] = []
  for (const item of feed.items.slice(0, maxPosts)) {
    const plainText = (item['content:encoded'] ?? item.content ?? '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 2000)
    posts.push({
      title: item.title ?? 'Untitled',
      content: plainText,
      url: item.link ?? '',
      date: item.isoDate ?? item.pubDate ?? new Date().toISOString(),
    })
  }
  return posts
}

// ─── Content Processing ──────────────────────────────────────

export function buildCorpusText(
  tweets: RawTweet[],
  substackPosts: RawSubstackPost[],
  twitterHandle: string | null
): string {
  const parts: string[] = []
  if (tweets.length > 0) {
    parts.push('=== TWEETS ===')
    tweets.forEach((t, i) => {
      const metrics = t.public_metrics
        ? ` [${t.public_metrics.like_count} likes, ${t.public_metrics.retweet_count} RTs]`
        : ''
      parts.push(`[T${i}] (${t.created_at})${metrics}\n${t.text}`)
    })
  }
  if (substackPosts.length > 0) {
    parts.push('\n=== SUBSTACK POSTS ===')
    substackPosts.forEach((p, i) => {
      parts.push(`[S${i}] "${p.title}" (${p.date})\n${p.content}`)
    })
  }
  return parts.join('\n\n')
}

export async function filterContent(
  claude: Anthropic,
  corpusText: string,
  topic: string,
  tweetCount: number,
  postCount: number
): Promise<{ tweetIndices: number[]; postIndices: number[] }> {
  const result = await callClaude(
    claude,
    `You are a content analyst. Identify the most relevant, opinionated, and substantive content for a debate topic. Filter out noise like shitposts, off-topic content, simple retweet-bait, and promotional content.`,
    `The debate topic is: "${topic}"

Below is a corpus of content from a public figure. Identify the most relevant and opinionated items for this debate topic.

Return a JSON object with two arrays:
- "tweetIndices": indices of the most relevant tweets (T0, T1, etc.) — pick up to 50
- "postIndices": indices of the most relevant Substack posts (S0, S1, etc.) — pick up to 10

Only include items that show clear opinions, arguments, or positions relevant to the topic.

${corpusText}

Return ONLY the JSON object, no other text.`
  )

  const parsed = JSON.parse(extractJSON(result)) as {
    tweetIndices?: (number | string)[]
    postIndices?: (number | string)[]
  }

  const parseIndices = (raw: (number | string)[], prefix: string, max: number): number[] =>
    raw
      .map(v => {
        if (typeof v === 'number') return v
        return parseInt(String(v).replace(new RegExp(`^${prefix}`, 'i'), ''), 10)
      })
      .filter(i => !isNaN(i) && i >= 0 && i < max)

  return {
    tweetIndices: parseIndices(parsed.tweetIndices ?? [], 'T', tweetCount),
    postIndices: parseIndices(parsed.postIndices ?? [], 'S', postCount),
  }
}

// ─── Contract Generation ─────────────────────────────────────

export async function generateContractField(
  claude: Anthropic,
  field: (typeof CONTRACT_FIELDS)[number],
  filteredCorpus: string,
  personaName: string,
  topic: string
): Promise<string> {
  return callClaude(
    claude,
    `You are a persona analyst building a debate simulation profile for ${personaName}. The debate topic is: "${topic}". Base your analysis ONLY on the provided content — do not invent details.`,
    `${FIELD_PROMPTS[field]}

Here is the content to analyze:

${filteredCorpus}

Write your analysis now. Do NOT use markdown headers or bullet points — write flowing prose paragraphs.`
  )
}

export async function generateEvidencePolicy(
  claude: Anthropic,
  filteredCorpus: string,
  personaName: string,
  topic: string
): Promise<EvidencePolicy> {
  const result = await callClaude(
    claude,
    `You are a persona analyst. Based on the provided content from ${personaName}, infer their evidence policy for the debate topic: "${topic}".`,
    `Analyze the content below and return a JSON object matching this exact schema:
{
  "acceptableSources": ["list of source types this person would cite or trust"],
  "unacceptableSources": ["list of source types this person would dismiss or reject"],
  "weightingRules": "1-2 sentences on how they prioritize different types of evidence",
  "toolPullTriggers": "1-2 sentences on what kinds of claims would make them want to look up data or cite sources"
}

Content:
${filteredCorpus}

Return ONLY the JSON object, no other text.`
  )
  return JSON.parse(extractJSON(result)) as EvidencePolicy
}

export async function selectAnchorExcerpts(
  claude: Anthropic,
  tweets: RawTweet[],
  substackPosts: RawSubstackPost[],
  filteredTweetIndices: number[],
  filteredPostIndices: number[],
  twitterHandle: string | null,
  personaName: string,
  topic: string,
  maxExcerpts: number
): Promise<AnchorExcerpt[]> {
  const contentList: string[] = []
  const sourceMap: { type: 'tweet' | 'substack'; index: number }[] = []

  filteredTweetIndices.forEach(i => {
    const t = tweets[i]
    if (!t) return
    contentList.push(`[${contentList.length}] TWEET (${t.created_at}): ${t.text}`)
    sourceMap.push({ type: 'tweet', index: i })
  })

  filteredPostIndices.forEach(i => {
    const p = substackPosts[i]
    if (!p) return
    contentList.push(
      `[${contentList.length}] SUBSTACK "${p.title}" (${p.date}): ${p.content.slice(0, 500)}`
    )
    sourceMap.push({ type: 'substack', index: i })
  })

  const result = await callClaude(
    claude,
    `You are selecting the most representative and quotable excerpts from ${personaName}'s content for a debate simulation about: "${topic}".`,
    `From the content below, select the ${maxExcerpts} most representative, quotable, and debate-relevant excerpts.

For each selected item, return a JSON array of objects:
[
  {
    "index": <number>,
    "quote": "<the exact quote or key excerpt to use, max 280 chars>"
  }
]

Content:
${contentList.join('\n\n')}

Return ONLY the JSON array, no other text.`
  )

  const selections = JSON.parse(extractJSON(result)) as { index: number; quote: string }[]

  return selections.map((sel, i) => {
    const src = sourceMap[sel.index]
    if (!src) {
      return { id: `anchor-${i}`, content: sel.quote, source: 'Unknown', date: new Date().toISOString() }
    }
    if (src.type === 'tweet') {
      const tweet = tweets[src.index]
      return {
        id: `anchor-${i}`,
        content: sel.quote,
        source: twitterHandle
          ? `https://x.com/${twitterHandle}/status/${tweet.id}`
          : `Tweet ${tweet.id}`,
        date: tweet.created_at,
      }
    } else {
      const post = substackPosts[src.index]
      return {
        id: `anchor-${i}`,
        content: sel.quote,
        source: post.url || post.title,
        date: post.date,
      }
    }
  })
}

// ─── Corpus Builder ──────────────────────────────────────────

export function buildCorpusEntries(
  tweets: RawTweet[],
  substackPosts: RawSubstackPost[],
  twitterHandle: string | null
): CorpusEntry[] {
  const corpus: CorpusEntry[] = []
  tweets.forEach(t => {
    corpus.push({
      id: `tweet-${t.id}`,
      content: t.text,
      source: twitterHandle
        ? `https://x.com/${twitterHandle}/status/${t.id}`
        : `Tweet ${t.id}`,
      date: t.created_at,
      platform: 'twitter',
      metrics: t.public_metrics
        ? {
            likes: t.public_metrics.like_count,
            retweets: t.public_metrics.retweet_count,
            replies: t.public_metrics.reply_count,
          }
        : undefined,
    })
  })
  substackPosts.forEach((p, i) => {
    corpus.push({
      id: `substack-${i}`,
      content: p.content,
      source: p.url,
      date: p.date,
      platform: 'substack',
    })
  })
  return corpus
}
