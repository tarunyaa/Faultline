import Link from "next/link";
import { getDecks, getPersonas } from "@/lib/personas/loader";
import PersonaCard from "@/components/PersonaCard";
import SuitIcon from "@/components/SuitIcon";

export default async function CardsPage() {
  const [decks, personas] = await Promise.all([getDecks(), getPersonas()]);
  const personaMap = new Map(personas.map((p) => [p.id, p]));

  const suitOrder = ['spade', 'heart', 'diamond', 'club'] as const;

  return (
    <div className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-5xl space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="uppercase tracking-wider text-sm text-muted block mb-1">Browse</span>
            Decks
          </h1>
        </div>

        {/* Suit divider */}
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            {suitOrder.map((s) => (
              <SuitIcon key={s} suit={s} className="text-xs" />
            ))}
          </div>
          <div className="flex-1 h-px bg-card-border" />
        </div>

        <p className="text-muted text-sm">
          Browse decks and persona cards. Click a persona to view their contract.
        </p>

        {decks.map((deck, deckIdx) => (
          <div key={deck.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <SuitIcon suit={suitOrder[deckIdx % 4]} className="text-sm" />
                <h2 className="text-base font-semibold">{deck.name}</h2>
              </div>
              <span className="text-muted text-xs">
                {deck.personaIds.length} personas
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {deck.personaIds.map((pid) => {
                const persona = personaMap.get(pid);
                if (!persona) {
                  return (
                    <PersonaCard
                      key={pid}
                      id={pid}
                      name={pid}
                      handle=""
                      picture=""
                      locked
                      compact
                    />
                  );
                }
                return (
                  <PersonaCard
                    key={pid}
                    id={persona.id}
                    name={persona.name}
                    handle={persona.twitterHandle}
                    picture={persona.twitterPicture}
                    compact
                  />
                );
              })}
            </div>
          </div>
        ))}

        <div className="pt-4">
          <Link
            href="/setup"
            className="inline-block rounded-full bg-accent px-8 py-3 text-sm font-semibold text-white transition-all hover:bg-accent/90 hover:shadow-[0_0_20px_rgba(220,38,38,0.3)]"
          >
            Build a Hand &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
