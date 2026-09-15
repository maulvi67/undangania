#!/usr/bin/env sh
set -eu

pattern='(sk_live_[[:alnum:]_-]{16,}|BEGIN PRIVATE KEY|PAYMENT_SERVER_KEY=[^[:space:]]{8,})'

matches=$(find . \
  -path './.git' -prune -o \
  -path './node_modules' -prune -o \
  -path './.next' -prune -o \
  -path './.turbo' -prune -o \
  -path './dist' -prune -o \
  -path './coverage' -prune -o \
  -path './playwright-report' -prune -o \
  -path './test-results' -prune -o \
  -path './.ai/reports' -prune -o \
  -path './.ai/memory/local' -prune -o \
  -type f \
  ! -name '*.log' \
  ! -name '.env.example' \
  ! -path './scripts/check-secrets.sh' \
  -exec grep -nIE "$pattern" {} + || true)

if [ -n "$matches" ]; then
  printf '%s\n' "$matches" >&2
  echo "Potential secret found" >&2
  exit 1
fi

echo "No obvious secrets found"
