import { notFound } from 'next/navigation';
import { PERSONAS, PERSONA_ORDER, PersonaId } from '@/lib/types';
import { loadPersonaProfile } from '@/lib/persona-data';
import CardDetailClient from './CardDetailClient';

interface Props {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return PERSONA_ORDER.map((id) => ({ slug: id }));
}

export default async function CardDetailPage({ params }: Props) {
  const { slug } = await params;

  if (!PERSONA_ORDER.includes(slug as PersonaId)) {
    notFound();
  }

  const personaId = slug as PersonaId;
  const persona = PERSONAS[personaId];
  const sections = loadPersonaProfile(personaId);

  return <CardDetailClient persona={persona} sections={sections} />;
}
