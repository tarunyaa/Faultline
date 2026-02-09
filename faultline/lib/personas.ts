import fs from 'fs';
import path from 'path';
import {
  PersonaId,
  PERSONAS,
  Message,
  InterjectionReason,
  PersonaEvidence,
} from './types';

const PERSONA_FILES = [
  'personality',
  'bias',
  'stakes',
  'epistemology',
  'time_horizon',
  'flip_conditions',
  'rules',
] as const;

interface PersonaProfile {
  personality: string;
  bias: string;
  stakes: string;
  epistemology: string;
  time_horizon: string;
  flip_conditions: string;
  rules: string;
}

function loadPersonaFiles(personaId: PersonaId): PersonaProfile {
  const personaDir = path.join(process.cwd(), 'personas', personaId);
  const profile: Record<string, string> = {};

  for (const file of PERSONA_FILES) {
    const filePath = path.join(personaDir, `${file}.md`);
    try {
      profile[file] = fs.readFileSync(filePath, 'utf-8');
    } catch {
      profile[file] = '';
    }
  }

  return profile as unknown as PersonaProfile;
}

/**
 * Builds the system prompt — the agent's identity. Same every turn.
 */
export function buildSystemPrompt(
  personaId: PersonaId,
  topic: string,
  relevantEvidence?: PersonaEvidence[]
): string {
  const persona = PERSONAS[personaId];
  const profile = loadPersonaFiles(personaId);

  const evidenceSection =
    relevantEvidence && relevantEvidence.length > 0
      ? `\n## GROUNDING EVIDENCE\n${relevantEvidence
          .map(
            (e, i) =>
              `[${i}] "${e.text}" [Source: ${e.source_type}, ${e.date}]`
          )
          .join('\n\n')}\n`
      : '';

  return `You are ${persona.name}, ${persona.title}. You're in a live, fast-paced Socratic debate about: "${topic}"

## YOUR VOICE
${profile.personality}

## YOUR BIASES
${profile.bias}

## YOUR STAKES
${profile.stakes}

## HOW YOU THINK
${profile.epistemology}

## YOUR TIME HORIZON
${profile.time_horizon}

## YOUR FLIP CONDITIONS
${profile.flip_conditions}

## RULES
${profile.rules}
${evidenceSection}
## RESPONSE FORMAT
- 1-2 sentences MAX. This is a fast-paced conversation, not a lecture.
- No preamble. No "Great point." No "I appreciate your perspective." Just talk.
- Talk like you actually talk — punchy, opinionated, specific, in character.
- Reference your known positions naturally: "I've said before that..." or "Look at the numbers —"
- When you truly won't budge after being challenged, add on its own line:
  FLIP_CONDITION: I would change my mind if [specific, testable condition]
- NEVER repeat yourself. If you already made a point, build on it or pivot.`;
}

/**
 * Opening: agent states their position cold.
 */
export function buildOpeningMessage(topic: string): string {
  return `Topic: "${topic}"\n\nState your opening position. 1-2 punchy sentences. No pleasantries — just your take.`;
}

/**
 * Strip FLIP_CONDITION lines from message content so agents don't echo them.
 */
function cleanContent(content: string): string {
  return content
    .split('\n')
    .filter((line) => !line.startsWith('FLIP_CONDITION:'))
    .join('\n')
    .trim();
}

function formatRecentMessages(messages: Message[]): string {
  return messages
    .map((m) => `[${PERSONAS[m.agent].name}]: ${cleanContent(m.content)}`)
    .join('\n');
}

/**
 * Debate turn: agent responds to a specific message with a specific reason.
 */
export function buildDebateTurnMessage(
  reason: InterjectionReason,
  lastMessage: Message,
  recentMessages: Message[],
  moderatorNote?: string
): string {
  const replyToName = PERSONAS[lastMessage.agent].name;
  const recent = formatRecentMessages(recentMessages.slice(-5));

  const reasonPrompts: Record<InterjectionReason, string> = {
    OBJECTION: `You strongly disagree with what ${replyToName} just said. Push back hard.`,
    COUNTER: `You have a counterargument to ${replyToName}'s point. Make it sharp.`,
    EVIDENCE: `You have evidence that challenges what ${replyToName} said. Hit them with specifics.`,
    CHALLENGE: `${replyToName} made a claim you want to challenge. Call it out.`,
    CONCEDE: `${replyToName} made a fair point, but you have a crucial nuance they're missing.`,
    REDIRECT: `The debate is missing something important. Redirect it.`,
  };

  const moderatorLine = moderatorNote
    ? `\n\n[Moderator note: ${moderatorNote}]`
    : '';

  return `Recent exchange:\n${recent}\n\n${reasonPrompts[reason]}\n1-2 sentences. Be direct.${moderatorLine}`;
}

/**
 * Closing: final position + flip condition.
 */
export function buildClosingMessage(
  messages: Message[],
  flipConditionsFound: number
): string {
  const summary = formatRecentMessages(messages.slice(-6));

  return `Debate summary (recent):\n${summary}\n\nFinal statement. One sentence on your position. Then state your flip condition on its own line:\nFLIP_CONDITION: I would change my mind if [specific, testable condition]\n\n${
    flipConditionsFound === 0
      ? 'No flip conditions have been stated yet — make sure to include yours.'
      : ''
  }`;
}
