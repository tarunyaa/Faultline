import SuitIcon from '@/components/SuitIcon'

export default function WhitepaperPage() {
  return (
    <div className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-3xl space-y-10">
        {/* Title */}
        <div className="space-y-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted flex items-center gap-1.5">
            <SuitIcon suit="diamond" className="text-xs" />
            Whitepaper
          </span>
          <h1 className="text-4xl font-bold tracking-tight">Cr<span className="text-accent">ux</span></h1>
          <p className="text-lg text-muted">
            Automated Insight Generation through Multi-Agent Socratic Seminar Grounded in Real Voices
          </p>
        </div>

        {/* Suit divider */}
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <SuitIcon suit="spade" className="text-xs" />
            <SuitIcon suit="heart" className="text-xs" />
            <SuitIcon suit="diamond" className="text-xs" />
            <SuitIcon suit="club" className="text-xs" />
          </div>
          <div className="flex-1 h-px bg-card-border" />
        </div>

        {/* The Problem */}
        <section className="space-y-3">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <SuitIcon suit="spade" className="text-sm" />
            The Problem
          </h2>
          <p className="text-foreground/85 leading-relaxed">
            The internet has more information than ever&mdash;but almost none of it turns into insight.
            If you want to truly understand a complex topic, you still have to do the hard part yourself:
            track the best voices across platforms, compare competing arguments, separate signal from vibes,
            and figure out what would actually change anyone{"'"}s mind. There{"'"}s no system that reliably
            converts fragmented discourse into a clear, testable takeaway.
          </p>
        </section>

        {/* What It Is */}
        <section className="space-y-3">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <SuitIcon suit="heart" className="text-sm" />
            What It Is
          </h2>
          <p className="text-foreground/85 leading-relaxed">
            Faultline is a debate room for the internet{"'"}s most influential viewpoints.
          </p>
          <p className="text-foreground/85 leading-relaxed">
            Spin up AI agents with personas modeled on specific real-world voices&mdash;and watch them
            challenge each other in a Socratic seminar. Faultline doesn{"'"}t force agreement. It distills
            the debate into the <span className="text-accent font-semibold">crux</span>: the few
            assumptions driving the split, and the <span className="text-accent font-semibold">flip
            conditions</span> or evidence that would actually change each position.
          </p>
        </section>

        {/* How It Works */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <SuitIcon suit="diamond" className="text-sm" />
            How It Works
          </h2>
          <p className="text-foreground/85 leading-relaxed">
            Each persona is an AI agent that{"'"}s trained and continuously grounded in public material
            (Twitter/X, Substack, transcripts, Wikipedia, forums) and represented as an explicit,
            inspectable profile:
          </p>
          <div className="rounded-xl border border-card-border bg-surface p-5 space-y-2">
            {[
              { label: 'personality', desc: 'voice, rhetorical habits, confidence style' },
              { label: 'bias', desc: 'priors, blind spots, recurring failure modes' },
              { label: 'stakes', desc: 'incentives, preferred outcomes, exposure' },
              { label: 'epistemology', desc: 'how they form beliefs (data / narrative / first principles)' },
              { label: 'time_horizon', desc: 'what timeframe their reasoning optimizes for' },
              { label: 'flip_conditions', desc: 'what evidence would actually change their mind' },
            ].map(({ label, desc }) => (
              <div key={label} className="flex items-start gap-2 text-sm">
                <code className="text-accent font-mono text-xs bg-accent-dim/20 px-1.5 py-0.5 rounded shrink-0 mt-0.5">
                  {label}
                </code>
                <span className="text-foreground/80">{desc}</span>
              </div>
            ))}
          </div>
          <p className="text-foreground/85 leading-relaxed">
            Agents are tool-connected, so the room can pull fresh information in real time: fetch filings,
            query price data, run calculations, inspect code, and source new posts. That means the debate
            can actually update&mdash;if new evidence hits an agent{"'"}s flip conditions, you{"'"}ll see
            them change their stance.
          </p>
          <p className="text-foreground/85 leading-relaxed">
            Users enter a topic (e.g., &ldquo;Is IREN overvalued?&rdquo;) and pick the voices they
            want&mdash;or let Faultline auto-select a balanced room. Then the personas debate in a
            structured Socratic format with toggleable styles (adversarial, cooperative, evidence-first,
            first-principles, time-horizon split) until the system can produce a clear reduction: the{' '}
            <span className="text-accent font-semibold">crux</span> and the{' '}
            <span className="text-accent font-semibold">flip conditions</span>.
          </p>
        </section>

        {/* Disagreement Map */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <SuitIcon suit="club" className="text-sm" />
            The Atomic Unit of Value: the Disagreement Map
          </h2>
          <p className="text-foreground/85 leading-relaxed">
            Faultline{"'"}s output is not &ldquo;the best answer.&rdquo; It{"'"}s a structured map of{' '}
            <span className="font-semibold">why credible perspectives diverge</span>&mdash;and what would
            resolve the disagreement.
          </p>

          <div className="rounded-xl border border-card-border bg-surface p-5 space-y-4">
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-accent">System Output</h3>
              <ul className="space-y-1 text-sm text-foreground/80">
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-0.5 shrink-0">&bull;</span>
                  No forced consensus
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-0.5 shrink-0">&bull;</span>
                  Clear sources of disagreement
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-0.5 shrink-0">&bull;</span>
                  Explicit flip conditions (what evidence would change each position)
                </li>
              </ul>
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-accent">
                Example Sources of Disagreement
              </h3>
              <ul className="space-y-1 text-sm text-foreground/80">
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-0.5 shrink-0">&bull;</span>
                  Time horizon (short-term vs long-term)
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-0.5 shrink-0">&bull;</span>
                  Assumptions about monetary debasement
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-0.5 shrink-0">&bull;</span>
                  Identity or values attachment
                </li>
              </ul>
            </div>

            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-accent">
                Example Flip Conditions
              </h3>
              <ul className="space-y-1 text-sm text-foreground/80">
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-0.5 shrink-0">&bull;</span>
                  Agent A changes view if CPI stays below X for Y months
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-0.5 shrink-0">&bull;</span>
                  Agent B changes view only if the USD regime shifts
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent mt-0.5 shrink-0">&bull;</span>
                  Agent C does not change view because the stance is identity-based
                </li>
              </ul>
            </div>
          </div>

          <p className="text-foreground/85 leading-relaxed">
            That{"'"}s insight you cannot get from a single model&mdash;because it requires multiple
            epistemologies and incentives interacting, plus a structured diagnosis of what would change
            each stance.
          </p>
        </section>

        {/* Who It's For */}
        <section className="space-y-3">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <SuitIcon suit="spade" className="text-sm" />
            Who It{"'"}s For
          </h2>
          <p className="text-foreground/85 leading-relaxed">
            People who want to understand complex topics in depth&mdash;investors, builders,
            researchers&mdash;who currently have to manually synthesize perspectives across platforms.
          </p>
        </section>

        {/* Moat */}
        <section className="space-y-3">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <SuitIcon suit="heart" className="text-sm" />
            Moat
          </h2>
          <ul className="space-y-2 text-foreground/85">
            <li className="flex items-start gap-2">
              <span className="text-accent mt-0.5 shrink-0">&bull;</span>
              High-fidelity persona-agent corpus of influential voices and community archetypes
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent mt-0.5 shrink-0">&bull;</span>
              Debate + diagnosis engine that reliably produces disagreement reductions and flip-condition
              analysis (not just summaries)
            </li>
          </ul>
        </section>
      </div>
    </div>
  )
}
