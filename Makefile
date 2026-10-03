# OpenClaw Learning Assistant
# Usage: make <target>

.PHONY: help setup up down logs restart trigger-brief memory-check shell lint-skills

help:
	@echo ""
	@echo "  OpenClaw Learning Assistant — Available Commands"
	@echo "  make setup          Run first-time setup"
	@echo "  make up             Start the service"
	@echo "  make down           Stop the service"
	@echo "  make restart        Restart the service"
	@echo "  make logs           Tail application logs"
	@echo "  make trigger-brief  Send a brief to onboarded users"
	@echo "  make memory-check   List stored memory keys"
	@echo "  make shell          Open a shell inside the container"
	@echo "  make lint-skills    Check SKILL.md files"
	@echo ""

setup:
	@bash setup.sh

up:
	docker compose up -d
	@echo "Service started."

down:
	docker compose down
	@echo "Service stopped."

restart:
	docker compose restart openclaw

logs:
	docker compose logs -f openclaw

trigger-brief:
	docker compose exec openclaw node cli.js trigger-brief

memory-check:
	docker compose exec openclaw node -e "import('./lib/memory.js').then(async m => { await m.initMemory(process.env.OPENCLAW_MEMORY_PATH || '/data/memory'); console.log(await m.listMemoryKeys()); })"

shell:
	docker compose exec openclaw /bin/sh

lint-skills:
	@test -s skills/user-onboarding/SKILL.md
	@test -s skills/daily-quiz/SKILL.md
	@echo "All skill files present."
