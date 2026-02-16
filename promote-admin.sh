#!/bin/bash
# Promote an existing user to admin by email
# Usage: ./promote-admin.sh <email> <database_url>

set -euo pipefail

EMAIL="${1:?Usage: ./promote-admin.sh <email> <database_url>}"
DATABASE_URL="${2:?Usage: ./promote-admin.sh <email> <database_url>}"

psql "$DATABASE_URL" -c "UPDATE users SET is_admin = true WHERE email = '${EMAIL}';"
echo "Done. ${EMAIL} is now an admin."
