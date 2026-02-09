import Link from "next/link";
import { getDecks, getPersonas, loadContract } from "@/lib/personas/loader";
import SetupClient from "@/components/SetupClient";

export default async function SetupPage() {
  const [decks, personas] = await Promise.all([getDecks(), getPersonas()]);

  // Check contract availability for each persona
  const personaInfos = await Promise.all(
    personas.map(async (p) => {
      let hasContract = false;
      try {
        await loadContract(p.id);
        hasContract = true;
      } catch {
        // no contract
      }
      return {
        id: p.id,
        name: p.name,
        handle: p.twitterHandle,
        picture: p.twitterPicture,
        hasContract,
      };
    })
  );

  const deckInfos = decks.map((d) => ({
    id: d.id,
    name: d.name,
    personaIds: d.personaIds,
  }));

  return (
    <div className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Build Your Hand</h1>
          <Link href="/cards" className="text-muted hover:text-foreground text-sm">
            &larr; Cards
          </Link>
        </div>

        <SetupClient decks={deckInfos} personas={personaInfos} />
      </div>
    </div>
  );
}
