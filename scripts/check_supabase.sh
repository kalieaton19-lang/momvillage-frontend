#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/check_supabase.sh [URL]
# Defaults to http://localhost:3000/api/supabase/health

URL="${1:-http://localhost:3000/api/supabase/health}"

echo "Checking Supabase health at: $URL"

resp=$(curl -sS -w "\n%{http_code}" "$URL" || true)
body=$(echo "$resp" | sed '$d')
code=$(echo "$resp" | tail -n1)

if [ "$code" -eq 200 ]; then
  echo "OK — Supabase admin reachable"
  echo "$body"
  exit 0
else
  echo "ERROR — status: $code"
  echo "$body"
  exit 2
fi
