package settlement

import (
	"context"
	"testing"

	"github.com/filspay/settlement/internal/money"
)

func TestM17_UnrepresentableFeeReturnsError(t *testing.T) {
	if _, err := computeSettlementFeeChecked(money.Fils(1<<63-1), 20000, 0); err == nil {
		t.Fatal("expected error for fee outside int64")
	}
}

func TestM17_RecalculateOverflowRollsBack(t *testing.T) {
	pool := mustPool(t)
	ctx := context.Background()
	f := m8Setup(t, pool, false)
	const minInt64 = int64(-1 << 63)
	if _, err := pool.Exec(ctx, `UPDATE settlement_batches SET fee_fils = $2 WHERE id = $1`, f.batchID, minInt64); err != nil {
		t.Fatalf("set boundary fixture: %v", err)
	}
	var before int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM ledger_entries WHERE settlement_batch_id = $1`, f.batchID).Scan(&before); err != nil {
		t.Fatalf("count ledger entries: %v", err)
	}
	from, to := recalcWindow(f.businessDate)
	if _, err := RecalculateMDR(ctx, pool, f.merchantID, from, to); err == nil {
		t.Fatal("expected overflow error")
	}
	var after int
	var fee, cache int64
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM ledger_entries WHERE settlement_batch_id = $1`, f.batchID).Scan(&after); err != nil {
		t.Fatalf("count ledger entries after: %v", err)
	}
	if err := pool.QueryRow(ctx, `SELECT fee_fils FROM settlement_batches WHERE id = $1`, f.batchID).Scan(&fee); err != nil {
		t.Fatalf("read fee: %v", err)
	}
	if err := pool.QueryRow(ctx, `SELECT cached_payable_fils FROM merchant_balances WHERE merchant_id = $1`, f.merchantID).Scan(&cache); err != nil {
		t.Fatalf("read cache: %v", err)
	}
	if after != before || fee != minInt64 || cache != f.cachedBefore {
		t.Fatalf("overflow changed state: ledger %d -> %d, fee %d, cache %d", before, after, fee, cache)
	}
}
