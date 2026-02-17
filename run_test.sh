#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_ROOT"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.test.yml"
TEST_DB_URL="postgresql://treenisofta:treenisofta_dev@localhost:5433/treenisofta_test"
TEST_JWT_SECRET="test-jwt-secret-do-not-use-in-production"

# Ensure dependencies are up-to-date
source scripts/common.sh
ensure_dependencies

cleanup() {
  echo "Cleaning up..."
  docker compose -f "$COMPOSE_FILE" --profile e2e down || true
}
trap cleanup EXIT INT TERM

echo ""
echo "=== Step 1: Backend integration tests ==="

echo "Starting test database..."
docker compose -f "$COMPOSE_FILE" up -d --wait
echo "Database is ready."

echo "Generating Prisma client..."
cd "$PROJECT_ROOT/backend"
npx prisma generate

echo "Running migrations..."
DATABASE_URL="$TEST_DB_URL" npx prisma migrate deploy

echo "Running backend tests..."
DATABASE_URL="$TEST_DB_URL" \
JWT_SECRET="$TEST_JWT_SECRET" \
PORT=3001 \
NODE_ENV=test \
npx vitest run "$@"

echo "Backend tests passed."

echo ""
echo "=== Step 2: Building Docker image ==="
cd "$PROJECT_ROOT"

docker compose -f "$COMPOSE_FILE" --profile e2e build app

echo "Docker image built."

echo ""
echo "=== Step 3: E2E tests against Docker image ==="

# Clean and re-seed test database for E2E
cd "$PROJECT_ROOT"
docker compose -f "$COMPOSE_FILE" exec -T postgres-test psql -U treenisofta -d treenisofta_test -c \
  "TRUNCATE users, exercises, workout_plans, training_maxes, workouts, workout_sets, plan_days, plan_day_exercises, plan_sets, plan_progression_rules, user_plans RESTART IDENTITY CASCADE"

cd "$PROJECT_ROOT/backend"
DATABASE_URL="$TEST_DB_URL" npx tsx prisma/seed.ts

# Start the app container alongside the DB, wait for both to be healthy
cd "$PROJECT_ROOT"
docker compose -f "$COMPOSE_FILE" --profile e2e up -d --wait
echo "App is healthy."

# Ensure Playwright browsers are installed
npx playwright install --with-deps chromium 2>/dev/null || npx playwright install chromium

# Run Playwright E2E tests pointing at port 3002 (avoids conflict with dev backend on 3001)
BASE_URL="http://localhost:3002" npx playwright test

echo ""
echo "=== All tests passed! ==="
exit 0
