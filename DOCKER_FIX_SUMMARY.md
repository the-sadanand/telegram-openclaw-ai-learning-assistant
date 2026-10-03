# Deployment Fix Summary

The runtime has been updated for the current Gemini + Render architecture.

## Fixed

- Replaced local Ollama inference with Gemini API.
- Removed Ollama services from Docker Compose.
- Removed the unused native sqlite3 dependency.
- Made the Docker health check use Render's runtime PORT.
- Added Render-safe Telegram webhooks.
- Added local polling fallback for development.
- Added Upstash Redis memory support.
- Added timezone-aware five-minute scheduling checks.
- Added a secure external cron endpoint for sleeping Render services.
- Improved DuckDuckGo search with HTML and API fallback.
- Added article-content fetching before daily brief generation.
- Added robust Gemini retry/error handling.
- Fixed onboarding timezone validation and the previous briefTime error.
- Added Telegram message splitting for messages near the API size limit.
- Updated the CLI and Makefile to match the current runtime.
- Added render.yaml and RENDER_SETUP.md.

## Production requirements

For Render Free deployment, configure:

- Telegram bot token
- Gemini API key
- Upstash Redis REST URL/token
- Telegram webhook secret
- Cron secret
- A free external five-minute scheduler such as Upstash QStash

The real secrets must never be committed to Git.
