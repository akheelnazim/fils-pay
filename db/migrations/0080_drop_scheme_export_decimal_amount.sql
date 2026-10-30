-- Keep scheme money in integer fils (ADR-0001), while preserving the exact
-- amount previously written to the scheme file for historical re-exports.
-- Normally exported_amount_fils equals amount_fils; older rows may differ
-- because earlier exports rounded the gross amount instead of truncating it.
ALTER TABLE scheme_export_lines
    ADD COLUMN exported_amount_fils BIGINT;

UPDATE scheme_export_lines
   SET exported_amount_fils = CASE
       WHEN amount IS NULL THEN amount_fils
       ELSE (amount * 1000)::bigint
   END;

ALTER TABLE scheme_export_lines
    ALTER COLUMN exported_amount_fils SET NOT NULL,
    ADD CONSTRAINT scheme_export_lines_exported_amount_fils_check
        CHECK (exported_amount_fils >= 0 AND exported_amount_fils % 10 = 0),
    DROP COLUMN amount;
