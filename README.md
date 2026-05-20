# AstanaSafe

AstanaSafe — это дипломный проект: карта и дашборд дорожной безопасности для Астаны. Внутри есть backend на FastAPI, база PostgreSQL и frontend на React/Vite.

Ниже инструкция от нуля до запуска для Windows и macOS. Самый простой путь — запускать готовым скриптом. Ручной запуск тоже оставил, чтобы можно было спокойно разобраться, если на компьютере что-то настроено иначе.

## Что должно быть установлено

Перед запуском нужны три вещи:

- Python 3.13 или просто свежий Python 3
- Node.js LTS
- PostgreSQL 16 или новее

### Windows

1. Установи Python с сайта `https://www.python.org/downloads/`.
   Во время установки обязательно поставь галочку `Add Python to PATH`.

2. Установи Node.js LTS с сайта `https://nodejs.org/`.

3. Установи PostgreSQL с сайта `https://www.postgresql.org/download/windows/`.
   Во время установки запомни пароль пользователя `postgres`. Он понадобится в `backend/.env`.

### macOS

Проще всего ставить через Homebrew.

1. Открой Terminal.

2. Если Homebrew ещё нет, установи его:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

После установки закрой Terminal и открой заново. Если команда `brew` всё равно не находится, Homebrew обычно сам показывает строку с `shellenv` — её нужно один раз скопировать и выполнить.

3. Установи Python, Node.js и PostgreSQL:

```bash
brew install python@3.13 node postgresql@16
brew services start postgresql@16
```

## Быстрый запуск на Windows

1. Открой PowerShell.

2. Перейди в папку проекта:

```powershell
cd "C:\Users\zdeat\OneDrive\Рабочий стол\Проект"
```

Если проект лежит в другой папке, укажи свой путь.

3. Проверь файл `backend\.env`. В строке `DATABASE_URL` должен быть настоящий пароль от PostgreSQL:

```text
DATABASE_URL=postgresql+psycopg://postgres:ТВОЙ_ПАРОЛЬ@localhost:5432/astanasafe
```

4. Запусти проект:

```powershell
.\start-windows.ps1
```

Если PowerShell ругается на запрет запуска скриптов, выполни так:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\start-windows.ps1
```

5. Открой в браузере:

```text
http://localhost:5173
```

Скрипт сам создаёт виртуальное окружение `backend/venv-win`, ставит backend-зависимости, прогоняет миграции Alembic, ставит frontend-зависимости, запускает backend на `http://127.0.0.1:8000` и frontend на `http://localhost:5173`.

## Быстрый запуск на macOS

1. Положи папку проекта в удобное место, например на Desktop или в Documents.

2. Открой Terminal и перейди в папку проекта. Например, если проект на рабочем столе:

```bash
cd ~/Desktop/Проект
```

Если папка называется иначе, замени `Проект` на своё название.

3. Разреши запуск macOS-скрипта:

```bash
chmod +x start-macos.sh
```

4. Запусти проект:

```bash
./start-macos.sh
```

5. Открой в браузере:

```text
http://localhost:5173
```

macOS-скрипт делает всё основное сам: проверяет PostgreSQL, создаёт базу `astanasafe`, если её ещё нет, создаёт Python-окружение `backend/.venv`, ставит зависимости, прогоняет миграции Alembic, запускает backend и frontend.

По умолчанию на macOS backend подключается к базе так:

```text
postgresql+psycopg://ИМЯ_ТВОЕГО_MAC_ПОЛЬЗОВАТЕЛЯ@localhost:5432/astanasafe
```

Это нормальный вариант для PostgreSQL, установленного через Homebrew. Если у тебя база настроена через пользователя `postgres` и пароль, запусти так:

```bash
DATABASE_URL="postgresql+psycopg://postgres:ТВОЙ_ПАРОЛЬ@localhost:5432/astanasafe" ./start-macos.sh
```

## Ручной запуск на Windows

Этот способ нужен, если хочется запускать backend и frontend отдельно.

1. Открой PowerShell и перейди в backend:

```powershell
cd "C:\Users\zdeat\OneDrive\Рабочий стол\Проект\backend"
```

2. Создай и активируй Python-окружение:

```powershell
py -3 -m venv venv-win
.\venv-win\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

3. Создай базу PostgreSQL:

```powershell
createdb -U postgres astanasafe
```

Если команда `createdb` не находится, открой pgAdmin и создай базу `astanasafe` вручную.

4. Проверь `backend\.env`:

```text
DATABASE_URL=postgresql+psycopg://postgres:ТВОЙ_ПАРОЛЬ@localhost:5432/astanasafe
SECRET_KEY=change-this-in-development
GOOGLE_CLIENT_ID=
GEMINI_API_KEY=
GEMINI_MODEL=gemini-1.5-flash
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

5. Прогони миграции:

```powershell
python scripts\migrate_database.py
```

6. Запусти backend:

```powershell
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

7. Открой второе окно PowerShell и запусти frontend:

```powershell
cd "C:\Users\zdeat\OneDrive\Рабочий стол\Проект\frontend"
npm install
npm run dev
```

8. Открой `http://localhost:5173`.

## Ручной запуск на macOS

1. Открой Terminal и перейди в папку проекта:

```bash
cd ~/Desktop/Проект
```

2. Убедись, что PostgreSQL запущен, и создай базу:

```bash
brew services start postgresql@16
createdb astanasafe
```

Если Terminal пишет, что база уже существует, всё нормально.

3. Подними backend:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
DATABASE_URL="postgresql+psycopg://$USER@localhost:5432/astanasafe" python scripts/migrate_database.py
DATABASE_URL="postgresql+psycopg://$USER@localhost:5432/astanasafe" python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Если PostgreSQL работает через пользователя `postgres` и пароль, последнюю команду запускай так:

```bash
DATABASE_URL="postgresql+psycopg://postgres:ТВОЙ_ПАРОЛЬ@localhost:5432/astanasafe" python scripts/migrate_database.py
DATABASE_URL="postgresql+psycopg://postgres:ТВОЙ_ПАРОЛЬ@localhost:5432/astanasafe" python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

4. Открой второе окно Terminal и подними frontend:

```bash
cd ~/Desktop/Проект/frontend
npm install
npm run dev
```

5. Открой `http://localhost:5173`.

## Файлы окружения

Backend читает настройки из `backend/.env`:

```text
DATABASE_URL=postgresql+psycopg://postgres:ТВОЙ_ПАРОЛЬ@localhost:5432/astanasafe
SECRET_KEY=change-this-in-development
GOOGLE_CLIENT_ID=
GEMINI_API_KEY=
GEMINI_MODEL=gemini-1.5-flash
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
```

Frontend читает настройки из `frontend/.env`:

```text
VITE_API_BASE_URL=http://localhost:8000/api
VITE_GOOGLE_CLIENT_ID=
```

`GEMINI_API_KEY` можно оставить пустым. Тогда AI-разделы будут работать через запасной прогноз без Gemini.

## Где что лежит

```text
backend/
  app/                  FastAPI-приложение, роутеры, модели, сервисы
  data/                 данные backend
  tests/                тесты backend
  requirements.txt      Python-зависимости

frontend/
  src/                  React-приложение
  public/               статические файлы
  package.json          npm-зависимости и команды

data/                   большие исходные map-файлы
```

В папках `venv`, `venv-win`, `.venv`, `node_modules` лежат зависимости под конкретную операционную систему. Если переносишь проект с Windows на macOS, лучше не рассчитывать на старые зависимости — скрипт macOS сам поставит свои.

## Проверка проекта

Backend:

```bash
cd backend
python -m compileall app
pytest
```

Frontend:

```bash
cd frontend
npm run lint
npm run build
```

## Миграции базы

Да, миграции нужны. В быстрых скриптах они запускаются автоматически перед стартом backend.

Если запускаешь backend вручную, команда такая:

Windows:

```powershell
cd backend
python scripts\migrate_database.py
```

macOS:

```bash
cd backend
DATABASE_URL="postgresql+psycopg://$USER@localhost:5432/astanasafe" python scripts/migrate_database.py
```

Обычная Alembic-команда тоже работает:

```bash
alembic upgrade head
```

Но для этого `DATABASE_URL` должен быть задан через `backend/.env` или переменную окружения.

## Если что-то не запускается

Если занят порт `8000` или `5173`:

- Windows: открой Task Manager и останови лишние `python.exe` или `node.exe`.
- macOS: выполни `lsof -i :8000` или `lsof -i :5173`, чтобы увидеть процесс.

Если backend не подключается к базе:

- Проверь, что PostgreSQL запущен.
- Проверь, что база называется `astanasafe`.
- Проверь логин и пароль в `DATABASE_URL`.

Если frontend открылся, но данные не грузятся:

- Открой `http://127.0.0.1:8000` и проверь, отвечает ли backend.
- Проверь `frontend/.env`: там должно быть `VITE_API_BASE_URL=http://localhost:8000/api`.
- После изменения `frontend/.env` перезапусти `npm run dev`.

Если на macOS появляется ошибка доступа к `start-macos.sh`, ещё раз выполни:

```bash
chmod +x start-macos.sh
```
