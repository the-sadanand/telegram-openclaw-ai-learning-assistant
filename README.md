# OpenClaw AI Learning Assistant

A Telegram-based AI learning assistant built with Node.js, Telegraf, Gemini API, DuckDuckGo search, and persistent memory.

## Current Architecture

```text
Telegram
   ↓
Telegram webhook (Render) / polling (local)
   ↓
Node.js + Telegraf
   ├── Gemini API
   ├── DuckDuckGo web search
   ├── Upstash Redis memory (production)
   └── QStash five-minute scheduler (Render) / node-cron (local)
```

## Features

- Telegram onboarding for name, level, interests, and timezone
- Direct Gemini-powered questions and answers
- `/brief` for an on-demand learning brief
- Daily technical tidbits and interview questions
- Fresh web search before daily briefs
- Per-user timezone-aware daily scheduling
- Upstash Redis memory for cloud deployment
- Local file memory fallback for development
- Telegram webhook support for Render
- Health and status endpoints

## Environment Variables

Copy `.env.example` to `.env` for local development.

```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-3.8-flash
DAILY_BRIEF_TIME=21:00
UPSTASH_REDIS_REST_URL=your_upstash_redis_rest_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_rest_token
TELEGRAM_WEBHOOK_SECRET=your_webhook_secret
CRON_SECRET=your_cron_secret
```

Never commit real tokens or API keys.

## Local Docker Setup

Requirements:

- Docker Desktop
- Telegram bot token
- Gemini API key

Run:

```bash
cp .env.example .env
docker compose up -d --build
docker compose logs -f openclaw
```

The local container uses Telegram polling. If Upstash variables are not configured, memory is stored in `/data/memory`.

Health check:

```text
http://localhost:3000/health
```

## Local Node.js Setup

```bash
npm install
npm start
```

Manual daily brief:

```bash
npm run trigger-brief
```

## Render Deployment

Use the included `render.yaml` or create a Docker Web Service manually.

Render environment variables:

- `TELEGRAM_BOT_TOKEN`
- `GEMINI_API_KEY`
- `GEMINI_MODEL=gemini-3.8-flash`
- `DAILY_BRIEF_TIME=21:00`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`
- `CRON_SECRET`

Do not configure `OLLAMA_HOST`. Ollama is no longer part of the application.

On Render, the application automatically uses `RENDER_EXTERNAL_URL` to register the Telegram webhook.

Render Free services can sleep when idle. The application therefore exposes:

```text
POST /api/cron/daily/<CRON_SECRET>
```

Use a free external scheduler such as Upstash QStash to call that endpoint every 5 minutes. The endpoint checks each user's local timezone and sends the brief when `DAILY_BRIEF_TIME` is due.

See [`RENDER_SETUP.md`](RENDER_SETUP.md) for the complete deployment procedure.

## API Endpoints

| Endpoint | Purpose |
|---|---|
| `GET /health` | Basic health check |
| `GET /api/status` | Gemini/API status |
| `POST /api/cron/daily/<secret>` | Scheduled brief runner |

## Telegram Commands

- `/start` — start or edit onboarding
- `/brief` — send a brief immediately
- `/status` — check bot and Gemini status

## Project Structure

```text
app.js                  Telegram bot + HTTP server
cli.js                  Manual brief trigger
lib/gemini.js           Gemini API integration
lib/brief.js            Daily brief service
lib/generation.js       Tidbits/questions generation
lib/memory.js           Redis/file memory abstraction
lib/search.js           DuckDuckGo search + content fetching
lib/skills.js            Markdown skill loader
skills/                  SKILL.md definitions
config/                  Application configuration
Dockerfile              Production container
docker-compose.yml       Local Docker setup
render.yaml             Render deployment blueprint
RENDER_SETUP.md         Render deployment guide
```

## Important Deployment Notes

- Gemini API keys and Telegram tokens belong in environment variables only.
- Render Free web services have ephemeral local files, so production memory should use Upstash Redis.
- Telegram uses polling locally and webhooks on Render.
- On Render, QStash is the scheduler; the in-process node-cron scheduler is disabled. Locally, node-cron runs every five minutes.
- The application no longer depends on a local Ollama server.
