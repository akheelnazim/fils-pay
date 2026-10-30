package settlement

import (
	"context"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/filspay/settlement/internal/money"
)

func TestM16_SchemeExportUsesOnlyIntegerFils(t *testing.T) {
	pool := mustPool(t)
	ctx := context.Background()

	var decimalAmountColumn, exportedFilsColumn bool
	err := pool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM information_schema.columns
			 WHERE table_schema = current_schema()
			   AND table_name = 'scheme_export_lines'
			   AND column_name = 'amount'
		), EXISTS (
			SELECT 1 FROM information_schema.columns
			 WHERE table_schema = current_schema()
			   AND table_name = 'scheme_export_lines'
			   AND column_name = 'exported_amount_fils'
		)
	`).Scan(&decimalAmountColumn, &exportedFilsColumn)
	if err != nil {
		t.Fatalf("inspect scheme export schema: %v", err)
	}
	if decimalAmountColumn {
		t.Fatal("scheme_export_lines.amount still stores a decimal money value")
	}
	if !exportedFilsColumn {
		t.Fatal("scheme_export_lines.exported_amount_fils is missing")
	}

	const mdrBps = 250
	merchantID := insertActiveMerchant(t, pool, mdrBps)
	businessDate := time.Date(2026, 10, 27, 0, 0, 0, 0, time.UTC)
	start, _ := BusinessDayWindow(businessDate)
	type capture struct {
		amount money.Fils
		ref    string
	}
	captures := []capture{{amount: 4747}, {amount: 1000}, {amount: 1005}}
	for i := range captures {
		txnID, _ := insertCaptureEvent(t, pool, merchantID, mdrBps, captures[i].amount, start.Add(time.Duration(i+1)*time.Hour))
		if err := pool.QueryRow(ctx, `SELECT acquirer_reference FROM transactions WHERE id = $1`, txnID).Scan(&captures[i].ref); err != nil {
			t.Fatalf("read acquirer reference: %v", err)
		}
	}

	batch, err := CloseBatch(ctx, pool, merchantID, businessDate)
	if err != nil {
		t.Fatalf("CloseBatch: %v", err)
	}
	// A pre-M2 export could have rounded 4747 gross fils to 4.75 BD even
	// though amount_fils correctly records the truncated 4740 fils. The
	// integer snapshot must keep that historic export byte-for-byte stable.
	if _, err := pool.Exec(ctx, `
		UPDATE scheme_export_lines sel SET exported_amount_fils = 4750
		  FROM transactions t
		 WHERE sel.transaction_id = t.id
		   AND sel.settlement_batch_id = $1
		   AND t.acquirer_reference = $2
	`, batch.BatchID, captures[0].ref); err != nil {
		t.Fatalf("set legacy export snapshot: %v", err)
	}
	lines, err := LoadSchemeExportLines(ctx, pool, batch.BatchID)
	if err != nil {
		t.Fatalf("LoadSchemeExportLines: %v", err)
	}
	wantAmounts := map[string]string{
		captures[0].ref: "4.75",
		captures[1].ref: "1.00",
		captures[2].ref: "1.00",
	}
	var want strings.Builder
	for _, line := range lines {
		if line.Amount != wantAmounts[line.AcquirerReference] {
			t.Errorf("line %d amount = %q, want %q", line.LineSequence, line.Amount, wantAmounts[line.AcquirerReference])
		}
		fmt.Fprintf(&want, "%s,%s,BHD,%d\n", line.AcquirerReference, line.Amount, line.LineSequence)
	}
	path := t.TempDir() + "/scheme.csv"
	count, err := ExportSchemeFile(ctx, pool, batch.BatchID, path)
	if err != nil {
		t.Fatalf("ExportSchemeFile: %v", err)
	}
	if count != len(captures) {
		t.Fatalf("exported %d lines, want %d", count, len(captures))
	}
	contents, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("read scheme file: %v", err)
	}
	if string(contents) != want.String() {
		t.Fatalf("scheme file = %q, want %q", contents, want.String())
	}
}
