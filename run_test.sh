#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_ROOT"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.test.yml"

# Ensure dependencies are up-to-date
source scripts/common.sh
ensure_dependencies

cleanup() {
  echo "Cleaning up..."
  test_compose -f "$COMPOSE_FILE" --profile e2e down || true
}
trap cleanup EXIT INT TERM

setup_db() {
  echo "Starting test database..."
  test_compose -f "$COMPOSE_FILE" up -d --wait
  echo "Database is ready."

  echo "Generating Prisma client..."
  cd "$PROJECT_ROOT/backend"
  npx prisma generate

  echo "Running migrations..."
  DATABASE_URL="$TEST_DB_URL" npx prisma migrate deploy
}

run_backend_tests() {
  echo ""
  echo "=== Backend integration tests ==="

  echo "Running backend tests..."
  cd "$PROJECT_ROOT/backend"
  DATABASE_URL="$TEST_DB_URL" \
  JWT_SECRET="$TEST_JWT_SECRET" \
  PORT=3001 \
  NODE_ENV=test \
  VAPID_PUBLIC_KEY="$TEST_VAPID_PUBLIC_KEY" \
  VAPID_PRIVATE_KEY="$TEST_VAPID_PRIVATE_KEY" \
  npx vitest run "$@"

  echo "Backend tests passed."
}

run_e2e_tests() {
  echo ""
  echo "=== Building Docker image ==="
  cd "$PROJECT_ROOT"

  test_compose -f "$COMPOSE_FILE" --profile e2e build setforge

  echo "Docker image built."

  echo ""
  echo "=== E2E tests against Docker image ==="

  # Clean and re-seed test database for E2E
  cd "$PROJECT_ROOT"
  test_compose -f "$COMPOSE_FILE" exec -T postgres-test psql -U treenisofta -d treenisofta_test -c \
    "TRUNCATE users, exercises, workout_plans, training_maxes, workouts, workout_sets, plan_days, plan_day_exercises, plan_sets, plan_progression_rules, user_plans RESTART IDENTITY CASCADE"

  cd "$PROJECT_ROOT/backend"
  npx tsc --project tsconfig.seed.json
  DATABASE_URL="$TEST_DB_URL" node dist-seed/prisma/seed.js

  # Start the app container alongside the DB, wait for both to be healthy
  cd "$PROJECT_ROOT"
  test_compose -f "$COMPOSE_FILE" --profile e2e up -d --wait
  echo "App is healthy."

  # Ensure Playwright browsers are installed
  npx playwright install --with-deps webkit 2>/dev/null || npx playwright install webkit

  # Run Playwright E2E tests pointing at port 3002 (avoids conflict with dev backend on 3001)
  BASE_URL="http://localhost:3002" npx playwright test ${E2E_ARGS[@]+"${E2E_ARGS[@]}"}
}

main() {
  # Separate backend vitest args from E2E playwright args
  # Use E2E_ARGS env var to pass args to Playwright, e.g.:
  #   E2E_ARGS="social-username" ./run_test.sh
  # Or pass args directly (forwarded to both backend vitest and Playwright):
  #   ./run_test.sh
  if [ -n "${E2E_ARGS:-}" ]; then
    # shellcheck disable=SC2206
    E2E_ARGS=($E2E_ARGS)
  else
    E2E_ARGS=()
  fi

  setup_db

  if [ "${SKIP_BACKEND:-}" != "1" ]; then
    run_backend_tests "$@"
  else
    echo "Skipping backend tests (SKIP_BACKEND=1)"
  fi

  if [ "${SKIP_E2E:-}" != "1" ]; then
    run_e2e_tests
  else
    echo "Skipping E2E tests (SKIP_E2E=1)"
  fi

  echo ""
  echo "=== All tests passed! ==="
}

main "$@"
