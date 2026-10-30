-- F22: a refund waiting on the acquirer is a 'pending' row (written before the
-- acquirer call, turned into 'succeeded' or 'failed' after it), and
-- transactions.pending_refund_fils says how much of refunded_fils is still
-- pending. refunded_fils keeps counting pending + succeeded, so refund
-- validation (F3) is unchanged.
ALTER TABLE refunds DROP CONSTRAINT refunds_status_check;
ALTER TABLE refunds ADD CONSTRAINT refunds_status_check CHECK (status IN ('pending', 'succeeded', 'failed'));

ALTER TABLE transactions
    ADD COLUMN pending_refund_fils BIGINT NOT NULL DEFAULT 0 CHECK (pending_refund_fils >= 0);
