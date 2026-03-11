import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router";

const VALID_LEVELS = new Set(["easy", "medium", "hard"]);

export function BotGamePage() {
  const location = useLocation();
  const navigate = useNavigate();

  const difficulty = useMemo(() => {
    const params = new URLSearchParams(location.search);
    const level = params.get("difficulty")?.toLowerCase() ?? "easy";
    return VALID_LEVELS.has(level) ? level : "easy";
  }, [location.search]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6">
        <header className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h1 className="text-2xl font-bold">Solo Match</h1>
          <p className="mt-2 text-sm text-slate-400">
            Bot difficulty:{" "}
            <span className="font-semibold text-emerald-300">
              {difficulty[0].toUpperCase() + difficulty.slice(1)}
            </span>
          </p>
          <p className="mt-3 text-sm text-slate-400">
            Bot gameplay is not implemented yet. This page is a placeholder so
            you can wire up the lobby flow now.
          </p>
        </header>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
            Next Steps
          </h2>
          <ul className="mt-3 list-disc pl-5 text-sm text-slate-300">
            <li>Generate a bot fleet placement for the selected difficulty.</li>
            <li>Implement bot attack logic and turn handling.</li>
            <li>Persist bot matches locally or via Supabase.</li>
          </ul>
        </div>

        <button
          type="button"
          onClick={() => navigate("/lobby")}
          className="self-start rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
        >
          Return to Lobby
        </button>
      </div>
    </main>
  );
}
