-- M5: merchants.lifetime_net_payout_monitoring_estimate was REAL (0040) and
-- bumped in float32, so above 2^24 fils single fils were lost and large
-- totals drifted. Integer fils like every other money column (ADR-0001).
-- Existing values keep their drift, rounded to whole fils.
ALTER TABLE merchants
    ALTER COLUMN lifetime_net_payout_monitoring_estimate TYPE BIGINT
    USING round(lifetime_net_payout_monitoring_estimate)::bigint;
