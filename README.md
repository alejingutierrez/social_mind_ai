# Hybrid Local LLM Environment

This project provisions a **hybrid architecture** where Ollama with the `qwen2.5:14b` model runs
natively on macOS with Metal acceleration, while a Dockerized Python client connects to it via
`http://host.docker.internal:11434`.

## Host Installation Details

- `setup_host_ollama.sh` installs the `ollama` Homebrew formula under `/opt/homebrew/opt/ollama` and
  registers it with `brew services` so it persists across reboots.
- The script sets `OLLAMA_HOST=0.0.0.0` (both exported for the session and via `launchctl`) so the
  service listens on all interfaces and is reachable from Docker.
- Pulled models (e.g., `qwen2.5:14b`) reside under `~/.ollama/models/`—this is where `ollama pull`
  stores the manifest and tensor files. Subsequent pulls reuse those cached weights.

With this setup the macOS host handles all inference, taking advantage of Metal acceleration, while
containers only make HTTP calls to the host service.

## Files

- `setup_host_ollama.sh` – Installs/configures Ollama via Homebrew, exposes it on all network
  interfaces, starts the service, waits for readiness, and pulls `qwen2.5:14b`.
- `Dockerfile`, `app.py`, `requirements.txt` – Lightweight Python client image using `requests`
  to stream completions from the host Ollama instance.
- `docker-compose.yml` – Builds and runs the client container while injecting
  `LLM_API_URL=http://host.docker.internal:11434/api/generate`.
- `run_all.sh` – End-to-end automation: runs the host setup, builds the container, and executes the
  client while displaying the streamed output.
- `news_service/` – FastAPI-based backend that proxies the NewsAPI `/v2/everything` endpoint to
  return the first 10 articles for any provided `term`, containerized for local use.
- `insights_service/` – FastAPI backend that clasifica las noticias (vía Qwen) y persiste tanto el
  JSON estructurado como el título, descripción, contenido, URL e imagen originales en SQLite.
- `analysis_service/` – Genera insights agregados, oportunidades de negocio y riesgos reputacionales
  sobre conjuntos de noticias seleccionados y guarda cada resultado en `analysis_results`.
- `frontend/` – Aplicación React + Ant Design que implementa el menú lateral solicitado (Buscador,
  Insights, Análisis, Histórico) consumiendo las APIs anteriores.

## Prerequisites

- macOS Sonoma/Sequoia on Apple Silicon (M3) with Metal-enabled GPU access.
- Homebrew installed (`/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`).
- Docker Desktop for Mac (provides Docker Engine, Compose, and support for `host.docker.internal`).

## Quickstart

```bash
chmod +x setup_host_ollama.sh run_all.sh
./run_all.sh
```

The script will:

1. Ensure Homebrew and Ollama are present in `/opt/homebrew`, bind Ollama to `0.0.0.0`, start the
   service, and pull `qwen2.5:14b` into `~/.ollama/models/`.
2. Build the Docker image defined in the `Dockerfile`.
3. Run the `client` service from `docker-compose.yml`, which sends the prompt:
   `"Explain why connecting Docker to localhost logic requires host.docker.internal on macOS."`
4. Stream tokens from the model directly to your terminal to prove connectivity.

## Manual Workflow (Optional)

1. `./setup_host_ollama.sh`
2. `docker compose build`
3. `docker compose run --rm client`

## News Search Backend

The Dockerized FastAPI service exposed at `http://localhost:${NEWS_HOST_PORT:-19081}` (default
`19081`, configurable via the root `.env`) provides a `/news` endpoint that now merges **three**
providers in parallel:

- **NewsAPI** (`/v2/everything`)
- **GNews** (`/v4/search`)
- **NewsData.io** (`/api/1/latest`)
- **World News API** (`/search-news`)
- **The Guardian** (`/search`)
- **The New York Times** (`/svc/search/v2/articlesearch.json`)

Results are de-duplicated by URL **without query parameters** (everything after `?` is ignored) to
avoid double-counting near-identical links across providers.

Each response is also persisted in SQLite to avoid losing fetched articles; duplicates are skipped
by normalized URL. You can consult the archive via `GET /news/archive?limit=&offset=&term=`.

- Build: `docker compose build news_service`
- Run: `docker compose up -d news_service`
- Query: `curl "http://localhost:19081/news?term=ai"` (optionally append
  `&language=en`)

Environment variables (configured in `docker-compose.yml`; copy `.env.example` to `.env` and add
your own keys):

- `NEWS_API_KEY` (required) – Provide your NewsAPI key in `.env`.
- `NEWS_API_URL` – Defaults to `https://newsapi.org/v2/everything`.
- `NEWS_API_SORT_BY` – Defaults to `publishedAt`.
- `GNEWS_API_KEY` (required to enable GNews) – Provide your GNews key in `.env`.
- `GNEWS_API_URL` – Defaults to `https://gnews.io/api/v4/search`.
- `GNEWS_MAX_RESULTS` – How many articles to request from GNews (default 10, matching NewsAPI).
- `NEWSDATA_API_KEY` (required to enable NewsData.io) – Guarda tu clave en `.env`.
- `NEWSDATA_API_URL` – Defaults to `https://newsdata.io/api/1/latest`.
- `NEWSDATA_MAX_RESULTS` – How many articles to request from NewsData.io (default 10).
- `WORLDNEWS_API_KEY` (required to enable World News API) – Provide your key in `.env`.
- `WORLDNEWS_API_URL` – Defaults to `https://api.worldnewsapi.com/search-news`.
- `WORLDNEWS_MAX_RESULTS` – How many articles to request from World News API (default 10).
- `GUARDIAN_API_KEY` (required to enable The Guardian) – Guarda la clave en `.env`.
- `GUARDIAN_API_URL` – Defaults to `https://content.guardianapis.com/search`.
- `GUARDIAN_MAX_RESULTS` – How many articles to request from The Guardian (default 10).
- `NEWS_DB_PATH` – SQLite path for the hemeroteca/archive (default `/data/news.db`, persisted via the
  `news_data` volume).
- `NYT_API_KEY` – Article Search API key saved in `.env`.
- `NYT_API_URL` – Defaults to `https://api.nytimes.com/svc/search/v2/articlesearch.json`.

Behavioral notes:

- If GNews hits its daily limit of 100 requests (HTTP 429 / mensajes de “limit reached”), the service
  logs a warning and continues responding with the remaining providers.
- If NewsData.io rate limits (429 or “rate limit exceeded” messages), the service logs a warning and
  continues with the other sources.
- If World News API rate limits (429) or errors, the service logs a warning and continues with other
  providers.
- If The Guardian rate limits (429) or errors, the service logs a warning and continues with other
  providers.

Archive:

- `GET /news/archive?limit=&offset=&term=` returns saved articles ordered from newest to oldest.
- Data is stored in SQLite (`/data/news.db`) mounted via the `news_data` volume.
- Combined responses surface HTTP or upstream errors as FastAPI `HTTPException` payloads when no
  provider returns data.

## Insights Backend

`insights_service` orchestrates the NewsAPI proxy plus Qwen inference to deliver structured
intelligence and store it in `/data/insights.db` (persisted via the `insights_data` volume).

- Build: `docker compose build insights_service`
- Run: `docker compose up -d news_service insights_service`
- Request 10 analyses:

```bash
curl "http://localhost:19090/insights?term=ai"
```

The service will:

1. Call `news_service` for the first 10 articles.
2. Send each article (title, description, content) to Qwen via
   `http://host.docker.internal:11434/api/generate` with instructions to respond **only** with valid
   JSON matching the schema (sentiment, summary, category, tags, brand, entity).
3. Persist each JSON entry plus original article metadata into SQLite.
4. Return a response containing the stored rows (and you can query `/history` to retrieve the latest
   records).

Extra endpoints expuestos para el frontend:

- `POST /insights/classify` acepta `term` **o** una lista de `articles` (con título, descripción,
  contenido, URL, imagen). Es el endpoint que usa la vista *Buscador* para clasificar sólo las
  noticias seleccionadas.
- `GET /insights/list?term=&limit=&offset=` pagina el histórico completo (usado en la tabla de
  *Insights* e *Histórico*).
- `GET /history?limit=` sigue disponible como atajo para los últimos N registros.

## Analysis Backend

`analysis_service` selects an arbitrary number of stored entries (optionally filtered by `term`) and
asks Qwen to synthesize two insights, two business opportunities, and two reputational risks about
the entire set. Each response is strict JSON ready for downstream automation.

- Build: `docker compose build analysis_service`
- Run: `docker compose up -d analysis_service`
- Analyze: `curl "http://localhost:19100/analysis?term=ai&limit=6"`

Environment variables mirror the other services (`INSIGHTS_DB_PATH`, `LLM_API_URL`, `LLM_MODEL`) so
the container can read from the same persistent database and reach the host LLM endpoint.

Capacidades adicionales:

- `POST /analysis/run` (body opcional con `insight_ids`, `term`, `limit`) ejecuta el análisis sobre
  un subconjunto curado y guarda el resultado, devolviendo `analysis_id`.
- `GET /analysis/history?limit=` recupera los análisis previos para alimentar las vistas de
  *Análisis* e *Histórico*.

## Frontend (Ant Design)

- Desarrollo local: `cd frontend && npm install && npm run dev`
- Docker Compose: `docker compose up -d frontend` → `http://localhost:19573`

Vistas implementadas:

1. **Buscador** – Consume `/news`, permite seleccionar artículos con imágenes y enviarlos a
   `/insights/classify`.
2. **Insights** – Tabla paginada (`/insights/list`) con selección para orquestar `/analysis/run`.
3. **Análisis** – Renderiza `/analysis/history` para mostrar insights, oportunidades y riesgos
   generados.
4. **Histórico** – Combina la lista completa de insights, agrupaciones por término y el historial de
   análisis.

## Vercel (Frontend)

- `frontend/vercel.json` usa `@vercel/static-build` y agrega fallback de SPA a `/index.html`. El root
  de proyecto en Vercel está fijado a `frontend`, así que sólo el frontend se despliega; los
  servicios FastAPI siguen corriendo en host o contenedores (ajusta las URLs públicas antes de
  producción).
- Variables en Vercel (Production/Preview/Development): `VITE_NEWS_API`,
  `VITE_INSIGHTS_API`, `VITE_ANALYSIS_API`, `VITE_IMAGE_PROXY` (opcional, usa `/api` del mismo
  dominio en producción si no se define), todas las claves de news (`NEWS_API_KEY`,
  `GNEWS_API_KEY`, `NEWSDATA_API_KEY`, `WORLDNEWS_API_KEY`, `GUARDIAN_API_KEY`, `NYT_API_KEY` y sus
  URLs/limits), y el bloque de Postgres/Neon (`DATABASE_URL`, `POSTGRES_URL`,
  `POSTGRES_URL_NON_POOLING`, `POSTGRES_PRISMA_URL`, `PGHOST[_UNPOOLED]`, `PGUSER`, `PGDATABASE`,
  `PGPASSWORD`, etc.).
- Ejemplo CLI (rellena tu token/ID de equipo):<br>
  `vercel env add VITE_NEWS_API production --token $VERCEL_TOKEN --project prj_LDLRuAvjNNeOUHDwAy1wGcCb8KNl --scope team_GEudrG1hM2OstdVOLSsJbj4G`
  (repite para preview/development y las demás variables).
- Validación local ejecutada: `cd frontend && npm ci && npm run build` (el build de Vercel debería
  pasar con las mismas instrucciones).

## Validating the Model

- `docker compose run --rm client` – Streams a prompt through the container to verify host ↔
  container connectivity and confirm the model responds.
- `curl http://localhost:11434/api/tags` – Confirms the host Ollama daemon is up and exposes
  `qwen2.5:14b`.

## Updating Models

To switch to a different model, update the `OLLAMA_MODEL` variable in `setup_host_ollama.sh` and the
`LLM_MODEL` environment variable in `docker-compose.yml`. Re-run `./run_all.sh` to pull and test the
new configuration.
