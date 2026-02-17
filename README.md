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

## GitHub Pages deployment

- Auto-deploy is configured in `.github/workflows/deploy-pages.yml`.
- It runs on pushes to `main`.
- Vite `base` is set for this repo in `vite.config.ts`.
- In GitHub repo settings, ensure:
  - `Settings` -> `Pages` -> `Source`: `GitHub Actions`
