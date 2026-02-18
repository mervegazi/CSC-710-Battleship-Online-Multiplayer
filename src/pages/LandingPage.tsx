import { Link } from "react-router";

export function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-4 text-center">
      <h1 className="text-5xl font-extrabold tracking-tight text-slate-100 sm:text-6xl">
        Battleship{" "}
        <span className="text-blue-500">Online</span>
      </h1>

      <p className="mt-4 max-w-md text-lg text-slate-400">
        Challenge players in real-time. Place your fleet, take aim, and sink
        the enemy before they sink you.
      </p>

      <div className="mt-8 flex gap-4">
        <Link
          to="/lobby"
          className="inline-flex items-center rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
        >
          Play Now
        </Link>
        <Link
          to="/login"
          className="inline-flex items-center rounded-lg border border-slate-600 px-6 py-3 text-sm font-semibold text-slate-300 transition-colors hover:border-slate-500 hover:text-slate-100"
        >
          Sign In
        </Link>
      </div>
    </main>
  );
}
