# Migration Policy

Development migrations are reviewed. Production uses expand/backfill/switch/contract, backups, rehearsal, lock-duration assessment, and forward recovery. Forbidden without approval: migrate reset, accept-data-loss, table rewrite on hot path, broad cascade, unbounded backfill, or raw manual production SQL.
