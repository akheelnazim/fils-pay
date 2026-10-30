package settlement

import (
	"context"
	"testing"

	"github.com/filspay/settlement/internal/splits"
	"github.com/google/uuid"
)

func TestM20_MonthlyEstimateUsesActualPayouts(t *testing.T) {
	pool := mustPool(t)
	ctx := context.Background()
	merchantID := insertActiveMerchant(t, pool, 250)
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback(ctx)

	for i, tc := range []struct {
		net         int64
		payouts     []int64
		description string
		old         bool
	}{
		{10000, []int64{10000}, "settlement payout: batch paid", false},
		{10000, []int64{5000, 5000}, "settlement payout: split to sub-merchant", false},
		{10000, []int64{2500}, "settlement payout: split to sub-merchant", false},
		{0, nil, "settlement payout: split to sub-merchant", false},
		{3000, []int64{3000}, "settlement payout: batch paid", true},
	} {
		var batchID uuid.UUID
		days := 0
		if tc.old {
			days = 31
		}
		if err := tx.QueryRow(ctx, `INSERT INTO settlement_batches (merchant_id, batch_date, status, gross_fils, net_payout_fils, paid_at) VALUES ($1, current_date - $2::int, 'paid', $3, $3, now() - ($4::int * interval '1 day')) RETURNING id`, merchantID, i+1, tc.net, days).Scan(&batchID); err != nil {
			t.Fatal(err)
		}
		for _, amount := range tc.payouts {
			if _, err := tx.Exec(ctx, `INSERT INTO ledger_entries (entry_group_id, merchant_id, settlement_batch_id, account_id, direction, amount_fils, occurred_at, description) VALUES ($1, $2, $3, 'merchant_payable', 'debit', $4, now(), $5), ($1, $2, $3, 'platform_cash', 'credit', $4, now(), $5)`, uuid.New(), merchantID, batchID, amount, tc.description); err != nil {
				t.Fatal(err)
			}
		}
	}
	got, err := EstimateMonthlyPayout(ctx, tx, merchantID)
	if err != nil {
		t.Fatal(err)
	}
	if got != 22500 {
		t.Fatalf("monthly estimate = %d, want 22500 actual paid fils", got)
	}
}

func TestM20_UnknownHistoricalPayoutReturnsError(t *testing.T) {
	pool := mustPool(t)
	ctx := context.Background()
	merchantID := insertActiveMerchant(t, pool, 250)
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback(ctx)
	var batchID uuid.UUID
	if err := tx.QueryRow(ctx, `INSERT INTO settlement_batches (merchant_id, batch_date, status, gross_fils, net_payout_fils, paid_at) VALUES ($1, current_date, 'paid', 1, 1, now()) RETURNING id`, merchantID).Scan(&batchID); err != nil {
		t.Fatal(err)
	}
	if _, err := EstimateMonthlyPayout(ctx, tx, merchantID); err == nil {
		t.Fatal("missing payout record must not be silently treated as zero")
	}
	if _, err := tx.Exec(ctx, `INSERT INTO ledger_entries (entry_group_id, merchant_id, settlement_batch_id, account_id, direction, amount_fils, occurred_at, description) VALUES ($1, $2, $3, 'merchant_payable', 'debit', 1, now(), 'legacy payout'), ($1, $2, $3, 'platform_cash', 'credit', 1, now(), 'legacy payout')`, uuid.New(), merchantID, batchID); err != nil {
		t.Fatal(err)
	}
	if _, err := EstimateMonthlyPayout(ctx, tx, merchantID); err == nil {
		t.Fatal("unrecognized payout description must not be silently ignored")
	}
}

func TestM20_RealOrdinaryAndSplitPayouts(t *testing.T) {
	pool := mustPool(t)
	ctx := context.Background()
	merchantID := insertActiveMerchant(t, pool, 250)
	childID := insertActiveMerchant(t, pool, 250)
	if _, err := pool.Exec(ctx, `INSERT INTO merchant_split_children (parent_merchant_id, child_merchant_id, split_weight_bps) VALUES ($1, $2, 2500)`, merchantID, childID); err != nil {
		t.Fatal(err)
	}
	var ordinary, split, zeroSplit uuid.UUID
	if err := pool.QueryRow(ctx, `INSERT INTO settlement_batches (merchant_id, batch_date, status, gross_fils, net_payout_fils) VALUES ($1, current_date - 1, 'closed', 10000, 10000) RETURNING id`, merchantID).Scan(&ordinary); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `INSERT INTO settlement_batches (merchant_id, batch_date, status, gross_fils, net_payout_fils) VALUES ($1, current_date - 2, 'closed', 10000, 10000) RETURNING id`, merchantID).Scan(&split); err != nil {
		t.Fatal(err)
	}
	if err := pool.QueryRow(ctx, `INSERT INTO settlement_batches (merchant_id, batch_date, status, gross_fils, net_payout_fils) VALUES ($1, current_date - 3, 'closed', 1, 1) RETURNING id`, merchantID).Scan(&zeroSplit); err != nil {
		t.Fatal(err)
	}
	if _, err := PayoutBatch(ctx, pool, ordinary); err != nil {
		t.Fatal(err)
	}
	if _, err := splits.PayoutSplitBatch(ctx, pool, split); err != nil {
		t.Fatal(err)
	}
	if _, err := splits.PayoutSplitBatch(ctx, pool, zeroSplit); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO ledger_entries (entry_group_id, merchant_id, settlement_batch_id, account_id, direction, amount_fils, occurred_at, description) VALUES ($1, $2, $3, 'merchant_payable', 'debit', 100, now(), 'unrelated fee'), ($1, $2, $3, 'platform_fee_revenue', 'credit', 100, now(), 'unrelated fee')`, uuid.New(), merchantID, split); err != nil {
		t.Fatal(err)
	}
	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback(ctx)
	got, err := EstimateMonthlyPayout(ctx, tx, merchantID)
	if err != nil {
		t.Fatal(err)
	}
	if got != 12500 {
		t.Fatalf("monthly estimate = %d, want 12500 actual paid fils", got)
	}
}
