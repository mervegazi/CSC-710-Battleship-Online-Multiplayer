import { useAuth } from "../../hooks/useAuth";
import { Button } from "../common/Button";
import { Link } from "react-router";

export function LobbyHeader() {
  const { user, profile, signOut } = useAuth();

  const displayName =
    profile?.display_name ??
    (user?.user_metadata as { display_name?: string } | undefined)
      ?.display_name ??
    "Player";

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch {
      // onAuthStateChange handles state cleanup
    }
  };

  return (
    <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-6 py-4">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold text-slate-100">Battleship</h1>
        <span className="text-sm text-slate-400">
          Welcome,{" "}
          <span className="font-semibold text-blue-400">{displayName}</span>
        </span>
      </div>
      <div className="flex items-center gap-3">
        <Link
          to="/profile"
          className="text-sm text-slate-400 transition-colors hover:text-slate-200"
        >
          Profile
        </Link>
        <Button variant="secondary" onClick={handleSignOut}>
          Sign Out
        </Button>
      </div>
    </header>
  );
}
