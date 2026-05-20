# AstanaSafe Frontend

React/Vite frontend for the AstanaSafe dashboard.

## Structure

```text
src/
  app/          lazy route setup
  layouts/      app shell
  pages/        route pages
  features/     page-specific logic and feature components
  components/   reusable UI/map/filter components
  services/     API access
  hooks/        reusable hooks
  store/        Zustand state orchestration
  utils/        helpers and normalizers
  styles/       global CSS
```

## Commands

```bash
npm install
npm run dev
npm run lint
npm run build
```

Set `VITE_API_BASE_URL` when the API is not running at `http://localhost:8000/api`.
