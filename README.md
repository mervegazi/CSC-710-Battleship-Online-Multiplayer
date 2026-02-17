# CSC-710-Battleship-Online-Multiplayer

## Stack

- React
- Vite
- TypeScript
- Tailwind CSS

## Local development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Required env vars:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
Create `.env.local` in the project root with those values (you can copy from `.env.example`).

## GitHub Pages deployment

- Auto-deploy is configured in `.github/workflows/deploy-pages.yml`.
- It runs on pushes to `main`.
- Vite `base` is set for this repo in `vite.config.ts`.
- Build reads Supabase values from GitHub Actions secrets:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`
- In GitHub repo settings, ensure:
  - `Settings` -> `Pages` -> `Source`: `GitHub Actions`
  - `Settings` -> `Secrets and variables` -> `Actions`: add both Supabase secrets
