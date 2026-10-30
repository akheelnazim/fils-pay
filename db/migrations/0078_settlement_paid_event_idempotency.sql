-- Duplicate settlement.paid outbox events can create duplicate merchant
-- webhooks. Keep the earliest event for each batch and retain removed rows
-- (including deliveries that reference them) in archive tables first.
--
-- Rollback: drop the unique index; restore archived outbox_events; restore
-- archived webhook_deliveries in created_at/id order; then drop the two
-- archive tables. Restore archived disbursements and drop their archive
-- table. Restore the outbox rows before their deliveries.

CREATE TABLE outbox_events_duplicates AS
SELECT oe.*, now() AS archived_at
  FROM outbox_events oe
 WITH NO DATA;

CREATE TABLE webhook_deliveries_duplicates AS
SELECT wd.*, now() AS archived_at
  FROM webhook_deliveries wd
 WITH NO DATA;

CREATE TABLE settlement_payout_disbursements_duplicates AS
SELECT d.*, now() AS archived_at
  FROM settlement_payout_disbursements d
 WITH NO DATA;

WITH ranked AS (
    SELECT id,
           row_number() OVER (PARTITION BY settlement_batch_id ORDER BY created_at, id) AS position
      FROM settlement_payout_disbursements
)
INSERT INTO settlement_payout_disbursements_duplicates
SELECT d.*, now()
  FROM settlement_payout_disbursements d
  JOIN ranked r ON r.id = d.id
 WHERE r.position > 1;

DELETE FROM settlement_payout_disbursements d
 USING settlement_payout_disbursements_duplicates archived
 WHERE d.id = archived.id;

WITH ranked AS (
    SELECT id,
           row_number() OVER (PARTITION BY aggregate_id ORDER BY created_at, id) AS position
      FROM outbox_events
     WHERE event_type = 'settlement.paid'
)
INSERT INTO outbox_events_duplicates
SELECT oe.*, now()
  FROM outbox_events oe
  JOIN ranked r ON r.id = oe.id
 WHERE r.position > 1;

WITH duplicates AS (
    SELECT id
      FROM outbox_events_duplicates
)
INSERT INTO webhook_deliveries_duplicates
SELECT wd.*, now()
  FROM webhook_deliveries wd
  JOIN duplicates d ON d.id = wd.outbox_event_id;

DELETE FROM webhook_deliveries wd
 USING outbox_events_duplicates d
 WHERE wd.outbox_event_id = d.id;

DELETE FROM outbox_events oe
 USING outbox_events_duplicates d
 WHERE oe.id = d.id;

CREATE UNIQUE INDEX outbox_events_settlement_paid_once
    ON outbox_events (aggregate_id)
 WHERE event_type = 'settlement.paid';
