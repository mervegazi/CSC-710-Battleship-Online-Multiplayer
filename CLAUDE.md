# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Real-time browser-based multiplayer Battleship game for CSC 710 (Software Engineering). Players authenticate, join a lobby, find opponents via FIFO matchmaking or custom tables, place ships on a 10x10 grid, and battle in turn-based combat. All backend services (auth, database, realtime WebSocket) are provided by Supabase — there is no custom backend server.

The full design spec lives in `CSC710_Battleship_Technical_Document.md` at the repo root. It covers database schema (Section 6), realtime channel architecture (Section 11), component tree (Section 12), type definitions (Section 13.2), and the planned file structure (Section 12.3).

## Commands

```bash
npm install          # install dependencies
npm run dev          # start Vite dev server → http://localhost:5173/CSC-710-Battleship-Online-Multiplayer/
npm run build        # tsc -b && vite build → outputs to dist/
npm run preview      # preview production build locally
npx tsc --noEmit     # type-check without emitting
```

No linting or testing frameworks are configured yet. When adding them, use `vitest` for tests and `eslint` for linting (consistent with the Vite ecosystem).

## Environment Variables

Copy `.env.example` to `.env` (or `.env.local`) and fill in:

```
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key
```

**Important:** The codebase uses `VITE_SUPABASE_PUBLISHABLE_KEY` (not `VITE_SUPABASE_ANON_KEY`). The tech doc references `ANON_KEY` in some places — always use `PUBLISHABLE_KEY` to match `src/lib/supabase.ts` and the CI workflow.

GitHub Actions secrets use the same names for production builds.

## Architecture

- **Frontend:** React 18 + TypeScript + Vite 6 + Tailwind CSS v4 (via `@tailwindcss/vite` plugin)
- **Backend:** Supabase (PostgreSQL, Auth, Realtime channels, Presence)
- **Hosting:** GitHub Pages (static), auto-deployed on push to `main` via `.github/workflows/deploy-pages.yml`
- **State management (planned):** React Context + useReducer
- **Routing (planned):** React Router v6 (not yet installed)

The Supabase client singleton is initialized in `src/lib/supabase.ts`. All database operations and realtime subscriptions go through this client.

### Planned source structure (from tech doc Section 12.3)

```
src/
├── config/ or lib/   # Supabase client (currently src/lib/supabase.ts)
├── contexts/         # AuthContext, GameContext
├── hooks/            # useAuth, useLobby, useChat, useMatchmaking, useGame, etc.
├── pages/            # LandingPage, LoginPage, LobbyPage, GamePage, ProfilePage
├── components/
│   ├── common/       # Button, Input, Modal, ProtectedRoute, Navbar
│   ├── lobby/        # LobbyStats, TableList, LobbyChat, QuickMatchButton, etc.
│   ├── game/         # Grid, Cell, ShipPlacementPhase, BattlePhase, GameEndModal
│   └── profile/      # StatsCard, MatchHistory
├── lib/              # gameLogic.ts, matchmaking.ts, constants.ts
├── types/            # TypeScript interfaces (index.ts)
└── styles/           # index.css (Tailwind imports)
```

### Key routes (planned)

| Route | Page | Auth Required |
|-------|------|---------------|
| `/` | Landing page | No |
| `/login` | Login | No |
| `/register` | Registration | No |
| `/lobby` | Lobby (matchmaking, tables, chat) | Yes |
| `/game/:gameId` | Game board | Yes |
| `/profile` | Player profile | Yes |

## Database

The Supabase PostgreSQL schema is defined in tech doc Section 6.3 (SQL migration script). Key tables:

- `profiles` — extends `auth.users`, created via trigger on signup
- `games` — one row per match, status: `setup` → `in_progress` → `finished`/`abandoned`
- `games_players` — junction table with board state (JSONB) and ready flag
- `moves` — every attack, with hit/miss/sunk result
- `tables` — custom lobby tables created by players
- `table_requests` — join requests for custom tables
- `matchmaking_queue` — FIFO queue for quick match
- `chat_messages` — lobby chat

Board state is stored as JSONB in `games_players.board` with a `ships` array containing type, size, cells (x/y coordinates), orientation, and sunk status.

Realtime must be enabled on: `games`, `games_players`, `moves`, `tables`, `table_requests`, `chat_messages`, `matchmaking_queue`.

## Game Logic

- **Grid:** 10x10, coordinates 0-9 for both x (columns A-J) and y (rows 1-10)
- **Ships:** Carrier(5), Battleship(4), Cruiser(3), Submarine(3), Destroyer(2)
- **Placement validation:** exactly 5 ships, correct sizes, within bounds, no overlap, contiguous cells
- **Attack resolution:** check opponent's board JSONB for hit/miss, mark sunk when all cells of a ship are hit
- **Win condition:** all 5 opponent ships sunk
- **Turns:** alternate, tracked via `games.current_turn`
- **Disconnect:** 10s heartbeat interval, 30s stale threshold, 2-minute reconnect window

## Realtime Channels (planned)

| Channel | Purpose |
|---------|---------|
| `lobby` (Presence) | Track online users and their status |
| `lobby-chat` | Chat message inserts |
| `lobby-tables` | Table create/update/delete |
| `table:{tableId}` | Join requests for specific table |
| `matchmaking` | Queue changes, match notifications |
| `game:{gameId}` | Moves, ready status, game state changes |
| `game:{gameId}:presence` | Heartbeat and disconnect detection |

## Conventions

- **Components:** PascalCase filenames (`GameBoard.tsx`)
- **Hooks:** camelCase with `use` prefix (`useMatchmaking.ts`)
- **Types:** PascalCase (`GamePlayer`)
- **DB tables/columns:** snake_case (`games_players`, `display_name`)
- **Constants:** UPPER_SNAKE_CASE (`HEARTBEAT_INTERVAL`)
- **Branches:** kebab-case (`feature/lobby-chat`)
- **Commits:** Conventional Commits (`feat: add ship placement`)
- **CSS:** Tailwind utility classes; dark navy blue theme (`bg-slate-950`, `text-slate-100`)

## Deployment

Vite `base` is set to `/CSC-710-Battleship-Online-Multiplayer/` in `vite.config.ts`. All asset paths and router base must account for this prefix.

GitHub Pages deploy runs automatically on push to `main`. Supabase credentials are injected from GitHub Actions secrets during build.

For SPA routing on GitHub Pages, a `public/404.html` redirect is needed (see tech doc Section 15.4).

## Security Notes

This is an academic project — no Supabase RLS policies are configured. All validation (move legality, turn order, ship placement) is client-side only. The Supabase anon key is intentionally public (Supabase design). Do not add any other secrets to the client bundle.
