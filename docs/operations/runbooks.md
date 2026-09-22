# Operations Runbooks

Runbooks cover payment-entitlement mismatch, webhook backlog, invitation unavailable, RSVP rejects/duplicates, media processing stuck, WhatsApp rejection, printing vendor delay, shipping mismatch, domain certificate failure, database saturation, Redis outage, queue DLQ, and suspected data incident.

## Media upload / R2

1. **Provider unavailable:** confirm the four `STORAGE_*` variables are present in the affected environment and that the endpoint is HTTPS. The application fails closed and returns a safe provider-unavailable state; do not add credentials to logs.
2. **Upload stuck in `PENDING_UPLOAD`:** inspect the signed URL request and R2 CORS for the exact customer-web origin. Revoke/disable the feature if repeated failures indicate a provider outage.
3. **Metadata mismatch or `REJECTED`:** do not manually mark the row `READY`. Check the provider object's content length/type and retain the audit event for investigation.
4. **Orphan cleanup:** first run the bounded media cleanup dry-run for stale `PENDING_UPLOAD`/`UPLOADED` rows. Do not delete objects or rows from the dry-run. Destructive cleanup requires approved retention policy, database-owner approval, an audited scheduler, and idempotent storage deletion.
5. **Public image missing:** only `READY` assets are resolved. Check tenant/wedding scope, object existence, and short-lived read URL generation; do not make the bucket public as a workaround.
6. **Scanning/derivatives:** completion records `UPLOADED`; the worker must process `SCANNING` and `PROCESSING` before `READY`. The content inspector reads only a tenant-scoped range capped at 64 KiB and fails closed unless storage returns `206 Partial Content`. Retry provider failures. Never manually mark an asset `READY` after a signature, dimension, malware, or derivative failure.
7. **Editor status refresh:** the customer editor reads the tenant/wedding-scoped media list and polls only while an asset is non-terminal, with a maximum of 20 attempts at three-second intervals. If refresh fails, the UI shows a warning and does not invent a lifecycle state; investigate session/provider availability before asking the customer to retry.

## Analytics rate limiting and retention

1. **Limiter unavailable:** verify the injected shared Redis client and its network/TLS/auth configuration. The Redis adapter uses an atomic sliding-window script and the backend fails closed with `503 PROVIDER_UNAVAILABLE`; never replace it with a process-local counter.
2. **Rate limit spike:** inspect low-cardinality operation metrics (`ingest` or `report`) and the approved tenant/actor policy. Do not log or expose raw limiter keys, tenant IDs, actor IDs, or Redis credentials.
3. **Retention review:** run the bounded analytics retention dry-run for an approved cutoff and batch size. The dry-run only lists `AnalyticsEventAccepted` candidates; do not delete rows until Product, Privacy, Database, and Operations have approved the policy and audited scheduler.
4. **Malformed candidate:** stop the cleanup run if an accepted analytics row has no tenant scope or invalid payload. Retention must fail closed rather than deleting inconsistent data.
