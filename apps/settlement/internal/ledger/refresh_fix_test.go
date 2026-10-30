package ledger

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// insertBatchWithLine inserts one settlement batch in the given status plus one
// scheme export line carrying the gross amount. net_payout_fils is gross minus fee.
func insertBatchWithLine(t *testing.T, pool *pgxpool.Pool, merchantID uuid.UUID, batchDate string, status string, grossFils, feeFils int64) {
	t.Helper()
	ctx := context.Background()

	var batchID uuid.UUID
	netFils := grossFils - feeFils
	err := pool.QueryRow(ctx, `
		INSERT INTO settlement_batches (merchant_id, batch_date, status, gross_fils, fee_fils, net_payout_fils, closed_at, paid_at)
		VALUES (
		  $1, $2, $3, $4, $5, $6,
		  CASE WHEN $3 IN ('closed', 'paid') THEN now() ELSE NULL END,
		  CASE WHEN $3 = 'paid' THEN now() ELSE NULL END
		)
		RETURNING id
	`, merchantID, batchDate, status, grossFils, feeFils, netFils).Scan(&batchID)
	if err != nil {
		t.Fatalf("insertBatchWithLine: insert batch: %v", err)
	}

	_, err = pool.Exec(ctx, `
		INSERT INTO scheme_export_lines (settlement_batch_id, amount_fils, line_sequence)
		VALUES ($1, $2, 1)
	`, batchID, grossFils)
	if err != nil {
		t.Fatalf("insertBatchWithLine: insert export line: %v", err)
	}
}

func TestM9_RefreshUsesNetNotGross(t *testing.T) {
	pool := mustPool(t)
	merchantID := insertActiveMerchant(t, pool)

	insertBatchWithLine(t, pool, merchantID, "2026-07-01", "closed", 100000, 2250)
	want := int64(100000 - 2250)

	diffs, err := RefreshBalanceCache(context.Background(), pool)
	if err != nil {
		t.Fatalf("RefreshBalanceCache: %v", err)
	}

	diff, ok := diffs[merchantID]
	if !ok {
		t.Fatalf("RefreshBalanceCache did not return a diff for merchant %s", merchantID)
	}
	if int64(diff.Rebuilt) != want {
		t.Errorf("M9: Rebuilt = %d, want %d (rebuild must use closed-batch net, not gross export lines)", diff.Rebuilt, want)
	}

	var persisted int64
	err = pool.QueryRow(context.Background(), `SELECT cached_payable_fils FROM merchant_balances WHERE merchant_id = $1`, merchantID).Scan(&persisted)
	if err != nil {
		t.Fatalf("query persisted balance: %v", err)
	}
	if persisted != want {
		t.Errorf("M9: persisted cached_payable_fils = %d, want %d (rebuild must use closed-batch net, not gross export lines)", persisted, want)
	}
}

func TestM9_RefreshExcludesPaidBatches(t *testing.T) {
	pool := mustPool(t)
	merchantID := insertActiveMerchant(t, pool)

	insertBatchWithLine(t, pool, merchantID, "2026-07-01", "paid", 50000, 1250)
	insertBatchWithLine(t, pool, merchantID, "2026-07-02", "closed", 20000, 500)
	want := int64(20000 - 500)

	diffs, err := RefreshBalanceCache(context.Background(), pool)
	if err != nil {
		t.Fatalf("RefreshBalanceCache: %v", err)
	}

	diff, ok := diffs[merchantID]
	if !ok {
		t.Fatalf("RefreshBalanceCache did not return a diff for merchant %s", merchantID)
	}
	if int64(diff.Rebuilt) != want {
		t.Errorf("M9: Rebuilt = %d, want %d (rebuild must exclude paid batches and use closed-batch net, not gross export lines)", diff.Rebuilt, want)
	}

	var persisted int64
	err = pool.QueryRow(context.Background(), `SELECT cached_payable_fils FROM merchant_balances WHERE merchant_id = $1`, merchantID).Scan(&persisted)
	if err != nil {
		t.Fatalf("query persisted balance: %v", err)
	}
	if persisted != want {
		t.Errorf("M9: persisted cached_payable_fils = %d, want %d (rebuild must exclude paid batches and use closed-batch net, not gross export lines)", persisted, want)
	}
}

func TestM9_RefreshExcludesOpenBatches(t *testing.T) {
	pool := mustPool(t)
	merchantID := insertActiveMerchant(t, pool)

	insertBatchWithLine(t, pool, merchantID, "2026-07-01", "open", 30000, 0)
	insertBatchWithLine(t, pool, merchantID, "2026-07-02", "closed", 10000, 250)
	want := int64(10000 - 250)

	diffs, err := RefreshBalanceCache(context.Background(), pool)
	if err != nil {
		t.Fatalf("RefreshBalanceCache: %v", err)
	}

	diff, ok := diffs[merchantID]
	if !ok {
		t.Fatalf("RefreshBalanceCache did not return a diff for merchant %s", merchantID)
	}
	if int64(diff.Rebuilt) != want {
		t.Errorf("M9: Rebuilt = %d, want %d (rebuild must exclude open batches and use closed-batch net, not gross export lines)", diff.Rebuilt, want)
	}

	var persisted int64
	err = pool.QueryRow(context.Background(), `SELECT cached_payable_fils FROM merchant_balances WHERE merchant_id = $1`, merchantID).Scan(&persisted)
	if err != nil {
		t.Fatalf("query persisted balance: %v", err)
	}
	if persisted != want {
		t.Errorf("M9: persisted cached_payable_fils = %d, want %d (rebuild must exclude open batches and use closed-batch net, not gross export lines)", persisted, want)
	}
}

func TestM9_RefreshAllPaidGivesZero(t *testing.T) {
	pool := mustPool(t)
	merchantID := insertActiveMerchant(t, pool)

	_, err := pool.Exec(context.Background(), `
		INSERT INTO merchant_balances (merchant_id, cached_payable_fils, updated_at)
		VALUES ($1, 0, now())
	`, merchantID)
	if err != nil {
		t.Fatalf("seed cache at zero: %v", err)
	}

	insertBatchWithLine(t, pool, merchantID, "2026-07-01", "paid", 40000, 1000)
	want := int64(0)

	diffs, err := RefreshBalanceCache(context.Background(), pool)
	if err != nil {
		t.Fatalf("RefreshBalanceCache: %v", err)
	}

	diff, ok := diffs[merchantID]
	if !ok {
		t.Fatalf("RefreshBalanceCache did not return a diff for merchant %s", merchantID)
	}
	if int64(diff.Rebuilt) != want {
		t.Errorf("M9: Rebuilt = %d, want %d (rebuild must exclude paid batches; all-paid merchant has nothing payable)", diff.Rebuilt, want)
	}
	if diff.Changed() {
		t.Errorf("M9: diff.Changed() = true, want false (cache already 0 and the settled position is 0)")
	}

	var persisted int64
	err = pool.QueryRow(context.Background(), `SELECT cached_payable_fils FROM merchant_balances WHERE merchant_id = $1`, merchantID).Scan(&persisted)
	if err != nil {
		t.Fatalf("query persisted balance: %v", err)
	}
	if persisted != want {
		t.Errorf("M9: persisted cached_payable_fils = %d, want %d (rebuild must exclude paid batches; all-paid merchant has nothing payable)", persisted, want)
	}
}

func TestM9_RefreshReflectsRecalculatedFee(t *testing.T) {
	pool := mustPool(t)
	merchantID := insertActiveMerchant(t, pool)

	insertBatchWithLine(t, pool, merchantID, "2026-07-01", "closed", 80000, 2000)

	// Mirror what Recalculate MDR does to a closed batch: the fee and net change,
	// the gross export line does not.
	_, err := pool.Exec(context.Background(), `
		UPDATE settlement_batches SET fee_fils = 1600, net_payout_fils = 78400
		WHERE merchant_id = $1
	`, merchantID)
	if err != nil {
		t.Fatalf("recalculate fee on closed batch: %v", err)
	}
	want := int64(78400)

	diffs, err := RefreshBalanceCache(context.Background(), pool)
	if err != nil {
		t.Fatalf("RefreshBalanceCache: %v", err)
	}

	diff, ok := diffs[merchantID]
	if !ok {
		t.Fatalf("RefreshBalanceCache did not return a diff for merchant %s", merchantID)
	}
	if int64(diff.Rebuilt) != want {
		t.Errorf("M9: Rebuilt = %d, want %d (rebuild must use the recalculated closed-batch net, not gross export lines)", diff.Rebuilt, want)
	}

	var persisted int64
	err = pool.QueryRow(context.Background(), `SELECT cached_payable_fils FROM merchant_balances WHERE merchant_id = $1`, merchantID).Scan(&persisted)
	if err != nil {
		t.Fatalf("query persisted balance: %v", err)
	}
	if persisted != want {
		t.Errorf("M9: persisted cached_payable_fils = %d, want %d (rebuild must use the recalculated closed-batch net, not gross export lines)", persisted, want)
	}
}

func TestM9_RefreshSumsClosedBatchesWithoutCacheRow(t *testing.T) {
	pool := mustPool(t)
	merchantID := insertActiveMerchant(t, pool)

	// No merchant_balances row yet: the rebuild must still find the merchant
	// through its closed batches and create the row.
	insertBatchWithLine(t, pool, merchantID, "2026-07-20", "closed", 30000, 750)
	insertBatchWithLine(t, pool, merchantID, "2026-07-21", "closed", 12340, 309)
	want := int64((30000 - 750) + (12340 - 309))

	diffs, err := RefreshBalanceCache(context.Background(), pool)
	if err != nil {
		t.Fatalf("RefreshBalanceCache: %v", err)
	}

	diff, ok := diffs[merchantID]
	if !ok {
		t.Fatalf("M9: RefreshBalanceCache did not return a diff for merchant %s (closed batches, no cache row)", merchantID)
	}
	if int64(diff.Rebuilt) != want {
		t.Errorf("M9: Rebuilt = %d, want %d (sum of closed-batch nets)", diff.Rebuilt, want)
	}

	var persisted int64
	err = pool.QueryRow(context.Background(), `SELECT cached_payable_fils FROM merchant_balances WHERE merchant_id = $1`, merchantID).Scan(&persisted)
	if err != nil {
		t.Fatalf("M9: query persisted balance: %v", err)
	}
	if persisted != want {
		t.Errorf("M9: persisted cached_payable_fils = %d, want %d", persisted, want)
	}
}
