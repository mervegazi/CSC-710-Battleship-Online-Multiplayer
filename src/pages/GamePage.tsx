import { useParams, Link } from "react-router";

export function GamePage() {
  const { gameId } = useParams<{ gameId: string }>();

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-16">
        <h1 className="text-3xl font-bold">Game #{gameId}</h1>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-400">
          Game board will be built in Phase 3.
        </div>

        <Link
          to="/lobby"
          className="text-sm text-blue-400 hover:text-blue-300"
        >
          Back to Lobby
        </Link>
      </div>
    </main>
  );
}
