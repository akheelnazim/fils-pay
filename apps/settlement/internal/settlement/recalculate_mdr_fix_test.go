package settlement

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// m8Fixture is one merchant with a captured batch whose fee was frozen at
// mdr_bps 250, after which the merchant's rate was raised to 300 so a
// recalculation pass would produce a different fee.
type m8Fixture struct {
	merchantID   uuid.UUID
	batchID      uuid.UUID
	businessDate time.Time
	grossFils    int64
	feeBefore    int64
	netBefore    int64
	cachedBefore int64
	wantNewFee   int64
}

// m8Setup closes a batch on businessDate, optionally marks it paid, reads
// the batch and cache figures the recalculation must (or must not) move,
// then raises the merchant's MDR so RecalculateMDR computes a different fee.
func m8Setup(t *testing.T, pool *pgxpool.Pool, markPaid bool) m8Fixture {
	t.Helper()
	ctx := context.Background()
	const originalMdrBps = 250
	const newMdrBps = 300
	merchantID := insertActiveMerchant(t, pool, originalMdrBps)

	businessDate := time.Date(2026, 4, 6, 0, 0, 0, 0, time.UTC)
	start, _ := BusinessDayWindow(businessDate)
	// Same three events as TestRecalculateMDR_RecomputesAtCurrentRate so the
	// per-event rounding differs from a single pre-summed rate.
	insertCaptureEvent(t, pool, merchantID, originalMdrBps, 4750, start.Add(time.Hour))
	insertCaptureEvent(t, pool, merchantID, originalMdrBps, 1333, start.Add(2*time.Hour))
	insertCaptureEvent(t, pool, merchantID, originalMdrBps, 999, start.Add(3*time.Hour))

	closed, err := CloseBatch(ctx, pool, merchantID, businessDate)
	if err != nil {
		t.Fatalf("CloseBatch: %v", err)
	}

	if markPaid {
		if _, err := pool.Exec(ctx, `UPDATE settlement_batches SET status = 'paid', paid_at = now() WHERE id = $1`, closed.BatchID); err != nil {
			t.Fatalf("mark batch paid: %v", err)
		}
	}

	f := m8Fixture{
		merchantID:   merchantID,
		batchID:      closed.BatchID,
		businessDate: businessDate,
		grossFils:    int64(closed.GrossFils),
		wantNewFee: int64(ComputeSettlementFee(4750, newMdrBps, 0) +
			ComputeSettlementFee(1333, newMdrBps, 0) +
			ComputeSettlementFee(999, newMdrBps, 0)),
	}
	if err := pool.QueryRow(ctx, `SELECT fee_fils, net_payout_fils FROM settlement_batches WHERE id = $1`, closed.BatchID).
		Scan(&f.feeBefore, &f.netBefore); err != nil {
		t.Fatalf("read batch before recalculation: %v", err)
	}
	if err := pool.QueryRow(ctx, `SELECT cached_payable_fils FROM merchant_balances WHERE merchant_id = $1`, merchantID).
		Scan(&f.cachedBefore); err != nil {
		t.Fatalf("read merchant_balances before recalculation: %v", err)
	}

	if _, err := pool.Exec(ctx, `UPDATE merchants SET mdr_bps = $2 WHERE id = $1`, merchantID, newMdrBps); err != nil {
		t.Fatalf("update mdr_bps: %v", err)
	}
	return f
}

// TestM8_PaidBatchFiguresUnchanged: a paid batch keeps the fee and net payout
// it was paid at, even though the rate changed.
func TestM8_PaidBatchFiguresUnchanged(t *testing.T) {
	pool := mustPool(t)
	ctx := context.Background()
	f := m8Setup(t, pool, true)

	from, to := recalcWindow(f.businessDate)
	if _, err := RecalculateMDR(ctx, pool, f.merchantID, from, to); err != nil {
		t.Fatalf("RecalculateMDR: %v", err)
	}

	var gotFee, gotNet int64
	if err := pool.QueryRow(ctx, `SELECT fee_fils, net_payout_fils FROM settlement_batches WHERE id = $1`, f.batchID).
		Scan(&gotFee, &gotNet); err != nil {
		t.Fatalf("read paid batch after recalculation: %v", err)
	}
	if gotFee != f.feeBefore {
		t.Errorf("paid batch fee_fils = %d, want %d (unchanged; new rate would give %d)", gotFee, f.feeBefore, f.wantNewFee)
	}
	if gotNet != f.netBefore {
		t.Errorf("paid batch net_payout_fils = %d, want %d (unchanged)", gotNet, f.netBefore)
	}
}

// TestM8_PaidBatchCacheUnchanged: a paid batch's payout already left, so the
// merchant_balances cached payable must not move.
func TestM8_PaidBatchCacheUnchanged(t *testing.T) {
	pool := mustPool(t)
	ctx := context.Background()
	f := m8Setup(t, pool, true)

	from, to := recalcWindow(f.businessDate)
	if _, err := RecalculateMDR(ctx, pool, f.merchantID, from, to); err != nil {
		t.Fatalf("RecalculateMDR: %v", err)
	}

	var gotCached int64
	if err := pool.QueryRow(ctx, `SELECT cached_payable_fils FROM merchant_balances WHERE merchant_id = $1`, f.merchantID).
		Scan(&gotCached); err != nil {
		t.Fatalf("read merchant_balances after recalculation: %v", err)
	}
	if gotCached != f.cachedBefore {
		t.Errorf("merchant_balances.cached_payable_fils = %d, want %d (unchanged for a paid batch)", gotCached, f.cachedBefore)
	}
}

// TestM8_PaidBatchStillJournaled: a paid batch's difference is still posted
// as a balanced two-leg adjustment and still reported, with Status "paid".
func TestM8_PaidBatchStillJournaled(t *testing.T) {
	pool := mustPool(t)
	ctx := context.Background()
	f := m8Setup(t, pool, true)

	from, to := recalcWindow(f.businessDate)
	result, err := RecalculateMDR(ctx, pool, f.merchantID, from, to)
	if err != nil {
		t.Fatalf("RecalculateMDR: %v", err)
	}

	var legs int64
	if err := pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM ledger_entries
		 WHERE merchant_id = $1 AND description = 'MDR recalculation adjustment'
		   AND settlement_batch_id = $2
	`, f.merchantID, f.batchID).Scan(&legs); err != nil {
		t.Fatalf("count adjustment legs: %v", err)
	}
	if legs != 2 {
		t.Errorf("adjustment legs for paid batch = %d, want 2", legs)
	}

	var net int64
	if err := pool.QueryRow(ctx, `
		SELECT COALESCE(SUM(CASE WHEN direction = 'debit' THEN amount_fils ELSE -amount_fils END), 0)
		  FROM ledger_entries
		 WHERE merchant_id = $1 AND description = 'MDR recalculation adjustment'
		   AND settlement_batch_id = $2
	`, f.merchantID, f.batchID).Scan(&net); err != nil {
		t.Fatalf("sum adjustment legs: %v", err)
	}
	if net != 0 {
		t.Errorf("adjustment legs net %d fils, want 0 (debits - credits)", net)
	}

	if len(result.Adjusted) != 1 {
		t.Fatalf("len(Adjusted) = %d, want 1", len(result.Adjusted))
	}
	adj := result.Adjusted[0]
	if adj.BatchID != f.batchID {
		t.Errorf("adjusted BatchID = %s, want %s", adj.BatchID, f.batchID)
	}
	if adj.Status != "paid" {
		t.Errorf("adjusted Status = %q, want \"paid\"", adj.Status)
	}
	if adj.DiffFils == 0 {
		t.Errorf("adjusted DiffFils = 0, want nonzero")
	}
	if int64(adj.NewFeeFils) != f.wantNewFee {
		t.Errorf("adjusted NewFeeFils = %d, want %d", adj.NewFeeFils, f.wantNewFee)
	}
}

// TestM8_ClosedBatchStillUpdated: an unpaid (closed) batch is still
// re-derived and its row rewritten, so the fix does not stop normal
// recalculation.
func TestM8_ClosedBatchStillUpdated(t *testing.T) {
	pool := mustPool(t)
	ctx := context.Background()
	f := m8Setup(t, pool, false)

	from, to := recalcWindow(f.businessDate)
	if _, err := RecalculateMDR(ctx, pool, f.merchantID, from, to); err != nil {
		t.Fatalf("RecalculateMDR: %v", err)
	}

	var gotFee, gotNet int64
	if err := pool.QueryRow(ctx, `SELECT fee_fils, net_payout_fils FROM settlement_batches WHERE id = $1`, f.batchID).
		Scan(&gotFee, &gotNet); err != nil {
		t.Fatalf("read closed batch after recalculation: %v", err)
	}
	if gotFee != f.wantNewFee {
		t.Errorf("closed batch fee_fils = %d, want %d", gotFee, f.wantNewFee)
	}
	if wantNet := f.grossFils - f.wantNewFee; gotNet != wantNet {
		t.Errorf("closed batch net_payout_fils = %d, want %d", gotNet, wantNet)
	}
}

// m8PaidAdjustmentNet is the fee already booked on a batch by MDR adjustments
// (credits to platform_fee_revenue minus debits), in fils.
func m8PaidAdjustmentNet(t *testing.T, pool *pgxpool.Pool, batchID uuid.UUID) int64 {
	t.Helper()
	var net int64
	if err := pool.QueryRow(context.Background(), `
		SELECT COALESCE(SUM(CASE WHEN direction = 'credit' THEN amount_fils ELSE -amount_fils END), 0)
		  FROM ledger_entries
		 WHERE settlement_batch_id = $1 AND account_id = 'platform_fee_revenue'
		   AND description = 'MDR recalculation adjustment'
	`, batchID).Scan(&net); err != nil {
		t.Fatalf("sum fee adjustments: %v", err)
	}
	return net
}

// TestM8_PaidBatchRerunPostsNothing: the paid batch's fee_fils no longer
// moves, so a second pass at the same rate must not post the difference again.
func TestM8_PaidBatchRerunPostsNothing(t *testing.T) {
	pool := mustPool(t)
	ctx := context.Background()
	f := m8Setup(t, pool, true)

	from, to := recalcWindow(f.businessDate)
	if _, err := RecalculateMDR(ctx, pool, f.merchantID, from, to); err != nil {
		t.Fatalf("RecalculateMDR (first): %v", err)
	}
	second, err := RecalculateMDR(ctx, pool, f.merchantID, from, to)
	if err != nil {
		t.Fatalf("RecalculateMDR (second): %v", err)
	}

	if got, want := m8PaidAdjustmentNet(t, pool, f.batchID), f.wantNewFee-f.feeBefore; got != want {
		t.Errorf("fee booked by adjustments after two runs = %d, want %d (posted once)", got, want)
	}
	if len(second.Adjusted) != 0 {
		t.Errorf("second run Adjusted = %d entries, want 0", len(second.Adjusted))
	}
}

// TestM8_PaidBatchSecondRateChangePostsOnlyTheDifference: after a later rate
// change, only the gap between the new fee and the fee already booked is posted.
func TestM8_PaidBatchSecondRateChangePostsOnlyTheDifference(t *testing.T) {
	pool := mustPool(t)
	ctx := context.Background()
	f := m8Setup(t, pool, true)

	from, to := recalcWindow(f.businessDate)
	if _, err := RecalculateMDR(ctx, pool, f.merchantID, from, to); err != nil {
		t.Fatalf("RecalculateMDR (300 bps): %v", err)
	}
	if _, err := pool.Exec(ctx, `UPDATE merchants SET mdr_bps = 200 WHERE id = $1`, f.merchantID); err != nil {
		t.Fatalf("update mdr_bps: %v", err)
	}
	result, err := RecalculateMDR(ctx, pool, f.merchantID, from, to)
	if err != nil {
		t.Fatalf("RecalculateMDR (200 bps): %v", err)
	}

	fee200 := int64(ComputeSettlementFee(4750, 200, 0) + ComputeSettlementFee(1333, 200, 0) + ComputeSettlementFee(999, 200, 0))
	if got, want := m8PaidAdjustmentNet(t, pool, f.batchID), fee200-f.feeBefore; got != want {
		t.Errorf("fee booked by adjustments = %d, want %d (paid fee %d, current fee %d)", got, want, f.feeBefore, fee200)
	}
	if len(result.Adjusted) != 1 {
		t.Fatalf("len(Adjusted) = %d, want 1", len(result.Adjusted))
	}
	if adj := result.Adjusted[0]; int64(adj.OldFeeFils) != f.wantNewFee || int64(adj.NewFeeFils) != fee200 {
		t.Errorf("adjusted old/new = %d/%d, want %d/%d (old = fee already booked)", adj.OldFeeFils, adj.NewFeeFils, f.wantNewFee, fee200)
	}
}

// TestM8_ClosedThenPaidBatchNotDoubleCounted: an adjustment made while the
// batch was still closed is already in its fee_fils, so once the batch is
// paid a re-run at the same rate posts nothing.
func TestM8_ClosedThenPaidBatchNotDoubleCounted(t *testing.T) {
	pool := mustPool(t)
	ctx := context.Background()
	f := m8Setup(t, pool, false)

	from, to := recalcWindow(f.businessDate)
	if _, err := RecalculateMDR(ctx, pool, f.merchantID, from, to); err != nil {
		t.Fatalf("RecalculateMDR (closed): %v", err)
	}
	if _, err := pool.Exec(ctx, `UPDATE settlement_batches SET status = 'paid', paid_at = now() WHERE id = $1`, f.batchID); err != nil {
		t.Fatalf("mark batch paid: %v", err)
	}
	result, err := RecalculateMDR(ctx, pool, f.merchantID, from, to)
	if err != nil {
		t.Fatalf("RecalculateMDR (paid): %v", err)
	}
	if len(result.Adjusted) != 0 {
		t.Errorf("Adjusted = %d entries, want 0 (closed-time adjustment already in fee_fils)", len(result.Adjusted))
	}
	if got, want := m8PaidAdjustmentNet(t, pool, f.batchID), f.wantNewFee-f.feeBefore; got != want {
		t.Errorf("fee booked by adjustments = %d, want %d", got, want)
	}
}
