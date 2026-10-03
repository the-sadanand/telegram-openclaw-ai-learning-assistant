# Render Free Deployment

This project uses Gemini for inference, Upstash Redis for memory, Telegram webhooks on Render, and an external five-minute scheduler for daily briefs.

## 1. Create the Render service

Use the included `render.yaml` Blueprint or create a Docker Web Service manually.

The service should use the Free plan and expose the existing `/health` endpoint.

## 2. Add environment variables

Set these in Render:

- `TELEGRAM_BOT_TOKEN` — your BotFather token
- `GEMINI_API_KEY` — your Google AI Studio key
- `GEMINI_MODEL` — `gemini-3.8-flash`
- `DAILY_BRIEF_TIME` — `21:00`
- `UPSTASH_REDIS_REST_URL` — Upstash Redis REST URL
- `UPSTASH_REDIS_REST_TOKEN` — Upstash Redis REST token
- `TELEGRAM_WEBHOOK_SECRET` — random URL-safe secret
- `CRON_SECRET` — random URL-safe secret

Do not set `OLLAMA_HOST`.

## 3. Create free persistent memory

Create a free Upstash Redis database and copy its REST URL/token into Render.

The application automatically uses Redis when both variables are present. Without them, it falls back to local files for local development.

## 4. Telegram webhook

When the app starts on Render, it uses Render's `RENDER_EXTERNAL_URL` automatically and registers:

`https://YOUR-RENDER-DOMAIN/telegram/webhook`

No polling configuration is needed on Render.

## 5. Daily brief scheduler

Render Free web services can sleep when idle, so the in-process five-minute cron cannot be the only scheduler.

Use a free QStash schedule:

- Method: `POST`
- URL: `https://YOUR-RENDER-DOMAIN/api/cron/daily/YOUR_CRON_SECRET`
- Schedule: every 5 minutes

The endpoint checks every onboarded user in their own timezone and sends a brief when their configured daily time is due. It records the last sent date to prevent duplicate briefs.

Five-minute scheduling produces 288 requests/day, which stays below the free QStash daily message limit.

## 6. Verify the deployment

Open:

- `https://YOUR-RENDER-DOMAIN/health`
- `https://YOUR-RENDER-DOMAIN/api/status`

Then send `/start` to the Telegram bot and complete onboarding.

For a manual test, use `/brief`.

## 7. Local development

Local runs use Telegram polling instead of the Render webhook.

The local Docker setup uses the same Gemini API and can use file-based memory when Upstash variables are not configured.
