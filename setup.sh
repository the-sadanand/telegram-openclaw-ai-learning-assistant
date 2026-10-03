#!/usr/bin/env bash
set -euo pipefail

BOLD='\033[1m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info() { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

echo ""
echo -e "${BOLD}OpenClaw Personalised Learning Assistant — Setup${NC}"
echo ""

command -v docker >/dev/null 2>&1 || error "Docker is not installed."
docker compose version >/dev/null 2>&1 || error "Docker Compose v2 is required."

if [ -f ".env" ]; then
  warn ".env already exists — keeping it."
else
  cp .env.example .env
  info "Created .env from .env.example"
fi

if grep -q "your_telegram_bot_token_here" .env; then
  read -rp "Paste your Telegram Bot Token: " BOT_TOKEN
  [ -n "$BOT_TOKEN" ] || error "Telegram token cannot be empty."
  sed -i.bak "s|your_telegram_bot_token_here|${BOT_TOKEN}|" .env
  rm -f .env.bak
fi

if grep -q "your_gemini_api_key_here" .env; then
  read -rp "Paste your Gemini API key: " GEMINI_KEY
  [ -n "$GEMINI_KEY" ] || error "Gemini API key cannot be empty."
  sed -i.bak "s|your_gemini_api_key_here|${GEMINI_KEY}|" .env
  rm -f .env.bak
fi

docker compose up -d --build
echo ""
info "Services started."
info "Health: http://localhost:3000/health"
info "Logs:   docker compose logs -f openclaw"
echo ""
