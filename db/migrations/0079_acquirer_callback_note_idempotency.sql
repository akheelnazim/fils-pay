-- callbackId is stable across acquirer retries. Retain the first note for an
-- ID and archive later duplicates before enforcing one note per callback.
--
-- Rollback: DROP INDEX acquirer_callback_notes_callback_id_key; restore
-- archived rows with their original columns from
-- acquirer_callback_notes_duplicates; DROP the archive table.

CREATE TABLE acquirer_callback_notes_duplicates AS
SELECT n.*, now() AS archived_at
  FROM acquirer_callback_notes n
 WITH NO DATA;

LOCK TABLE acquirer_callback_notes IN SHARE ROW EXCLUSIVE MODE;

WITH ranked AS (
    SELECT id,
           row_number() OVER (PARTITION BY callback_id ORDER BY created_at, id) AS position
      FROM acquirer_callback_notes
)
INSERT INTO acquirer_callback_notes_duplicates
SELECT n.*, now()
  FROM acquirer_callback_notes n
  JOIN ranked r ON r.id = n.id
 WHERE r.position > 1;

DELETE FROM acquirer_callback_notes n
 USING acquirer_callback_notes_duplicates archived
 WHERE n.id = archived.id;

CREATE UNIQUE INDEX acquirer_callback_notes_callback_id_key
    ON acquirer_callback_notes (callback_id);
