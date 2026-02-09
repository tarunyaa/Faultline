#!/usr/bin/env tsx

/**
 * Build evidence store from raw source files
 *
 * Usage: npx tsx scripts/build-evidence.ts
 *
 * Reads data/sources/{persona}-raw.txt files and generates
 * data/evidence/{persona}.json files with structured evidence
 */

import fs from 'fs';
import path from 'path';
import { PersonaId, PersonaEvidence } from '../lib/types';

interface RawExcerpt {
  source: string;
  url: string;
  date: string;
  tags: string;
  text: string;
}

function parseRawFile(filepath: string): RawExcerpt[] {
  const content = fs.readFileSync(filepath, 'utf-8');
  const excerpts: RawExcerpt[] = [];

  // Split by triple dashes
  const sections = content.split(/\n---\n/);

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i].trim();

    // Skip comments and empty sections
    if (!section || section.startsWith('#')) continue;

    // Check if this section has metadata
    if (section.includes('source:') && section.includes('url:')) {
      const lines = section.split('\n');
      let source = '';
      let url = '';
      let date = '';
      let tags = '';

      for (const line of lines) {
        if (line.startsWith('source:')) source = line.replace('source:', '').trim();
        else if (line.startsWith('url:')) url = line.replace('url:', '').trim();
        else if (line.startsWith('date:')) date = line.replace('date:', '').trim();
        else if (line.startsWith('tags:')) tags = line.replace('tags:', '').trim();
      }

      // The text is in the NEXT section
      const text = i + 1 < sections.length ? sections[i + 1].trim() : '';

      if (source && url && date && text && !text.startsWith('source:')) {
        excerpts.push({ source, url, date, tags, text });
      }
    }
  }

  return excerpts;
}

function buildEvidenceStore(persona: PersonaId) {
  const rawPath = path.join(process.cwd(), 'data', 'sources', `${persona}-raw.txt`);
  const outputPath = path.join(process.cwd(), 'data', 'evidence', `${persona}.json`);

  console.log(`\n📖 Building evidence store for ${persona}...`);

  if (!fs.existsSync(rawPath)) {
    console.error(`❌ Raw file not found: ${rawPath}`);
    return;
  }

  const rawExcerpts = parseRawFile(rawPath);

  if (rawExcerpts.length === 0) {
    console.warn(`⚠️  No excerpts found in ${rawPath}`);
    return;
  }

  const evidence: PersonaEvidence[] = rawExcerpts.map((excerpt, index) => {
    // Determine type based on content/tags
    let type: 'anchor_quote' | 'signature_take' | 'disallowed_move' = 'anchor_quote';

    // Simple heuristic: if it's a strong claim or repeated theme, mark as signature take
    if (excerpt.text.includes('I think') || excerpt.text.includes('will be') || excerpt.text.includes('need to')) {
      type = 'signature_take';
    }

    // Parse tags
    const topicTags = excerpt.tags
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    // Determine confidence (simple heuristic)
    let confidence: 'high' | 'medium' | 'low' = 'high';
    if (excerpt.text.includes('probably') || excerpt.text.includes('maybe') || excerpt.text.includes('I think')) {
      confidence = 'medium';
    }

    // Check if it's a core belief (keywords: "need to", "must", "fundamental", etc.)
    const isCoreBelie = /\b(need to|must|fundamental|core|essential|critical)\b/i.test(excerpt.text);

    return {
      id: `${persona}-${index}`,
      persona,
      type,
      text: excerpt.text,
      source_url: excerpt.url,
      source_type: excerpt.source as any,
      date: excerpt.date,
      topic_tags: topicTags,
      confidence,
      is_core_belief: isCoreBelie,
    };
  });

  // Ensure output directory exists
  const evidenceDir = path.dirname(outputPath);
  if (!fs.existsSync(evidenceDir)) {
    fs.mkdirSync(evidenceDir, { recursive: true });
  }

  // Write JSON
  fs.writeFileSync(outputPath, JSON.stringify(evidence, null, 2));

  console.log(`✅ Built evidence store for ${persona}`);
  console.log(`   ${evidence.length} excerpts`);
  console.log(`   → ${outputPath}`);
}

// Main
const personas: PersonaId[] = ['elon', 'sam', 'jensen'];

console.log('🔨 Building Evidence Store\n');
console.log('This will parse data/sources/{persona}-raw.txt files');
console.log('and generate data/evidence/{persona}.json files.\n');

for (const persona of personas) {
  buildEvidenceStore(persona);
}

console.log('\n✅ Evidence store build complete!');
console.log('\nNext steps:');
console.log('1. Review the generated JSON files in data/evidence/');
console.log('2. Add more excerpts to data/sources/{persona}-raw.txt files');
console.log('3. Re-run this script to rebuild the evidence store');
console.log('4. The debate orchestrator will automatically use these for grounding');
