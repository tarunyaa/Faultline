import fs from 'fs';
import path from 'path';
import { PersonaId, PersonaEvidence } from './types';

/**
 * Simple evidence store for grounding persona debates
 * MVP version: keyword matching (no embeddings required)
 * Production: add vector search with Voyage AI or OpenAI embeddings
 */
export class EvidenceStore {
  private evidence: Map<PersonaId, PersonaEvidence[]> = new Map();
  private loaded = false;

  constructor() {
    this.loadEvidence();
  }

  private loadEvidence() {
    if (this.loaded) return;

    const evidenceDir = path.join(process.cwd(), 'data', 'evidence');

    for (const persona of ['elon', 'sam', 'jensen'] as PersonaId[]) {
      const filePath = path.join(evidenceDir, `${persona}.json`);

      try {
        if (fs.existsSync(filePath)) {
          const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          this.evidence.set(persona, data);
          console.log(`✅ Loaded ${data.length} evidence items for ${persona}`);
        } else {
          this.evidence.set(persona, []);
          console.log(`⚠️  No evidence file found for ${persona} at ${filePath}`);
        }
      } catch (error) {
        console.error(`❌ Error loading evidence for ${persona}:`, error);
        this.evidence.set(persona, []);
      }
    }

    this.loaded = true;
  }

  /**
   * Retrieve relevant evidence for a persona based on context
   * MVP: simple keyword matching
   * TODO: add vector similarity search
   */
  retrieve(
    persona: PersonaId,
    context: string,
    topK: number = 5
  ): PersonaEvidence[] {
    const personaEvidence = this.evidence.get(persona) || [];

    if (personaEvidence.length === 0) {
      return [];
    }

    // Simple keyword-based relevance scoring
    const contextKeywords = this.extractKeywords(context.toLowerCase());

    const scored = personaEvidence.map((evidence) => {
      let score = 0;

      // Check text content
      const textLower = evidence.text.toLowerCase();
      for (const keyword of contextKeywords) {
        if (textLower.includes(keyword)) {
          score += 2;
        }
      }

      // Check topic tags
      for (const tag of evidence.topic_tags) {
        for (const keyword of contextKeywords) {
          if (tag.toLowerCase().includes(keyword)) {
            score += 3;
          }
        }
      }

      // Boost core beliefs
      if (evidence.is_core_belief) {
        score += 1;
      }

      // Boost high confidence items
      if (evidence.confidence === 'high') {
        score += 0.5;
      }

      return { evidence, score };
    });

    // Sort by score and return top K
    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((s) => s.evidence);
  }

  /**
   * Get all evidence for a persona
   */
  getAll(persona: PersonaId): PersonaEvidence[] {
    return this.evidence.get(persona) || [];
  }

  /**
   * Get random sample of evidence (useful for general context)
   */
  getSample(persona: PersonaId, count: number = 3): PersonaEvidence[] {
    const all = this.getAll(persona);
    if (all.length <= count) return all;

    const shuffled = [...all].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  private extractKeywords(text: string): string[] {
    // Remove common words and extract meaningful keywords
    const commonWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'is', 'was', 'are', 'were', 'be', 'been',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those',
      'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which', 'who',
      'when', 'where', 'why', 'how',
    ]);

    return text
      .split(/\s+/)
      .map((word) => word.replace(/[^\w]/g, ''))
      .filter((word) => word.length > 3 && !commonWords.has(word))
      .slice(0, 20); // limit to 20 keywords
  }
}

// Singleton instance
let storeInstance: EvidenceStore | null = null;

export function getEvidenceStore(): EvidenceStore {
  if (!storeInstance) {
    storeInstance = new EvidenceStore();
  }
  return storeInstance;
}
