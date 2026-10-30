package settlement

import (
	"context"
	"testing"

	"github.com/google/uuid"
)

// M19: merchants.lifetime_net_payout_monitoring_estimate carries drift from
// the old REAL column and omits split payouts paid before M18. Correcting it
// needs Finance's sign-off, so this is a read-only report of stored estimate
// against the payout legs actually in the ledger.

func m19Payout(t *testing.T, merchantID uuid.UUID, fils int64, description string) {
	t.Helper()
	_, err := mustPool(t).Exec(context.Background(), `
		INSERT INTO ledger_entries (entry_group_id, merchant_id, account_id, direction, amount_fils, occurred_at, description)
		VALUES ($1, $2, 'merchant_payable', 'debit',  $3, now(), $4),
		       ($1, $2, 'platform_cash',    'credit', $3, now(), $4)
	`, uuid.New(), merchantID, fils, description)
	if err != nil {
		t.Fatalf("insert payout legs: %v", err)
	}
}

func m19Drift(t *testing.T, merchantID uuid.UUID) (EstimateDrift, bool) {
	t.Helper()
	drifts, err := LifetimePayoutEstimateDrift(context.Background(), mustPool(t))
	if err != nil {
		t.Fatalf("LifetimePayoutEstimateDrift: %v", err)
	}
	for _, d := range drifts {
		if d.MerchantID == merchantID {
			return d, true
		}
	}
	return EstimateDrift{}, false
}

func TestM19_ReportsStoredEstimateAgainstActualPayoutLegs(t *testing.T) {
	pool := mustPool(t)
	merchantID := insertActiveMerchant(t, pool, 250)
	m19Payout(t, merchantID, 5_000, "settlement payout: batch paid")
	m19Payout(t, merchantID, 1_200, "settlement payout: split to sub-merchant")
	if _, err := pool.Exec(context.Background(),
		`UPDATE merchants SET lifetime_net_payout_monitoring_estimate = 5000 WHERE id = $1`, merchantID); err != nil {
		t.Fatalf("set estimate: %v", err)
	}

	d, ok := m19Drift(t, merchantID)
	if !ok {
		t.Fatal("a merchant whose estimate is 1200 short must be reported")
	}
	if d.StoredFils != 5_000 || d.ActualFils != 6_200 || d.DriftFils != -1_200 {
		t.Errorf("drift = %+v, want stored 5000, actual 6200, drift -1200", d)
	}
}

func TestM19_MatchingEstimateIsNotReported(t *testing.T) {
	pool := mustPool(t)
	merchantID := insertActiveMerchant(t, pool, 250)
	m19Payout(t, merchantID, 4_000, "settlement payout: batch paid")
	if _, err := pool.Exec(context.Background(),
		`UPDATE merchants SET lifetime_net_payout_monitoring_estimate = 4000 WHERE id = $1`, merchantID); err != nil {
		t.Fatalf("set estimate: %v", err)
	}
	if _, ok := m19Drift(t, merchantID); ok {
		t.Error("a merchant whose estimate matches its payouts must not be reported")
	}
}

func TestM19_NoPayoutsAndZeroEstimateIsNotReported(t *testing.T) {
	merchantID := insertActiveMerchant(t, mustPool(t), 250)
	if _, ok := m19Drift(t, merchantID); ok {
		t.Error("a merchant with nothing paid and a zero estimate must not be reported")
	}
}

func TestM19_ReportDoesNotChangeTheStoredEstimate(t *testing.T) {
	pool := mustPool(t)
	merchantID := insertActiveMerchant(t, pool, 250)
	m19Payout(t, merchantID, 900, "settlement payout: batch paid")
	m19Drift(t, merchantID)
	var stored int64
	if err := pool.QueryRow(context.Background(),
		`SELECT lifetime_net_payout_monitoring_estimate FROM merchants WHERE id = $1`, merchantID).Scan(&stored); err != nil {
		t.Fatalf("read estimate: %v", err)
	}
	if stored != 0 {
		t.Errorf("stored estimate = %d, the report must not write", stored)
	}
}
