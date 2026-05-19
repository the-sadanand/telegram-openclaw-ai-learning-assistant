# ─────────────────────────────────────────────────────────────────
# Makefile — OpenClaw Learning Assistant
# Usage: make <target>
# ─────────────────────────────────────────────────────────────────

.PHONY: help setup up down logs restart \
        trigger-brief memory-check \
        shell pull-model lint-skills

# Default target — show help
help:
	@echo ""
	@echo "  OpenClaw Learning Assistant — Available Commands"
	@echo "  ─────────────────────────────────────────────────"
	@echo "  make setup          Run first-time setup (interactive)"
	@echo "  make up             Start all services"
	@echo "  make down           Stop all services"
	@echo "  make restart        Restart the OpenClaw agent only"
	@echo "  make logs           Tail OpenClaw gateway logs"
	@echo "  make trigger-brief  Manually trigger the nightly tech brief"
	@echo "  make memory-check   List all keys in persistent memory"
	@echo "  make pull-model     Pull/update the Ollama LLM model"
	@echo "  make shell          Open a shell inside the OpenClaw container"
	@echo "  make lint-skills    Check that all SKILL.md files exist and are non-empty"
	@echo ""

# ── Lifecycle ─────────────────────────────────────────────────────

setup:
	@bash setup.sh

up:
	docker compose up -d
	@echo "Services started. Use 'make logs' to watch."

down:
	docker compose down
	@echo "Services stopped."

restart:
	docker compose restart openclaw
	@echo "OpenClaw agent restarted."

logs:
	docker compose logs -f openclaw

# ── Testing ───────────────────────────────────────────────────────

trigger-brief:
	@echo "Triggering nightly-tech-brief cron job..."
	docker compose exec openclaw openclaw cron trigger nightly-tech-brief

memory-check:
	@echo "Listing all memory keys:"
	docker compose exec openclaw openclaw memory list

# ── Model management ──────────────────────────────────────────────

pull-model:
	@echo "Pulling llama3:8b model via Ollama..."
	docker compose exec ollama ollama pull llama3:8b

# ── Development ───────────────────────────────────────────────────

shell:
	docker compose exec openclaw /bin/sh

lint-skills:
	@echo "Checking skill files..."
	@test -s skills/user-onboarding/SKILL.md \
		&& echo "  ✅  skills/user-onboarding/SKILL.md — OK" \
		|| (echo "  ❌  skills/user-onboarding/SKILL.md — MISSING or EMPTY" && exit 1)
	@test -s skills/daily-quiz/SKILL.md \
		&& echo "  ✅  skills/daily-quiz/SKILL.md — OK" \
		|| (echo "  ❌  skills/daily-quiz/SKILL.md — MISSING or EMPTY" && exit 1)
	@echo "All skill files present."
