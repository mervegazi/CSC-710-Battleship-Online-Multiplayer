import { Link } from "react-router";
import { useAuth } from "../hooks/useAuth";

export function ProfilePage() {
  const { user, profile } = useAuth();

  const displayName =
    profile?.display_name ??
    (user?.user_metadata as { display_name?: string })?.display_name ??
    "Player";

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-md flex-col gap-6 px-6 py-16">
        <h1 className="text-3xl font-bold">Profile</h1>

        <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
          <dl className="flex flex-col gap-4">
            <div>
              <dt className="text-xs uppercase text-slate-500">Display Name</dt>
              <dd className="text-lg font-semibold">{displayName}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500">Email</dt>
              <dd className="text-slate-300">{profile?.email ?? user?.email}</dd>
            </div>
            {profile && (
              <>
                <div>
                  <dt className="text-xs uppercase text-slate-500">Games Played</dt>
                  <dd>{profile.total_games}</dd>
                </div>
                <div className="flex gap-8">
                  <div>
                    <dt className="text-xs uppercase text-slate-500">Wins</dt>
                    <dd className="text-green-400">{profile.wins}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase text-slate-500">Losses</dt>
                    <dd className="text-red-400">{profile.losses}</dd>
                  </div>
                </div>
              </>
            )}
          </dl>
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
