# Daily Tech Brief

The runtime implementation is in `lib/brief.js`, `lib/search.js`, and `lib/generation.js`. This file documents the current behavior; it is not loaded as executable instructions.

## Workflow

1. `app.js` selects onboarded users whose local time is within the configured daily window.
2. `lib/search.js` searches DuckDuckGo for each configured interest and fetches article content.
3. `lib/generation.js` asks Gemini for 3–5 technical tidbits and exactly 5 interview questions.
4. `lib/brief.js` assembles the brief and splits long Telegram messages safely.
5. The scheduler records `last_brief_date` only after successful delivery.

## Data

The user profile comes from `user:<telegram-user-id>` and uses `interests` and `level`.

## Reliability

A brief is not marked as delivered when article search returns no usable articles or Gemini generation fails. On Render, QStash triggers the protected cron endpoint every five minutes; the in-process node-cron scheduler is disabled there to avoid duplicate triggers.
