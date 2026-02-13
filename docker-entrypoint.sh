#!/bin/sh
set -e

echo "Running database migrations..."
cd /app/backend
npx prisma migrate deploy

echo "Starting server..."
cd /app
exec node backend/dist/index.js
