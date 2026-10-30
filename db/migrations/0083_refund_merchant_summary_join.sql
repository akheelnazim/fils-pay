-- F15: 0072 joined transactions on t.id = r.id (a refund's own id), which never
-- matches, so the view was empty. Join on r.transaction_id, and count each
-- transaction's captured_fils once per day, not once per refund.
DROP MATERIALIZED VIEW refund_merchant_summary;

CREATE MATERIALIZED VIEW refund_merchant_summary AS
WITH refund_rows AS (
    SELECT
        r.merchant_id,
        date_trunc('day', r.occurred_at AT TIME ZONE 'Asia/Bahrain') AS business_date,
        r.amount_fils,
        r.fee_reversed_fils,
        t.captured_fils,
        ROW_NUMBER() OVER (
            PARTITION BY r.transaction_id, date_trunc('day', r.occurred_at AT TIME ZONE 'Asia/Bahrain')
            ORDER BY r.occurred_at, r.id
        ) AS nth_refund_of_txn_that_day
    FROM refunds r
    JOIN transactions t ON t.id = r.transaction_id
    WHERE r.status = 'succeeded'
)
SELECT
    merchant_id,
    business_date,
    COUNT(*)                                                          AS refund_count,
    SUM(amount_fils)                                                  AS total_refunded_fils,
    SUM(fee_reversed_fils)                                            AS total_fee_reversed_fils,
    SUM(captured_fils) FILTER (WHERE nth_refund_of_txn_that_day = 1)  AS original_captured_fils
FROM refund_rows
GROUP BY merchant_id, business_date;

CREATE UNIQUE INDEX idx_refund_merchant_summary_pk
    ON refund_merchant_summary (merchant_id, business_date);
