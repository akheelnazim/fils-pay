package ledger

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// M15: RebuildAllBalances read a merchant's ledger total and then overwrote
// merchant_balances. A batch close that committed its ledger legs and cache
// increment in between was clobbered with the stale total.

// m15Legs posts a balanced merchant_payable credit / card_scheme_clearing debit.
func m15Legs(ctx context.Context, tx pgx.Tx, merchantID uuid.UUID, fils int64) error {
	_, err := tx.Exec(ctx, `
		INSERT INTO ledger_entries (entry_group_id, merchant_id, account_id, direction, amount_fils, occurred_at, description)
		VALUES ($1, $2, 'merchant_payable', 'credit', $3, now(), 'M15 test'),
		       ($1, $2, 'card_scheme_clearing', 'debit', $3, now(), 'M15 test')
	`, uuid.New(), merchantID, fils)
	return err
}

// waitForLockWait polls until some backend is blocked by blockerPID's locks.
func waitForLockWait(t *testing.T, pool *pgxpool.Pool, blockerPID int) {
	t.Helper()
	deadline := time.Now().Add(90 * time.Second)
	for time.Now().Before(deadline) {
		var n int
		if err := pool.QueryRow(context.Background(), `
			SELECT count(*) FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid))
		`, blockerPID).Scan(&n); err != nil {
			t.Fatalf("poll pg_stat_activity: %v", err)
		}
		if n > 0 {
			return
		}
		time.Sleep(20 * time.Millisecond)
	}
	t.Fatalf("rebuild never blocked on the batch close's row lock")
}

func TestM15_RebuildDoesNotClobberConcurrentBatchClose(t *testing.T) {
	pool := mustPool(t)
	ctx := context.Background()
	merchantID := insertActiveMerchant(t, pool)

	// Settled state: 5000 payable in the ledger and in the cache.
	setup, err := pool.Begin(ctx)
	if err != nil {
		t.Fatalf("begin setup: %v", err)
	}
	if err := m15Legs(ctx, setup, merchantID, 5000); err != nil {
		t.Fatalf("setup legs: %v", err)
	}
	if _, err := setup.Exec(ctx, `
		INSERT INTO merchant_balances (merchant_id, cached_payable_fils, updated_at) VALUES ($1, 5000, now())
	`, merchantID); err != nil {
		t.Fatalf("setup cache: %v", err)
	}
	if err := setup.Commit(ctx); err != nil {
		t.Fatalf("commit setup: %v", err)
	}

	// A batch close in flight: +1000 in the ledger and the cache, row locked.
	closeTx, err := pool.Begin(ctx)
	if err != nil {
		t.Fatalf("begin close: %v", err)
	}
	defer closeTx.Rollback(ctx) //nolint:errcheck
	if err := m15Legs(ctx, closeTx, merchantID, 1000); err != nil {
		t.Fatalf("close legs: %v", err)
	}
	if _, err := closeTx.Exec(ctx, `
		UPDATE merchant_balances SET cached_payable_fils = cached_payable_fils + 1000 WHERE merchant_id = $1
	`, merchantID); err != nil {
		t.Fatalf("close cache: %v", err)
	}

	var closePID int
	if err := closeTx.QueryRow(ctx, `SELECT pg_backend_pid()`).Scan(&closePID); err != nil {
		t.Fatalf("close pid: %v", err)
	}

	done := make(chan error, 1)
	go func() {
		_, err := RebuildAllBalances(ctx, pool)
		done <- err
	}()

	waitForLockWait(t, pool, closePID)
	if err := closeTx.Commit(ctx); err != nil {
		t.Fatalf("commit close: %v", err)
	}
	if err := <-done; err != nil {
		t.Fatalf("RebuildAllBalances: %v", err)
	}

	var cached int64
	if err := pool.QueryRow(ctx, `SELECT cached_payable_fils FROM merchant_balances WHERE merchant_id = $1`, merchantID).
		Scan(&cached); err != nil {
		t.Fatalf("read cache: %v", err)
	}
	if cached != 6000 {
		t.Errorf("M15: cached_payable_fils = %d after rebuild, want 6000 (ledger total incl. the concurrent batch close)", cached)
	}
}
