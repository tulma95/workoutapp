#!/usr/bin/env bash
set -euo pipefail
source scripts/common.sh

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_ROOT"

IMAGE_NAME="treenisofta"
IMAGE_TAG="$(git rev-parse --short HEAD)"
FULL_TAG="$IMAGE_NAME:$IMAGE_TAG"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.test.yml"
TEST_DB_URL="postgresql://treenisofta:treenisofta_dev@localhost:5433/treenisofta_test"
TEST_JWT_SECRET="test-jwt-secret-do-not-use-in-production"

cleanup() {
  echo "Cleaning up..."
  docker compose -f "$COMPOSE_FILE" --profile e2e down || true
}
trap cleanup EXIT INT TERM

run_backend_tests() {
  echo "=== Step 1: Backend integration tests ==="

  ensure_dependencies

  echo "Starting test database..."
  docker compose -f "$COMPOSE_FILE" up -d --wait
  echo "Database is ready."

  echo "Generating Prisma client..."
  cd "$PROJECT_ROOT/backend"
  npx prisma generate

  echo "Running migrations on test database..."
  DATABASE_URL="$TEST_DB_URL" npx prisma migrate deploy

  echo "Running backend tests..."
  DATABASE_URL="$TEST_DB_URL" \
  JWT_SECRET="$TEST_JWT_SECRET" \
  PORT=3001 \
  NODE_ENV=test \
  npx vitest run

  echo "Backend tests passed."
}

build_image() {
  echo ""
  echo "=== Step 2: Building Docker image ==="
  cd "$PROJECT_ROOT"

  APP_IMAGE="$FULL_TAG" docker compose -f "$COMPOSE_FILE" --profile e2e build app

  echo "Docker image built: $FULL_TAG"
}

run_e2e_tests() {
  echo ""
  echo "=== Step 3: E2E tests against Docker image ==="

  # Reset test database for E2E
  cd "$PROJECT_ROOT/backend"
  DATABASE_URL="$TEST_DB_URL" npx prisma migrate reset --force

  # Seed test database
  DATABASE_URL="$TEST_DB_URL" npx tsx prisma/seed.ts

  # Start the app container alongside the DB, wait for both to be healthy
  cd "$PROJECT_ROOT"
  APP_IMAGE="$FULL_TAG" docker compose -f "$COMPOSE_FILE" --profile e2e up -d --wait
  echo "App is healthy."

  # Run Playwright E2E tests pointing at port 3001 (app serves both API and frontend)
  BASE_URL="http://localhost:3001" npx playwright test

  echo "E2E tests passed."
}

main() {
  run_backend_tests
  build_image
  run_e2e_tests
  echo ""
  echo "=== Done ==="
  echo "Image ready: $FULL_TAG"
}

main
