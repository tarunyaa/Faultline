import Link from "next/link";
import { getDecks, getPersonas } from "@/lib/personas/loader";
import PersonaCard from "@/components/PersonaCard";

export default async function CardsPage() {
  const [decks, personas] = await Promise.all([getDecks(), getPersonas()]);
  const personaMap = new Map(personas.map((p) => [p.id, p]));

  return (
    <div className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Decks</h1>
          <Link href="/" className="text-muted hover:text-foreground text-sm">
            &larr; Lobby
          </Link>
        </div>
        <p className="text-muted">
          Browse decks and persona cards. Click a persona to view their contract.
        </p>

        {decks.map((deck) => (
          <div key={deck.id} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">{deck.name}</h2>
              <span className="text-muted text-sm">
                {deck.personaIds.length} personas
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
                  />
                );
              })}
            </div>
          </div>
        ))}

        <div className="pt-4">
          <Link
            href="/setup"
            className="inline-block rounded-full bg-accent px-8 py-3 text-sm font-semibold text-black transition-colors hover:bg-accent/80"
          >
            Build a Hand &rarr;
          </Link>
        </div>
      </div>
    </div>
  );
}
