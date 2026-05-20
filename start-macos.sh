#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
VENV_DIR="$BACKEND_DIR/.venv"
DB_NAME="${ASTANASAFE_DB_NAME:-astanasafe}"
DB_URL="${DATABASE_URL:-postgresql+psycopg://${USER}@localhost:5432/${DB_NAME}}"

print_step() {
  printf '\n==> %s\n' "$1"
}

need_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Missing command: %s\n' "$1"
    return 1
  fi
}

find_python() {
  if command -v python3.13 >/dev/null 2>&1; then
    command -v python3.13
    return
  fi

  if command -v python3 >/dev/null 2>&1; then
    command -v python3
    return
  fi

  printf 'Python 3 is not installed. Install it with: brew install python@3.13\n' >&2
  exit 1
}

port_is_busy() {
  lsof -iTCP:"$1" -sTCP:LISTEN -Pn >/dev/null 2>&1
}

ensure_postgres() {
  if ! command -v pg_isready >/dev/null 2>&1 || ! command -v psql >/dev/null 2>&1; then
    printf 'PostgreSQL command line tools are not in PATH.\n'
    printf 'Install and start PostgreSQL with:\n'
    printf '  brew install postgresql@16\n'
    printf '  brew services start postgresql@16\n'
    exit 1
  fi

  if ! pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
    printf 'PostgreSQL is installed, but it is not running on localhost:5432.\n'
    printf 'Start it with: brew services start postgresql@16\n'
    exit 1
  fi

  if ! psql -h localhost -p 5432 -d "$DB_NAME" -c '\q' >/dev/null 2>&1; then
    print_step "Creating PostgreSQL database '$DB_NAME'"
    createdb -h localhost -p 5432 "$DB_NAME"
  fi
}

PYTHON_BIN="$(find_python)"

print_step "Checking PostgreSQL"
ensure_postgres

print_step "Preparing backend virtual environment"
if [ ! -x "$VENV_DIR/bin/python" ]; then
  "$PYTHON_BIN" -m venv "$VENV_DIR"
fi
"$VENV_DIR/bin/python" -m pip install --upgrade pip
"$VENV_DIR/bin/python" -m pip install -r "$BACKEND_DIR/requirements.txt"
(cd "$BACKEND_DIR" && DATABASE_URL="$DB_URL" "$VENV_DIR/bin/python" scripts/migrate_database.py)

print_step "Preparing frontend dependencies"
need_command npm || {
  printf 'Install Node.js LTS from https://nodejs.org/ or with: brew install node\n'
  exit 1
}
if [ ! -x "$FRONTEND_DIR/node_modules/.bin/vite" ]; then
  (cd "$FRONTEND_DIR" && npm install)
fi

print_step "Starting services"
if port_is_busy 8000; then
  printf 'Backend port 8000 is already busy, skipping backend start.\n'
else
  (cd "$BACKEND_DIR" && DATABASE_URL="$DB_URL" nohup "$VENV_DIR/bin/python" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 > uvicorn-dev.out.log 2> uvicorn-dev.err.log &)
  printf 'Backend started on http://127.0.0.1:8000\n'
fi

if port_is_busy 5173; then
  printf 'Frontend port 5173 is already busy, skipping frontend start.\n'
else
  (cd "$FRONTEND_DIR" && nohup npm run dev -- --host localhost > vite-dev.out.log 2> vite-dev.err.log &)
  printf 'Frontend started on http://localhost:5173\n'
fi

printf '\nOpen this URL in your browser:\n'
printf '  http://localhost:5173\n'
printf '\nLogs:\n'
printf '  backend/uvicorn-dev.out.log and backend/uvicorn-dev.err.log\n'
printf '  frontend/vite-dev.out.log and frontend/vite-dev.err.log\n'
