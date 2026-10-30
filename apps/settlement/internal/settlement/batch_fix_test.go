package settlement

import (
	"context"
	"testing"
	"time"

	"github.com/filspay/settlement/internal/money"
)

// M2: the scheme file amount must be exactly amount_fils / 1000 at two
// decimals (ADR-0002), i.e. the truncated figure, never the gross rounded
// half-up. Edge cases: already a multiple of 10, below half, exactly half,
// large, and under one hundredth.
func TestM2_SchemeExportAmountMatchesTruncatedFils(t *testing.T) {
	pool := mustPool(t)
	const mdrBps = 250
	merchantID := insertActiveMerchant(t, pool, mdrBps)
	businessDate := time.Date(2026, 3, 20, 0, 0, 0, 0, time.UTC)
	start, _ := BusinessDayWindow(businessDate)

	cases := map[money.Fils]string{
		4750:  "4.75",  // exact
		4747:  "4.74",  // half-up would give 4.75
		4755:  "4.75",  // exactly half: half-up would give 4.76
		93276: "93.27", // the Delta Wholesale case: file said 93.28
		9:     "0.00",  // under one hundredth: half-up would give 0.01
	}
	for amount := range cases {
		insertCaptureEvent(t, pool, merchantID, mdrBps, amount, start.Add(time.Hour))
	}

	result, err := CloseBatch(context.Background(), pool, merchantID, businessDate)
	if err != nil {
		t.Fatalf("CloseBatch: %v", err)
	}

	rows, err := pool.Query(context.Background(), `
		SELECT t.amount_fils, sel.amount_fils
		  FROM scheme_export_lines sel
		  JOIN transactions t ON t.id = sel.transaction_id
		 WHERE sel.settlement_batch_id = $1
	`, result.BatchID)
	if err != nil {
		t.Fatalf("query scheme_export_lines: %v", err)
	}
	defer rows.Close()
	seen := 0
	for rows.Next() {
		var gross, lineFils int64
		if err := rows.Scan(&gross, &lineFils); err != nil {
			t.Fatalf("scan: %v", err)
		}
		seen++
		want := cases[money.Fils(gross)]
		amount := formatFilsAsTwoDecimalString(money.Fils(lineFils))
		if amount != want {
			t.Errorf("gross %d fils: scheme amount = %s, want %s (amount_fils %d)", gross, amount, want, lineFils)
		}
		if got := formatFilsAsTwoDecimalString(money.Fils(lineFils)); got != amount {
			t.Errorf("gross %d fils: amount %s does not equal amount_fils/1000 (%s)", gross, amount, got)
		}
	}
	if seen != len(cases) {
		t.Fatalf("got %d scheme lines, want %d", seen, len(cases))
	}
}
