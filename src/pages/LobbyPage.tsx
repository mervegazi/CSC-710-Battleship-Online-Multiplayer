import { useAuth } from "../hooks/useAuth";
import { Button } from "../components/common/Button";

export function LobbyPage() {
  const { user, profile, signOut } = useAuth();

  const displayName =
    profile?.display_name ??
    (user?.user_metadata as { display_name?: string })?.display_name ??
    "Player";

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch {
      // onAuthStateChange will handle state cleanup
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-16">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Lobby</h1>
          <Button variant="secondary" onClick={handleSignOut}>
            Sign Out
          </Button>
        </div>

        <p className="text-slate-300">
          Welcome, <span className="font-semibold text-blue-400">{displayName}</span>!
        </p>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-400">
          Matchmaking, tables, and chat will be built in Phase 2.
        </div>
      </div>
    </main>
  );
}
