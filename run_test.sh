#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.test.yml"
TEST_DB_URL="postgresql://treenisofta:treenisofta_dev@localhost:5433/treenisofta_test"

cleanup() {
  echo "Cleaning up test containers..."
  docker compose -f "$COMPOSE_FILE" down 2>/dev/null || true
}
trap cleanup EXIT

echo "Starting test database..."
docker compose -f "$COMPOSE_FILE" up -d

echo "Waiting for database to be ready..."
for i in $(seq 1 30); do
  if docker compose -f "$COMPOSE_FILE" exec -T postgres-test pg_isready -U treenisofta -d treenisofta_test >/dev/null 2>&1; then
    echo "Database is ready."
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "Database failed to become ready in time."
    exit 1
  fi
  sleep 1
done

echo "Running migrations..."
cd "$PROJECT_ROOT/backend"
DATABASE_URL="$TEST_DB_URL" npx prisma migrate deploy

echo "Running tests..."
cd "$PROJECT_ROOT"
TEST_EXIT_CODE=0
DATABASE_URL="$TEST_DB_URL" \
JWT_SECRET="test-jwt-secret-do-not-use-in-production" \
PORT=3001 \
NODE_ENV=test \
npm test -w backend || TEST_EXIT_CODE=$?

exit $TEST_EXIT_CODE
