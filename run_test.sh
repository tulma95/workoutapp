#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.test.yml"
TEST_DB_URL="postgresql://treenisofta:treenisofta_dev@localhost:5433/treenisofta_test"
TEST_JWT_SECRET="test-jwt-secret-do-not-use-in-production"

# Track background process PIDs
BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  echo "Cleaning up..."

  # Kill background processes
  if [ -n "$BACKEND_PID" ]; then
    echo "Stopping backend server (PID: $BACKEND_PID)..."
    kill $BACKEND_PID 2>/dev/null || true
  fi

  if [ -n "$FRONTEND_PID" ]; then
    echo "Stopping frontend dev server (PID: $FRONTEND_PID)..."
    kill $FRONTEND_PID 2>/dev/null || true
  fi

  echo "Stopping test database..."
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

echo "Running backend tests..."
cd "$PROJECT_ROOT"
TEST_EXIT_CODE=0
DATABASE_URL="$TEST_DB_URL" \
JWT_SECRET="$TEST_JWT_SECRET" \
PORT=3001 \
NODE_ENV=test \
npm test -w backend || TEST_EXIT_CODE=$?

if [ $TEST_EXIT_CODE -ne 0 ]; then
  echo "Backend tests failed. Exiting."
  exit $TEST_EXIT_CODE
fi

echo "Backend tests passed. Starting servers for E2E tests..."

# Kill any existing processes on ports 3001 and 5173
echo "Checking for processes on ports 3001 and 5173..."
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true
sleep 1

# Build backend
echo "Building backend..."
npm run build -w backend

# Start backend server
echo "Starting backend server on port 3001..."
cd "$PROJECT_ROOT/backend"
DATABASE_URL="$TEST_DB_URL" \
JWT_SECRET="$TEST_JWT_SECRET" \
PORT=3001 \
NODE_ENV=test \
node dist/index.js > "$PROJECT_ROOT/backend-test.log" 2>&1 &
BACKEND_PID=$!
echo "Backend server started (PID: $BACKEND_PID)"

# Start frontend dev server
echo "Starting frontend dev server on port 5173..."
cd "$PROJECT_ROOT/frontend"
npm run dev > "$PROJECT_ROOT/frontend-test.log" 2>&1 &
FRONTEND_PID=$!
echo "Frontend dev server started (PID: $FRONTEND_PID)"

# Wait for backend to be ready
echo "Waiting for backend server to be ready..."
for i in $(seq 1 30); do
  if curl -s http://localhost:3001/api/health >/dev/null 2>&1; then
    echo "Backend server is ready."
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "Backend server failed to become ready in time."
    echo "Backend logs:"
    cat "$PROJECT_ROOT/backend-test.log" || true
    exit 1
  fi
  sleep 1
done

# Wait for frontend to be ready
echo "Waiting for frontend dev server to be ready..."
for i in $(seq 1 30); do
  if curl -s http://localhost:5173 >/dev/null 2>&1; then
    echo "Frontend dev server is ready."
    break
  fi
  if [ "$i" -eq 30 ]; then
    echo "Frontend dev server failed to become ready in time."
    echo "Frontend logs:"
    cat "$PROJECT_ROOT/frontend-test.log" || true
    exit 1
  fi
  sleep 1
done

# Run Playwright E2E tests
echo "Running Playwright E2E tests..."
cd "$PROJECT_ROOT"
E2E_EXIT_CODE=0
npx playwright test || E2E_EXIT_CODE=$?

if [ $E2E_EXIT_CODE -ne 0 ]; then
  echo "E2E tests failed."
  exit $E2E_EXIT_CODE
fi

echo "All tests passed!"
exit 0
