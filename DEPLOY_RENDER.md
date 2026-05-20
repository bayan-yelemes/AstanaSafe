# Render Deployment

This project is prepared for Render with `render.yaml`.

## Services

- `astanasafe-api`: FastAPI backend, Python runtime, `/health` health check.
- `astanasafe-web`: Vite static frontend.
- `astanasafe-db`: managed PostgreSQL database.

## Before Deploy

1. Create a GitHub/GitLab/Bitbucket repository and push this project.
2. Do not commit local `.env` files. Use `.env.example` files as templates only.
3. Rotate any secrets that were stored locally before publishing the repo.

## Render Blueprint

Open Render Blueprint creation with your repo URL:

```text
https://dashboard.render.com/blueprint/new?repo=https://github.com/YOUR_USER/YOUR_REPO
```

Render will read `render.yaml` from the repository root.

## Required Secrets

Fill these values in the Render Dashboard when the Blueprint asks for them:

Backend:

- `GOOGLE_CLIENT_ID`
- `GEMINI_API_KEY`
- `SMTP_HOST`
- `SMTP_USERNAME`
- `SMTP_PASSWORD`
- `SMTP_FROM_EMAIL`

Frontend:

- `VITE_GOOGLE_CLIENT_ID`

`SECRET_KEY` and `DATABASE_URL` are generated/provisioned by Render.

## Password Reset Demo Mode

The backend supports `PASSWORD_RESET_DEMO_MODE`.

- `true`: the forgot-password form returns the reset link immediately and the frontend opens it automatically.
- `false`: the backend sends the reset link by email only.

`render.yaml` enables demo mode for the Render deployment in this repository.

## URLs To Check After Deploy

- Backend health: `https://astanasafe-api.onrender.com/health`
- Frontend: `https://astanasafe-web.onrender.com`

If Render creates different service URLs, update:

- backend `FRONTEND_URL`
- backend `CORS_ORIGINS`
- frontend `VITE_API_BASE_URL`

For Google sign-in, add the deployed frontend URL to the authorized origins in Google Cloud Console.
