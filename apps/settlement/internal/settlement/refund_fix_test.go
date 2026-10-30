package settlement

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/filspay/settlement/internal/money"
)

// F8: CloseBatch ignored refunds, so the payout paid out money the merchant
// had already given back. Refunds are taken off net_payout_fils (amount less
// the fee reversed); a refund bigger than the day's net waits for the next
// batch instead of driving the payout negative.

func insertRefund(t *testing.T, merchantID, txnID uuid.UUID, amount, feeReversed int64, occurredAt time.Time) uuid.UUID {
	t.Helper()
	var id uuid.UUID
	err := mustPool(t).QueryRow(context.Background(), `
		INSERT INTO refunds (transaction_id, merchant_id, amount_fils, fee_reversed_fils, status, acquirer_reference,
		                     reason, created_by_type, created_by_id, occurred_at)
		VALUES ($1, $2, $3, $4, 'succeeded', $5, 'unspecified', 'merchant_session', $6, $7)
		RETURNING id
	`, txnID, merchantID, amount, feeReversed, "acq-refund-"+uuid.New().String(), uuid.New(), occurredAt).Scan(&id)
	if err != nil {
		t.Fatalf("insertRefund: %v", err)
	}
	return id
}

func refundBatch(t *testing.T, refundID uuid.UUID) *uuid.UUID {
	t.Helper()
	var b *uuid.UUID
	if err := mustPool(t).QueryRow(context.Background(),
		`SELECT settlement_batch_id FROM refunds WHERE id = $1`, refundID).Scan(&b); err != nil {
		t.Fatalf("read refund batch: %v", err)
	}
	return b
}

func TestF8_RefundReducesNetPayout(t *testing.T) {
	pool := mustPool(t)
	ctx := context.Background()
	merchantID := insertActiveMerchant(t, pool, 250)
	day := time.Date(2026, 5, 10, 0, 0, 0, 0, time.UTC)
	start, _ := BusinessDayWindow(day)
	txnID, _ := insertCaptureEvent(t, pool, merchantID, 250, 10_000, start.Add(time.Hour))
	refundID := insertRefund(t, merchantID, txnID, 4_000, 100, start.Add(2*time.Hour))

	res, err := CloseBatch(ctx, pool, merchantID, day)
	if err != nil {
		t.Fatalf("CloseBatch: %v", err)
	}
	if res.NetPayoutFils != money.Fils(5_850) { // 9 750 - (4 000 - 100)
		t.Errorf("net payout = %d, want 5850", res.NetPayoutFils)
	}
	if b := refundBatch(t, refundID); b == nil || *b != res.BatchID {
		t.Errorf("refund batch = %v, want %s", b, res.BatchID)
	}
	again, err := CloseBatch(ctx, pool, merchantID, day)
	if err != nil || !again.AlreadyClosed || again.NetPayoutFils != 5_850 {
		t.Errorf("re-close = %+v, %v; want a no-op with net 5850", again, err)
	}
}

func TestF8_RefundBiggerThanTheDayWaitsForTheNextBatch(t *testing.T) {
	pool := mustPool(t)
	ctx := context.Background()
	merchantID := insertActiveMerchant(t, pool, 250)
	day1 := time.Date(2026, 5, 11, 0, 0, 0, 0, time.UTC)
	day2 := day1.AddDate(0, 0, 1)
	start1, _ := BusinessDayWindow(day1)
	start2, _ := BusinessDayWindow(day2)
	oldTxn, _ := insertCaptureEvent(t, pool, merchantID, 250, 10_000, start1.Add(-48*time.Hour))
	insertCaptureEvent(t, pool, merchantID, 250, 1_000, start1.Add(time.Hour)) // day 1 net 975
	refundID := insertRefund(t, merchantID, oldTxn, 4_000, 100, start1.Add(2*time.Hour))
	insertCaptureEvent(t, pool, merchantID, 250, 10_000, start2.Add(time.Hour)) // day 2 net 9 750

	r1, err := CloseBatch(ctx, pool, merchantID, day1)
	if err != nil {
		t.Fatalf("CloseBatch day 1: %v", err)
	}
	if r1.NetPayoutFils != 975 {
		t.Errorf("day 1 net = %d, want 975 (refund of 3900 does not fit)", r1.NetPayoutFils)
	}
	if b := refundBatch(t, refundID); b != nil {
		t.Errorf("refund was batched into %s on day 1; it should wait", b)
	}
	r2, err := CloseBatch(ctx, pool, merchantID, day2)
	if err != nil {
		t.Fatalf("CloseBatch day 2: %v", err)
	}
	if r2.NetPayoutFils != 5_850 {
		t.Errorf("day 2 net = %d, want 5850 (9750 - 3900)", r2.NetPayoutFils)
	}
	if b := refundBatch(t, refundID); b == nil || *b != r2.BatchID {
		t.Errorf("refund batch = %v, want day 2's %s", b, r2.BatchID)
	}
}

func TestF8_RefundAtBahrain2330BelongsToThatBahrainDay(t *testing.T) {
	pool := mustPool(t)
	ctx := context.Background()
	merchantID := insertActiveMerchant(t, pool, 250)
	day := time.Date(2026, 5, 12, 0, 0, 0, 0, time.UTC)
	start, end := BusinessDayWindow(day)
	txnID, _ := insertCaptureEvent(t, pool, merchantID, 250, 10_000, start.Add(time.Hour))
	inDay := insertRefund(t, merchantID, txnID, 1_000, 25, end.Add(-30*time.Minute)) // 23:30 Bahrain
	nextDay := insertRefund(t, merchantID, txnID, 500, 12, end.Add(time.Minute))     // 00:01 next day

	res, err := CloseBatch(ctx, pool, merchantID, day)
	if err != nil {
		t.Fatalf("CloseBatch: %v", err)
	}
	if res.NetPayoutFils != 8_775 { // 9 750 - 975
		t.Errorf("net payout = %d, want 8775", res.NetPayoutFils)
	}
	if b := refundBatch(t, inDay); b == nil {
		t.Error("23:30 refund should be in this day's batch")
	}
	if b := refundBatch(t, nextDay); b != nil {
		t.Error("00:01 refund belongs to the next day")
	}
}

// F8: RecalculateMDR rebuilt an unpaid batch's net as gross - fee, which
// silently put the refunds it had deducted back into the payout.
func TestF8_RecalculateMDRKeepsTheRefundDeduction(t *testing.T) {
	pool := mustPool(t)
	ctx := context.Background()
	merchantID := insertActiveMerchant(t, pool, 250)
	day := time.Date(2026, 5, 13, 0, 0, 0, 0, time.UTC)
	start, _ := BusinessDayWindow(day)
	txnID, _ := insertCaptureEvent(t, pool, merchantID, 250, 10_000, start.Add(time.Hour))
	insertRefund(t, merchantID, txnID, 4_000, 100, start.Add(2*time.Hour))
	res, err := CloseBatch(ctx, pool, merchantID, day)
	if err != nil || res.NetPayoutFils != 5_850 {
		t.Fatalf("CloseBatch = %+v, %v; want net 5850", res, err)
	}
	if _, err := pool.Exec(ctx, `UPDATE merchants SET mdr_bps = 300 WHERE id = $1`, merchantID); err != nil {
		t.Fatalf("update mdr_bps: %v", err)
	}

	from, to := recalcWindow(day)
	if _, err := RecalculateMDR(ctx, pool, merchantID, from, to); err != nil {
		t.Fatalf("RecalculateMDR: %v", err)
	}
	var net int64
	if err := pool.QueryRow(ctx, `SELECT net_payout_fils FROM settlement_batches WHERE id = $1`, res.BatchID).Scan(&net); err != nil {
		t.Fatalf("read net: %v", err)
	}
	if net != 5_800 { // fee 250 -> 300 moves the net by 50; the refund stays deducted (9 700 if it were dropped)
		t.Errorf("net after recalculation = %d, want 5800", net)
	}
}

// F16 (found reviewing F8): a batch whose refunds took the net down to 0 went
// negative when RecalculateMDR then raised the fee.
func TestF16_RecalculateMDRNeverMakesTheNetNegative(t *testing.T) {
	pool := mustPool(t)
	ctx := context.Background()
	merchantID := insertActiveMerchant(t, pool, 250)
	day := time.Date(2026, 5, 14, 0, 0, 0, 0, time.UTC)
	start, _ := BusinessDayWindow(day)
	txnID, _ := insertCaptureEvent(t, pool, merchantID, 250, 10_000, start.Add(time.Hour))
	insertRefund(t, merchantID, txnID, 10_000, 250, start.Add(2*time.Hour)) // returns 9 750
	res, err := CloseBatch(ctx, pool, merchantID, day)
	if err != nil || res.NetPayoutFils != 0 {
		t.Fatalf("CloseBatch = %+v, %v; want net 0", res, err)
	}
	var cachedBefore int64
	if err := pool.QueryRow(ctx, `SELECT cached_payable_fils FROM merchant_balances WHERE merchant_id = $1`, merchantID).Scan(&cachedBefore); err != nil {
		t.Fatalf("read cache: %v", err)
	}
	if _, err := pool.Exec(ctx, `UPDATE merchants SET mdr_bps = 300 WHERE id = $1`, merchantID); err != nil {
		t.Fatalf("update mdr_bps: %v", err)
	}

	from, to := recalcWindow(day)
	if _, err := RecalculateMDR(ctx, pool, merchantID, from, to); err != nil {
		t.Fatalf("RecalculateMDR: %v", err)
	}
	var net, cachedAfter int64
	if err := pool.QueryRow(ctx, `SELECT net_payout_fils FROM settlement_batches WHERE id = $1`, res.BatchID).Scan(&net); err != nil {
		t.Fatalf("read net: %v", err)
	}
	if err := pool.QueryRow(ctx, `SELECT cached_payable_fils FROM merchant_balances WHERE merchant_id = $1`, merchantID).Scan(&cachedAfter); err != nil {
		t.Fatalf("read cache: %v", err)
	}
	if net != 0 {
		t.Errorf("net after recalculation = %d, want 0 (never negative)", net)
	}
	if cachedAfter != cachedBefore {
		t.Errorf("payable cache moved %d -> %d, but the batch net didn't change", cachedBefore, cachedAfter)
	}
}
