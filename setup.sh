#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────
# setup.sh — First-time setup script for OpenClaw Learning Assistant
# Run once after cloning the repository:  bash setup.sh
# ─────────────────────────────────────────────────────────────────
set -euo pipefail

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

info()    { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }
heading() { echo -e "\n${BOLD}$*${NC}"; }

# ── Banner ────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║       OpenClaw Personalised Learning Assistant           ║${NC}"
echo -e "${BOLD}║                 First-Time Setup                         ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# ── Prerequisite checks ───────────────────────────────────────────
heading "Step 1/5 — Checking prerequisites"

command -v docker &>/dev/null  || error "Docker is not installed. Visit https://docs.docker.com/get-docker/"
command -v docker &>/dev/null  && docker compose version &>/dev/null || \
  error "Docker Compose v2 is required. Update Docker Desktop or install the plugin."

info "Docker: $(docker --version)"
info "Docker Compose: $(docker compose version)"

# ── .env file ─────────────────────────────────────────────────────
heading "Step 2/5 — Environment configuration"

if [ -f ".env" ]; then
  warn ".env already exists — skipping copy. Edit it manually if needed."
else
  cp .env.example .env
  info "Created .env from .env.example"
fi

# Prompt for Telegram token if placeholder is still set
if grep -q "your_telegram_bot_token_here" .env; then
  echo ""
  echo -e "${YELLOW}You need a Telegram Bot Token to proceed.${NC}"
  echo "  1. Open Telegram and search for @BotFather"
  echo "  2. Send /newbot and follow the prompts"
  echo "  3. Copy the HTTP API Token provided"
  echo ""
  read -rp "Paste your Telegram Bot Token here: " BOT_TOKEN
  if [ -z "$BOT_TOKEN" ]; then
    error "Token cannot be empty. Re-run this script once you have a token."
  fi
  # Replace placeholder in .env (works on both Linux and macOS)
  sed -i.bak "s/your_telegram_bot_token_here/${BOT_TOKEN}/" .env && rm -f .env.bak
  info "Telegram Bot Token saved to .env"
fi

# ── LLM provider selection ────────────────────────────────────────
heading "Step 3/5 — LLM provider selection"

echo "Which LLM provider would you like to use?"
echo "  [1] Ollama — local, free, private (requires 8 GB+ RAM)"
echo "  [2] OpenAI — cloud (requires API key)"
echo "  [3] Anthropic — cloud (requires API key)"
echo ""
read -rp "Choose [1/2/3] (default: 1): " LLM_CHOICE
LLM_CHOICE="${LLM_CHOICE:-1}"

case "$LLM_CHOICE" in
  1)
    info "Using Ollama (local). No API key needed."
    ;;
  2)
    read -rp "Enter your OpenAI API key (sk-...): " OPENAI_KEY
    if [ -z "$OPENAI_KEY" ]; then error "API key cannot be empty."; fi
    echo "OPENAI_API_KEY=${OPENAI_KEY}" >> .env
    # Patch config to use openai
    sed -i.bak 's/"provider": "ollama"/"provider": "openai"/' config/openclaw.json
    sed -i.bak 's/"model": "llama3:8b"/"model": "gpt-4o"/' config/openclaw.json
    rm -f config/openclaw.json.bak
    info "OpenAI configured."
    ;;
  3)
    read -rp "Enter your Anthropic API key: " ANTHROPIC_KEY
    if [ -z "$ANTHROPIC_KEY" ]; then error "API key cannot be empty."; fi
    echo "ANTHROPIC_API_KEY=${ANTHROPIC_KEY}" >> .env
    sed -i.bak 's/"provider": "ollama"/"provider": "anthropic"/' config/openclaw.json
    sed -i.bak 's/"model": "llama3:8b"/"model": "claude-sonnet-4-20250514"/' config/openclaw.json
    rm -f config/openclaw.json.bak
    info "Anthropic configured."
    ;;
  *)
    warn "Invalid choice — defaulting to Ollama."
    ;;
esac

# ── Build and start ───────────────────────────────────────────────
heading "Step 4/5 — Building and starting services"

if [ "$LLM_CHOICE" = "1" ]; then
  info "Starting Ollama + OpenClaw (this may take 10–15 min on first run to download the model)..."
  docker compose up -d --build
else
  info "Starting OpenClaw without Ollama..."
  docker compose up -d --build openclaw
fi

# ── Health check ──────────────────────────────────────────────────
heading "Step 5/5 — Waiting for services to be ready"

MAX_WAIT=120
ELAPSED=0
echo -n "Waiting for OpenClaw gateway"
until docker compose logs openclaw 2>&1 | grep -q "Listening for messages" ; do
  sleep 3
  ELAPSED=$((ELAPSED + 3))
  echo -n "."
  if [ "$ELAPSED" -ge "$MAX_WAIT" ]; then
    echo ""
    warn "Gateway didn't report ready within ${MAX_WAIT}s."
    warn "Check logs with: docker compose logs -f openclaw"
    break
  fi
done
echo ""

if docker compose logs openclaw 2>&1 | grep -q "Listening for messages"; then
  info "Gateway is ready!"
fi

# ── Done ──────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║                    Setup Complete! 🎉                    ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "  Next steps:"
echo "  1. Open Telegram and find your bot"
echo "  2. Send it any message to start the onboarding"
echo "  3. Complete the 4 onboarding questions"
echo "  4. Your first Daily Tech Brief will arrive at 9 PM tonight!"
echo ""
echo "  Useful commands:"
echo "  • View logs:          docker compose logs -f openclaw"
echo "  • Trigger brief now:  docker compose exec openclaw openclaw cron trigger nightly-tech-brief"
echo "  • Stop everything:    docker compose down"
echo ""
