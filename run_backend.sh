#!/usr/bin/env bash
set -e

# Helper script that handles all backend prerequisites and starts the dev server.
# Expects environment variables (DATABASE_URL, JWT_SECRET, PORT, NODE_ENV) to be
# exported by the caller (e.g. start_local_env.sh).

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# Ensure dependencies are up-to-date
source scripts/common.sh
ensure_dependencies

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate -w backend

# Run database migrations
echo "Running database migrations..."
npx prisma migrate dev -w backend

# Start backend dev server
echo "Starting backend dev server..."
npm run dev -w backend
