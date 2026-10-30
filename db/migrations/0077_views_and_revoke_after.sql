-- D1 / ADR-0005: 0054–0056 are reserved for settlement v2, and 0054_views.sql
-- failed on a fresh database (a view on settlement_batch_events, a table no
-- migration creates). Their content moves here, idempotent so a database that
-- already applied the old files ends up the same as a fresh one:
--   - v_active_api_keys (from 0054): kept.
--   - api_keys.revoke_after (from 0056): kept (S7 may use it).
--   - v_unbatched_capture_events (from 0054): dropped, it never worked.
--   - merchant_payable_position (from 0054): dropped; it summed gross export
--     lines and its only reader was replaced in M9.

CREATE OR REPLACE VIEW v_active_api_keys AS
SELECT ak.id,
       ak.merchant_id,
       ak.key_prefix,
       ak.created_at,
       ak.label
  FROM api_keys ak
 WHERE ak.revoked_at IS NULL;

ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS revoke_after timestamptz;

DROP VIEW IF EXISTS v_unbatched_capture_events;
DROP VIEW IF EXISTS merchant_payable_position;
