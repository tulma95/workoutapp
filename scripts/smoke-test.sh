#!/bin/bash

PASS=0
FAIL=0

check() {
  local label="$1"
  local result="$2"

  if [ "$result" -eq 0 ]; then
    echo "PASS: $label"
    PASS=$((PASS + 1))
  else
    echo "FAIL: $label"
    FAIL=$((FAIL + 1))
  fi
}

# Check PostgreSQL
if command -v pg_isready &> /dev/null; then
  pg_isready -h localhost -p 5432 -q
  check "PostgreSQL accepting connections on port 5432" $?
else
  (echo > /dev/tcp/localhost/5432) 2>/dev/null
  check "PostgreSQL accepting connections on port 5432" $?
fi

# Check backend health endpoint
HEALTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health 2>/dev/null)
HEALTH_BODY=$(curl -s http://localhost:3001/api/health 2>/dev/null)

if [ "$HEALTH_RESPONSE" = "200" ] && echo "$HEALTH_BODY" | grep -q '"database":"connected"'; then
  check "Backend health endpoint (200 with database: connected)" 0
else
  check "Backend health endpoint (200 with database: connected)" 1
fi

# Check frontend
FRONTEND_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5173 2>/dev/null)
if [ "$FRONTEND_RESPONSE" = "200" ]; then
  check "Frontend serving on port 5173" 0
else
  check "Frontend serving on port 5173" 1
fi

echo ""
echo "Results: $PASS passed, $FAIL failed"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi

exit 0
