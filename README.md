# 📚 OpenClaw Personalised Learning Assistant

A fully automated, self-hosted **AI study partner** that runs on your own hardware. Every evening at 9 PM (in *your* timezone), it searches the web for fresh content in your technical domains and delivers a personalised Telegram message containing **5 interview questions** and **3–5 technical tidbits** — calibrated to your experience level and goals.

Built with [OpenClaw](https://github.com/openclaw/openclaw), an open-source AI agent framework.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Quick Start (Docker — Recommended)](#quick-start-docker--recommended)
5. [Manual Setup (Without Docker)](#manual-setup-without-docker)
6. [Configuration Reference](#configuration-reference)
7. [Design Decisions](#design-decisions)
8. [Skill Details](#skill-details)
9. [Testing Your Setup](#testing-your-setup)
10. [Troubleshooting](#troubleshooting)
11. [Project Structure](#project-structure)

---

## Project Overview

This project implements the following automated loop:

```
New user messages bot
        ↓
Onboarding skill runs (one-time)
        ↓
User profile stored in persistent memory
        ↓
Every night at 9 PM (user's timezone):
  1. Load user profile from memory
  2. Web search each domain for fresh content
  3. Synthesise 3–5 tidbits from real articles
  4. Generate 5 level-calibrated interview questions
  5. Send formatted Telegram message
```

**Key features:**
- 🔒 **Fully self-hosted** — your data never leaves your machine (when using Ollama)
- 🎯 **Personalised** — content is calibrated to your level and interests
- 🌐 **Web-grounded** — questions and tidbits are derived from live web content, not stale training data
- 🔁 **Non-repetitive** — the agent tracks recent topics and avoids re-asking questions
- ⏰ **Proactive** — the agent initiates the daily brief autonomously via cron

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                          User's Device                              │
│                     ┌──────────────────┐                            │
│                     │  User on Telegram│                           │
│                     └────────┬─────────┘                            │
└──────────────────────────────┼──────────────────────────────────────┘
                               │ 1. Sends message / receives brief
                    ┌──────────▼──────────┐
                    │     Telegram API    │
                    └──────────┬──────────┘
                               │
        ┌──────────────────────▼──────────────────────────────────┐
        │              OpenClaw Gateway (Your Machine)            │
        │                                                         │
        │  ┌─────────────────┐       ┌──────────────────────────┐ │
        │  │  Cron Scheduler  │       │  Telegram Channel Plugin│ │
        │  │ (9 PM nightly)  │       │  (persistent connection) │ │
        │  └────────┬────────┘       └────────────┬─────────────┘ │
        │           │                             │               │
        │           └─────────────┬───────────────┘               │
        │                         │                               │
        │                ┌───────▼────────┐                      │
        │                │   Agent Core   │                      │
        │                │    (Molty)     │                      │
        │                └─┬───────────┬──┘                       │
        │                  │           │                          │
        │         ┌────────▼───┐  ┌────▼──────────┐               │
        │         │Tool Executo│  │ Skill Registr│             │
        │         └────┬────┬──┘  └───┬─────────┬─┘               │
        │              │    │         │         │                 │
        │        ┌─────▼─┐ ┌▼──────┐ ┌▼──────┐ ┌▼─────────────┐   │
        │        │web_   │ │memory│  │user-   │ │daily-quiz/  │   │
        │        │search │ │_store│ │onboard │ │SKILL.md     │   │
        │        └───┬────┘ └──┬───┘ │SKILL  │ └──────────────┘   │
        │            │         │     │.md    │                    │
        │      ┌─────▼──┐  ┌───▼───┐ └───────┘                    │
        │      │DuckDDGo│  │/data/ │                              │
        │      │/SearXNG│  │memory │                              │
        │      └────────┘  └───────┘                              │
        └─────────────────────────────────────────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │ LLM Provider        │
                    │ (Ollama / Cloud)    │
                    └─────────────────────┘
```

---

## Prerequisites

| Requirement | Notes |
|---|---|
| Docker + Docker Compose | v24+ recommended |
| A Telegram account | To create the bot via @BotFather |
| 8 GB RAM minimum | For running Llama 3 8B locally; 16 GB recommended |
| 10 GB free disk space | For the Ollama model weights |

If you prefer a **cloud LLM** (OpenAI / Anthropic), you only need Docker and an API key — no GPU or high RAM required.

---

## Quick Start (Docker — Recommended)

### Step 1 — Clone the Repository

```bash
git clone https://github.com/the-sadanand/telegram-openclaw-ai-learning-assistant.git
cd openclaw-learning-assistant
```

### Step 2 — Create Your Telegram Bot

1. Open Telegram and search for **@BotFather**
2. Send `/newbot` and follow the prompts
3. Copy the **HTTP API Token** you receive — you'll need it in the next step

### Step 3 — Configure Environment Variables

```bash
cp .env.example .env
```

Open `.env` in a text editor and set your values:

```env
TELEGRAM_BOT_TOKEN=your_actual_token_here
```

> ⚠️ **Never** commit your `.env` file. It is already in `.gitignore`.

### Step 4 — Start All Services

```bash
docker compose up -d
```

This will:
1. Build the OpenClaw agent image
2. Start the Ollama LLM server
3. Automatically pull the `llama3:8b` model (first run takes 5–10 minutes)
4. Start the OpenClaw gateway

### Step 5 — Verify the Bot is Running

Check the logs:

```bash
docker compose logs -f openclaw
```

You should see output like:
```
[INFO] OpenClaw Gateway started
[INFO] Telegram plugin connected — bot: @YourBotName
[INFO] Skills loaded: user-onboarding, daily-quiz
[INFO] Standing orders registered: trigger-user-onboarding
[INFO] Cron job registered: nightly-tech-brief (0 21 * * *)
[INFO] Gateway ready. Listening for messages...
```

### Step 6 — Test the Bot

Open Telegram, find your bot, and send it **any message** (e.g., "Hello"). The onboarding skill should start immediately.

---

## Manual Setup (Without Docker)

### 1. Install Dependencies

```bash
# Node.js 20 LTS required
node --version  # should be v20.x.x

# Install OpenClaw globally
npm install -g openclaw

# Verify
openclaw --version
```

### 2. Install and Start Ollama

```bash
# macOS / Linux
curl -fsSL https://ollama.ai/install.sh | sh

# Pull the model
ollama pull llama3:8b

# Start the Ollama server (keep this terminal open)
ollama serve
```

### 3. Run OpenClaw Onboarding

```bash
openclaw onboard
```

Follow the prompts:
- Provider: **Ollama**
- Model: **llama3:8b**
- Web search: **DuckDuckGo**

### 4. Copy Configuration and Skills

```bash
cp config/openclaw.json ~/.openclaw/openclaw.json
cp -r skills ~/.openclaw/skills
```

### 5. Set Your Telegram Token

Edit `~/.openclaw/openclaw.json` and replace `${env.TELEGRAM_BOT_TOKEN}` with your token, **or** set the environment variable:

```bash
export TELEGRAM_BOT_TOKEN=your_token_here
```

### 6. Register the Standing Order (Onboarding Trigger)

```bash
openclaw standing-orders add \
  --name "trigger-user-onboarding" \
  --if "memory.user_profile_{{user.id}} does not exist" \
  --run-skill "user-onboarding"
```

### 7. Register the Cron Job

```bash
openclaw cron add \
  --name "nightly-tech-brief" \
  --cron "0 21 * * *" \
  --tz "UTC" \
  --session isolated \
  --message "Run the daily-quiz skill for the primary user. Use their stored preferences to generate and send the daily brief to them on Telegram." \
  --announce \
  --channel telegram
```

> 💡 The timezone defaults to UTC here. The daily-quiz skill reads the user's timezone from their profile and the cron job should be updated per-user after onboarding.

### 8. Start the Gateway

```bash
openclaw gateway start
```

---

## Configuration Reference

The main configuration file is at `config/openclaw.json`. All secrets are referenced via environment variables — **no hardcoded tokens**.

```json
{
  "model": {
    "provider": "ollama",
    "model": "llama3:8b"
  },
  "plugins": {
    "entries": {
      "telegram": {
        "botToken": "${env.TELEGRAM_BOT_TOKEN}"
      }
    }
  }
}
```

**To switch to OpenAI:**

Change the model section in `config/openclaw.json`:
```json
{
  "model": {
    "provider": "openai",
    "model": "gpt-4o",
    "apiKey": "${env.OPENAI_API_KEY}"
  }
}
```

And add `OPENAI_API_KEY=sk-...` to your `.env`.

**To enable SearXNG** (self-hosted search):

Uncomment the `searxng` service in `docker-compose.yml` and add to `.env`:
```env
SEARXNG_URL=http://searxng:8080
```

---

## Design Decisions

### Onboarding Trigger: Standing Order vs Webhook

This project uses a **Standing Order** to trigger the onboarding skill.

**What is a Standing Order?**
A Standing Order is a conditional rule evaluated by the OpenClaw gateway on every incoming message. If the condition is true, the specified skill runs instead of the normal response flow.

**Our Standing Order:**
```
IF memory.user_profile_{{user.id}} does not exist
THEN run skill: user-onboarding
```

**Why Standing Order over a Webhook?**

| Factor | Standing Order ✅ | Webhook |
|---|---|---|
| **Setup complexity** | Zero — one CLI command | Requires a public HTTPS endpoint |
| **Infrastructure** | None beyond the gateway | Needs a web server / reverse proxy |
| **Reliability** | Evaluated in-process, no network hop | Dependent on external HTTP service |
| **Privacy** | All data stays on your machine | Data may travel to an external server |
| **Portability** | Works in Docker, local dev, any env | Requires domain/port configuration |

The Standing Order approach is simpler, more reliable, and consistent with the self-hosted, privacy-first philosophy of OpenClaw. A Webhook would only make sense if the onboarding needed to integrate with an external CRM or database that the gateway itself couldn't reach.

### LLM Choice: Ollama (llama3:8b) as Default

The default configuration uses Ollama with `llama3:8b` because:
- **Free** — no API costs, no usage limits
- **Private** — inference stays on your hardware
- **Capable** — Llama 3 8B handles complex reasoning, web content summarisation, and multi-step instruction following well

For production use or higher quality output, switch to `gpt-4o` or `claude-sonnet` via the config.

### Web Search: DuckDuckGo as Default

DuckDuckGo requires no API key and has no rate-limit restrictions for moderate personal use. For higher-volume deployments, the optional SearXNG service in `docker-compose.yml` provides a fully self-hosted alternative.

---

## Skill Details

### `user-onboarding/SKILL.md`

**Trigger:** Standing Order — fires when `user_profile_{{user.id}}` is absent from memory.

**Flow:**
1. Greet the user and explain the assistant's purpose
2. Ask 4 questions **sequentially** (domains → level → goals → timezone)
3. Handle vague answers with clarifying follow-ups
4. Store the profile in memory under `user_profile_{{user.id}}`
5. Confirm the stored data back to the user

**Memory schema:**
```json
{
  "domains": ["string"],
  "level": "junior | mid-level | senior | staff",
  "goals": ["string"],
  "timezone": "IANA timezone string"
}
```

### `daily-quiz/SKILL.md`

**Trigger:** Cron job `nightly-tech-brief` at 21:00 in the user's timezone.

**Flow:**
1. Load user profile from memory
2. Load recent topics log (for de-duplication)
3. `web_search` + `web_fetch` for each domain
4. Synthesise 3–5 tidbits from real article content
5. Generate 5 level-calibrated, varied interview questions
6. Update the recent topics log in memory
7. Send the formatted Telegram message

**Telegram message format:**
```
📚 *Your Daily Tech Brief — Monday, 14 July 2025*
---
🎯 *Interview Questions*
*[Domain]* Q1. ...
*[Domain]* Q2. ...
...
---
💡 *Today's Tidbits*
*1.* Title — Insight...
...
```

---

## Testing Your Setup

### Test 1 — Onboarding Flow

1. Open Telegram and message your bot
2. Send "Hello" — the onboarding skill should start
3. Complete all 4 questions
4. Verify the profile was stored:

```bash
# If running via Docker:
docker compose exec openclaw openclaw memory get "user_profile_YOUR_USER_ID"

# If running locally:
openclaw memory get "user_profile_YOUR_USER_ID"
```

### Test 2 — Manual Daily Brief Trigger

Don't wait until 9 PM — trigger the cron job immediately:

```bash
# Docker
docker compose exec openclaw openclaw cron trigger "nightly-tech-brief"

# Local
openclaw cron trigger "nightly-tech-brief"
```

You should receive the formatted message in Telegram within ~30–60 seconds.

### Test 3 — Verify Cron Jobs

```bash
docker compose exec openclaw openclaw cron list
```

You should see `nightly-tech-brief` with the correct schedule and timezone.

---

## Troubleshooting

**Bot doesn't respond to messages**
- Check `docker compose logs openclaw` for errors
- Verify `TELEGRAM_BOT_TOKEN` is correctly set in `.env`
- Ensure no other process is polling the same bot token

**Ollama model not available**
- Wait for the `ollama-init` container to finish pulling the model (check: `docker compose logs ollama-init`)
- Manually pull: `docker compose exec ollama ollama pull llama3:8b`

**Agent ignores SKILL.md instructions**
- Try a more capable model (switch from `llama3:8b` to `llama3:70b` or a cloud model)
- Simplify any ambiguous language in the skill file
- Check that skills are mounted correctly: `docker compose exec openclaw ls /app/skills`

**Cron job didn't run at scheduled time**
- Confirm job exists: `openclaw cron list`
- Check gateway was running at the scheduled time in logs
- Manually trigger to test the action: `openclaw cron trigger "nightly-tech-brief"`

**Memory not persisting across restarts**
- Confirm the Docker volume is mounted: `docker volume ls | grep openclaw`
- Check write permissions on `/data/memory` inside the container

---

## Project Structure

```
openclaw-learning-assistant/
│
├── skills/
│   ├── user-onboarding/
│   │   └── SKILL.md          # Onboarding interview skill
│   └── daily-quiz/
│       └── SKILL.md          # Daily brief generation skill
│
├── config/
│   └── openclaw.json         # Main OpenClaw configuration (no secrets)
│
├── docker/
│   └── searxng/              # Optional SearXNG config (if self-hosting search)
│
├── Dockerfile                # Multi-stage Docker image for the agent
├── docker-compose.yml        # Orchestrates agent + Ollama + (optional) SearXNG
├── .env.example              # Template for required environment variables
├── .gitignore                # Excludes .env, node_modules, logs, etc.
└── README.md                 # This file
```

---

## Licence

MIT — see [LICENSE](LICENSE) for details.
