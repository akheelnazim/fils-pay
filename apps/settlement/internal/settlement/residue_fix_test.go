package settlement

import (
	"context"
	"sort"
	"testing"
	"time"

	"github.com/filspay/settlement/internal/money"
)

// M14: ADR-0002 says CloseBatch journals each export line's scheme rounding
// residue (gross - amount_fils): credit card_scheme_clearing / debit
// scheme_rounding_residue. Nothing posted it, so the ledger, the settlement
// report and the scheme statement could never agree.

func m14Close(t *testing.T, amounts []int64) (batchID string, legs []string) {
	t.Helper()
	pool := mustPool(t)
	ctx := context.Background()
	merchantID := insertActiveMerchant(t, pool, 250)
	businessDate := time.Date(2026, 4, 14, 0, 0, 0, 0, time.UTC)
	start, _ := BusinessDayWindow(businessDate)
	for i, a := range amounts {
		insertCaptureEvent(t, pool, merchantID, 250, money.Fils(a), start.Add(time.Duration(i+1)*time.Hour))
	}
	res, err := CloseBatch(ctx, pool, merchantID, businessDate)
	if err != nil {
		t.Fatalf("CloseBatch: %v", err)
	}
	rows, err := pool.Query(ctx, `
		SELECT account_id || ':' || direction || ':' || amount_fils FROM ledger_entries
		 WHERE settlement_batch_id = $1 AND account_id IN ('card_scheme_clearing', 'scheme_rounding_residue')
	`, res.BatchID)
	if err != nil {
		t.Fatalf("read residue legs: %v", err)
	}
	defer rows.Close()
	for rows.Next() {
		var l string
		if err := rows.Scan(&l); err != nil {
			t.Fatalf("scan: %v", err)
		}
		legs = append(legs, l)
	}
	sort.Strings(legs)
	return res.BatchID.String(), legs
}

func TestM14_ResidueJournaledPerLine(t *testing.T) {
	_, legs := m14Close(t, []int64{4759, 1333, 5000})
	want := []string{
		"card_scheme_clearing:credit:3",
		"card_scheme_clearing:credit:9",
		"scheme_rounding_residue:debit:3",
		"scheme_rounding_residue:debit:9",
	}
	if len(legs) != len(want) {
		t.Fatalf("residue legs = %v, want %v", legs, want)
	}
	for i := range want {
		if legs[i] != want[i] {
			t.Errorf("residue legs = %v, want %v", legs, want)
			break
		}
	}
}

func TestM14_NoResidueNoLegs(t *testing.T) {
	_, legs := m14Close(t, []int64{4750, 10, 120_000})
	if len(legs) != 0 {
		t.Errorf("residue legs for round amounts = %v, want none", legs)
	}
}

func TestM14_ResiduePlusExportEqualsGross(t *testing.T) {
	pool := mustPool(t)
	ctx := context.Background()
	batchID, _ := m14Close(t, []int64{4759, 1333, 999, 5000})

	var gross, exported, residue int64
	if err := pool.QueryRow(ctx, `
		SELECT sb.gross_fils,
		       (SELECT COALESCE(SUM(amount_fils), 0) FROM scheme_export_lines WHERE settlement_batch_id = sb.id),
		       (SELECT COALESCE(SUM(amount_fils), 0) FROM ledger_entries
		         WHERE settlement_batch_id = sb.id AND account_id = 'scheme_rounding_residue' AND direction = 'debit')
		  FROM settlement_batches sb WHERE sb.id = $1
	`, batchID).Scan(&gross, &exported, &residue); err != nil {
		t.Fatalf("read totals: %v", err)
	}
	if exported+residue != gross {
		t.Errorf("exported %d + residue %d = %d, want gross %d", exported, residue, exported+residue, gross)
	}
}

func TestM14_MerchantPayableUntouchedByResidue(t *testing.T) {
	pool := mustPool(t)
	ctx := context.Background()
	batchID, _ := m14Close(t, []int64{4759})
	var n int
	if err := pool.QueryRow(ctx, `
		SELECT count(*) FROM ledger_entries
		 WHERE settlement_batch_id = $1 AND account_id = 'merchant_payable' AND description ILIKE '%residue%'
	`, batchID).Scan(&n); err != nil {
		t.Fatalf("count: %v", err)
	}
	if n != 0 {
		t.Errorf("merchant_payable residue legs = %d, want 0 (ADR-0002: merchants are not charged)", n)
	}
}
