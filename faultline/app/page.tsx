import Link from "next/link";

export default function LobbyPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="text-center space-y-6 max-w-lg">
        <h1 className="text-5xl font-bold tracking-tight">
          Fault<span className="text-accent">line</span>
        </h1>
        <p className="text-muted text-lg">
          AI debate engine — find where minds diverge
        </p>
        <Link
          href="/cards"
          className="inline-block rounded-full bg-accent px-8 py-3 text-sm font-semibold text-black transition-colors hover:bg-accent/80"
        >
          Enter the Room
        </Link>
      </div>
    </div>
  );
}
