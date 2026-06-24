#!/usr/bin/env bash
set -euo pipefail
source scripts/common.sh

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_ROOT"

GHCR_USER="${GHCR_USER:?Set GHCR_USER to your GitHub username}"
IMAGE_NAME="ghcr.io/$GHCR_USER/treenisofta"
IMAGE_TAG="$(git rev-parse --short HEAD)"
FULL_TAG="$IMAGE_NAME:$IMAGE_TAG"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.test.yml"

cleanup() {
  echo "Cleaning up..."
  test_compose -f "$COMPOSE_FILE" --profile e2e down || true
}
trap cleanup EXIT INT TERM

run_audit_gate() {
  echo "=== Step 0: Production dependency audit ==="
  cd "$PROJECT_ROOT"
  # Fail the pipeline on any un-allowlisted advisory in the RUNTIME (--omit=dev)
  # dependency tree, before we build or push. The allowlist (by advisory ID, with
  # justifications) lives in scripts/audit-gate.mjs so a future moderate in the
  # serving path still fails instead of being globally tolerated.
  node scripts/audit-gate.mjs
}

run_backend_tests() {
  echo "=== Step 1: Backend integration tests ==="

  ensure_dependencies

  echo "Starting test database..."
  test_compose -f "$COMPOSE_FILE" up -d --wait
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
  VAPID_PUBLIC_KEY="$TEST_VAPID_PUBLIC_KEY" \
  VAPID_PRIVATE_KEY="$TEST_VAPID_PRIVATE_KEY" \
  npx vitest run

  echo "Backend tests passed."
}

build_image() {
  echo ""
  echo "=== Step 2: Building Docker image ==="
  cd "$PROJECT_ROOT"

  # The service worker is built by vite-plugin-pwa (injectManifest); its Workbox
  # precache is keyed on per-asset content revisions, so no manual cache-busting
  # stamp is needed.
  APP_IMAGE="$FULL_TAG" test_compose -f "$COMPOSE_FILE" --profile e2e build setforge

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
  APP_IMAGE="$FULL_TAG" test_compose -f "$COMPOSE_FILE" --profile e2e up -d --wait
  echo "App is healthy."

  # Ensure Playwright browsers are installed
  npx playwright install --with-deps webkit 2>/dev/null || npx playwright install webkit

  # Run Playwright E2E tests pointing at port 3002 (app container maps 3002:3001)
  BASE_URL="http://localhost:3002" npx playwright test

  echo "E2E tests passed."
}

push_image() {
  echo ""
  echo "=== Step 4: Pushing image to ghcr.io ==="
  docker tag "$FULL_TAG" "$IMAGE_NAME:latest"
  docker push "$FULL_TAG"
  docker push "$IMAGE_NAME:latest"
  echo "Pushed: $FULL_TAG and $IMAGE_NAME:latest"
}

main() {
  run_audit_gate
  run_backend_tests
  build_image
  run_e2e_tests
  push_image
  echo ""
  echo "=== Done ==="
  echo "Image ready: $FULL_TAG"
}

main
