package settlement

import (
	"context"
	"testing"

	"github.com/filspay/settlement/internal/money"
)

// M5: the lifetime payout estimate was a REAL column bumped with float32, so
// above 2^24 fils (16,777.216 BD) single fils were lost and large totals drifted.

func m5Lifetime(t *testing.T, adds []money.Fils) int64 {
	t.Helper()
	pool := mustPool(t)
	ctx := context.Background()
	merchantID := insertActiveMerchant(t, pool, 250)

	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatalf("begin: %v", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	for _, net := range adds {
		if err := UpdateLifetimePayoutMonitoringEstimate(ctx, tx, merchantID, net); err != nil {
			t.Fatalf("UpdateLifetimePayoutMonitoringEstimate(%d): %v", net, err)
		}
	}
	var got int64
	if err := tx.QueryRow(ctx, `
		SELECT lifetime_net_payout_monitoring_estimate::bigint FROM merchants WHERE id = $1
	`, merchantID).Scan(&got); err != nil {
		t.Fatalf("read back estimate: %v", err)
	}
	return got
}

func TestM5_LifetimeEstimateKeepsSingleFilsAbove2Pow24(t *testing.T) {
	got := m5Lifetime(t, []money.Fils{16_777_216, 1, 1, 1})
	if got != 16_777_219 {
		t.Errorf("lifetime estimate = %d, want 16777219", got)
	}
}

func TestM5_LifetimeEstimateExactForLargeTotals(t *testing.T) {
	got := m5Lifetime(t, []money.Fils{9_000_000_123, 987_654_321, 7})
	if want := int64(9_000_000_123 + 987_654_321 + 7); got != want {
		t.Errorf("lifetime estimate = %d, want %d", got, want)
	}
}

func TestM5_MonthlyEstimateExact(t *testing.T) {
	pool := mustPool(t)
	ctx := context.Background()
	merchantID := insertActiveMerchant(t, pool, 250)
	for i, net := range []int64{16_777_216, 1, 1, 1} {
		if _, err := pool.Exec(ctx, `
			INSERT INTO settlement_batches (merchant_id, batch_date, status, gross_fils, fee_fils, net_payout_fils, closed_at, paid_at)
			VALUES ($1, current_date - $2::int, 'paid', $3, 0, $3, now(), now())
		`, merchantID, i+1, net); err != nil {
			t.Fatalf("insert paid batch: %v", err)
		}
	}

	tx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatalf("begin: %v", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	got, err := EstimateMonthlyPayout(ctx, tx, merchantID)
	if err != nil {
		t.Fatalf("EstimateMonthlyPayout: %v", err)
	}
	if int64(got) != 16_777_219 {
		t.Errorf("monthly estimate = %v, want 16777219", got)
	}
}
