import fs from 'fs';
import path from 'path';
import { PersonaId } from './types';

const PROFILE_SECTIONS = [
  { key: 'personality', label: 'Voice' },
  { key: 'bias', label: 'Bias' },
  { key: 'stakes', label: 'Stakes' },
  { key: 'epistemology', label: 'Epistemology' },
  { key: 'time_horizon', label: 'Horizon' },
  { key: 'flip_conditions', label: 'Flip Conditions' },
] as const;

export type ProfileSection = {
  key: string;
  label: string;
  content: string;
};

export function loadPersonaProfile(personaId: PersonaId): ProfileSection[] {
  const personaDir = path.join(process.cwd(), 'personas', personaId);

  return PROFILE_SECTIONS.map(({ key, label }) => {
    const filePath = path.join(personaDir, `${key}.md`);
    let content = '';
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch {
      content = '_No data available._';
    }
    return { key, label, content };
  });
}

export { PROFILE_SECTIONS };
