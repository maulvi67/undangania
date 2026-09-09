#!/usr/bin/env sh
set -eu
if grep -RInE '(sk_live_|BEGIN PRIVATE KEY|PAYMENT_SERVER_KEY=.{8,})' --exclude-dir=node_modules --exclude='.env.example' .; then
  echo "Potential secret found" >&2; exit 1
fi
echo "No obvious secrets found"
