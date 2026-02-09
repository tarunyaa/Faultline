import Link from "next/link";
import Image from "next/image";
import { getPersona, loadContract } from "@/lib/personas/loader";
import { notFound } from "next/navigation";
import type { PersonaContract } from "@/lib/types";

interface CardDetailPageProps {
  params: Promise<{ id: string }>;
}

function firstSentence(text: string): string {
  const match = text.match(/^.+?[.!?](?:\s|$)/);
  return match ? match[0].trim() : text.slice(0, 120) + (text.length > 120 ? "..." : "");
}

const DIMENSIONS: { key: keyof PersonaContract; label: string }[] = [
  { key: "personality", label: "Personality" },
  { key: "bias", label: "Bias & Blind Spots" },
  { key: "stakes", label: "Stakes & Incentives" },
  { key: "epistemology", label: "Epistemology" },
  { key: "timeHorizon", label: "Time Horizon" },
  { key: "flipConditions", label: "Flip Conditions" },
];

export default async function CardDetailPage({ params }: CardDetailPageProps) {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);
  const persona = await getPersona(decodedId);

  if (!persona) {
    notFound();
  }

  let contract: PersonaContract | null = null;
  try {
    contract = await loadContract(decodedId);
  } catch {
    // Contract not available
  }

  return (
    <div className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-2xl space-y-8">
        <Link href="/cards" className="text-muted hover:text-foreground text-sm">
          &larr; Back to Cards
        </Link>

        <div className="rounded-xl border border-card-border bg-card-bg p-8 space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            {persona.twitterPicture ? (
              <Image
                src={persona.twitterPicture}
                alt={persona.name}
                width={64}
                height={64}
                className="rounded-full"
                unoptimized
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-card-border flex items-center justify-center text-muted text-2xl font-bold">
                {persona.name.charAt(0)}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold">{persona.name}</h1>
              {persona.twitterHandle && (
                <p className="text-muted text-sm">{persona.twitterHandle}</p>
              )}
            </div>
          </div>

          {/* Contract dimensions */}
          {contract ? (
            <div className="space-y-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
                Contract Dimensions
              </h2>
              {DIMENSIONS.map(({ key, label }) => {
                const value = contract[key];
                if (typeof value !== "string") return null;
                return (
                  <div key={key} className="space-y-1">
                    <h3 className="text-sm font-medium text-accent">{label}</h3>
                    <p className="text-sm text-foreground/80">
                      {firstSentence(value)}
                    </p>
                  </div>
                );
              })}

              {/* Anchor excerpts */}
              {contract.anchorExcerpts.length > 0 && (
                <div className="space-y-2 pt-2">
                  <h3 className="text-sm font-medium text-accent">
                    Anchor Quotes ({contract.anchorExcerpts.length})
                  </h3>
                  {contract.anchorExcerpts.slice(0, 3).map((excerpt) => (
                    <blockquote
                      key={excerpt.id}
                      className="border-l-2 border-muted pl-3 text-sm text-foreground/70 italic"
                    >
                      &ldquo;{excerpt.content.slice(0, 150)}
                      {excerpt.content.length > 150 ? "..." : ""}&rdquo;
                      <span className="block text-xs text-muted mt-1 not-italic">
                        — {excerpt.source}
                      </span>
                    </blockquote>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted text-sm">
              No contract data available for this persona.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
