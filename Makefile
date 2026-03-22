.PHONY: help \
        test test-unit test-integration test-cov \
        test-db-up test-db-down test-db-wait \
        frontend-test frontend-test-cov \
        dev

# ── Default target ────────────────────────────────────────────────────────────
help:
	@echo ""
	@echo "Usage: make <target>"
	@echo ""
	@echo "  dev               Start full dev stack (docker-compose up)"
	@echo ""
	@echo "  test              Run all backend tests (starts/stops test DB)"
	@echo "  test-unit         Run backend unit tests only (no DB required)"
	@echo "  test-integration  Run backend integration tests (starts/stops test DB)"
	@echo "  test-cov          Run all backend tests with coverage report"
	@echo ""
	@echo "  frontend-test     Run all frontend Jest tests"
	@echo "  frontend-test-cov Run frontend tests with coverage report"
	@echo ""
	@echo "  test-db-up        Start the ephemeral test database"
	@echo "  test-db-down      Stop and remove the ephemeral test database"
	@echo ""

# ── Dev stack ─────────────────────────────────────────────────────────────────
dev:
	docker-compose up

# ── Test DB lifecycle ─────────────────────────────────────────────────────────
test-db-up:
	docker-compose -f docker-compose.test.yml up -d
	@echo "Waiting for test database to be ready..."
	@docker-compose -f docker-compose.test.yml exec -T test-db \
	  sh -c 'until pg_isready -U postgres; do sleep 0.5; done'

test-db-down:
	docker-compose -f docker-compose.test.yml down

# ── Backend tests ─────────────────────────────────────────────────────────────

# Unit tests have no DB dependency — run immediately without spinning up Docker.
test-unit:
	cd apps/api && pytest tests/unit/ -v

# Integration + full suite need the test DB.
test-integration: test-db-up
	cd apps/api && pytest tests/integration/ -v; \
	EXIT=$$?; $(MAKE) test-db-down; exit $$EXIT

test: test-db-up
	cd apps/api && pytest tests/ -v; \
	EXIT=$$?; $(MAKE) test-db-down; exit $$EXIT

test-cov: test-db-up
	cd apps/api && pytest tests/ -v \
	  --cov=app \
	  --cov-report=term-missing \
	  --cov-report=xml:coverage.xml; \
	EXIT=$$?; $(MAKE) test-db-down; exit $$EXIT

# ── Frontend tests ────────────────────────────────────────────────────────────
frontend-test:
	cd apps/web && CI=true pnpm test

frontend-test-cov:
	cd apps/web && CI=true pnpm test -- --coverage
