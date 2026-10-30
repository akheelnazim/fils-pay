-- F9: the daily rollup had nowhere to count refunds. refund_gross_fils is the
-- sum of refund amounts (not net of fee reversed), on the Asia/Bahrain day.
ALTER TABLE merchant_daily_volume
    ADD COLUMN refund_count      INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN refund_gross_fils BIGINT  NOT NULL DEFAULT 0;
