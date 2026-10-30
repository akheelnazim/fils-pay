package splits

import (
	"context"
	"math/rand"
	"os"
	"sort"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// M3: PayoutSplitBatch must pay out the whole net_payout_fils across the
// children. Each child's share is rounded independently, so the children's
// allocations can sum to less (or more) than the batch's net unless the
// rounding remainder is handed to a child.

func m3MustPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	databaseURL := os.Getenv("DATABASE_URL")
	if databaseURL == "" {
		t.Skip("DATABASE_URL not set; skipping DB-backed test (run against a real, migrated Postgres)")
	}
	pool, err := pgxpool.New(context.Background(), databaseURL)
	if err != nil {
		t.Fatalf("failed to connect to DATABASE_URL: %v", err)
	}
	t.Cleanup(pool.Close)
	return pool
}

func m3InsertMerchant(t *testing.T, pool *pgxpool.Pool) uuid.UUID {
	t.Helper()
	var id uuid.UUID
	err := pool.QueryRow(context.Background(), `
		INSERT INTO merchants (display_name, mdr_bps, status, test_mode)
		VALUES ($1, 250, 'active', false)
		RETURNING id
	`, "m3-split-test-"+uuid.New().String()).Scan(&id)
	if err != nil {
		t.Fatalf("m3InsertMerchant: %v", err)
	}
	return id
}

// m3SetupSplitParent creates a parent merchant with one child per weight, a
// closed settlement batch paying netFils, and the parent's cached payable
// balance as batch close would leave it. It returns the parent, the batch and
// the children in the same order as weights.
func m3SetupSplitParent(t *testing.T, pool *pgxpool.Pool, netFils int64, weights []int64) (uuid.UUID, uuid.UUID, []uuid.UUID) {
	t.Helper()
	ctx := context.Background()

	parent := m3InsertMerchant(t, pool)
	children := make([]uuid.UUID, len(weights))
	for i, w := range weights {
		child := m3InsertMerchant(t, pool)
		children[i] = child
		_, err := pool.Exec(ctx, `
			INSERT INTO merchant_split_children (parent_merchant_id, child_merchant_id, split_weight_bps)
			VALUES ($1, $2, $3)
		`, parent, child, w)
		if err != nil {
			t.Fatalf("insert merchant_split_children: %v", err)
		}
	}

	// A fresh merchant has no batches, so any date is unique for it; spread
	// the dates out anyway so the row reads as a real batch.
	batchDate := time.Date(2000, 1, 1, 0, 0, 0, 0, time.UTC).AddDate(0, 0, rand.Intn(36500))
	gross := netFils
	var batchID uuid.UUID
	err := pool.QueryRow(ctx, `
		INSERT INTO settlement_batches
		  (merchant_id, batch_date, status, gross_fils, fee_fils, net_payout_fils, closed_at)
		VALUES ($1, $2, 'closed', $3, 0, $4, now())
		RETURNING id
	`, parent, batchDate, gross, netFils).Scan(&batchID)
	if err != nil {
		t.Fatalf("insert settlement_batches: %v", err)
	}

	_, err = pool.Exec(ctx, `
		INSERT INTO merchant_balances (merchant_id, cached_payable_fils, last_settlement_batch_id, updated_at)
		VALUES ($1, $2, $3, now())
	`, parent, netFils, batchID)
	if err != nil {
		t.Fatalf("insert merchant_balances: %v", err)
	}

	return parent, batchID, children
}

// m3SplitAllocations returns the allocated_fils of every settlement_batch_splits
// row for the batch, sorted ascending.
func m3SplitAllocations(t *testing.T, pool *pgxpool.Pool, batchID uuid.UUID) []int64 {
	t.Helper()
	rows, err := pool.Query(context.Background(), `
		SELECT allocated_fils FROM settlement_batch_splits WHERE settlement_batch_id = $1
	`, batchID)
	if err != nil {
		t.Fatalf("query settlement_batch_splits: %v", err)
	}
	defer rows.Close()
	var out []int64
	for rows.Next() {
		var v int64
		if err := rows.Scan(&v); err != nil {
			t.Fatalf("scan settlement_batch_splits: %v", err)
		}
		out = append(out, v)
	}
	if err := rows.Err(); err != nil {
		t.Fatalf("rows settlement_batch_splits: %v", err)
	}
	sort.Slice(out, func(i, j int) bool { return out[i] < out[j] })
	return out
}

// m3PayoutDebitSum sums the 'merchant_payable' debit legs the split payout
// posted for the batch.
func m3PayoutDebitSum(t *testing.T, pool *pgxpool.Pool, batchID uuid.UUID) int64 {
	t.Helper()
	var sum int64
	err := pool.QueryRow(context.Background(), `
		SELECT COALESCE(SUM(amount_fils), 0)
		  FROM ledger_entries
		 WHERE settlement_batch_id = $1
		   AND account_id = 'merchant_payable'
		   AND direction = 'debit'
	`, batchID).Scan(&sum)
	if err != nil {
		t.Fatalf("sum merchant_payable debits: %v", err)
	}
	return sum
}

func m3SumInt64(vs []int64) int64 {
	var total int64
	for _, v := range vs {
		total += v
	}
	return total
}

func m3SharesTotal(shares []ChildShare) int64 {
	var total int64
	for _, s := range shares {
		total += int64(s.AllocatedFils)
	}
	return total
}

func TestM3_SplitSharesSumToNet_ThreeWays(t *testing.T) {
	pool := m3MustPool(t)
	ctx := context.Background()

	const net int64 = 10001
	_, batchID, _ := m3SetupSplitParent(t, pool, net, []int64{3333, 3333, 3334})

	res, err := PayoutSplitBatch(ctx, pool, batchID)
	if err != nil {
		t.Fatalf("PayoutSplitBatch: %v", err)
	}

	if got := m3SumInt64(m3SplitAllocations(t, pool, batchID)); got != net {
		t.Errorf("sum of settlement_batch_splits.allocated_fils = %d, want %d", got, net)
	}
	if got := m3PayoutDebitSum(t, pool, batchID); got != net {
		t.Errorf("sum of merchant_payable debit legs = %d, want %d", got, net)
	}
	if got := m3SharesTotal(res.Shares); got != net {
		t.Errorf("sum of result.Shares = %d, want %d", got, net)
	}
}

func TestM3_SplitSharesSumToNet_Halves(t *testing.T) {
	pool := m3MustPool(t)
	ctx := context.Background()

	const net int64 = 10001
	_, batchID, _ := m3SetupSplitParent(t, pool, net, []int64{5000, 5000})

	res, err := PayoutSplitBatch(ctx, pool, batchID)
	if err != nil {
		t.Fatalf("PayoutSplitBatch: %v", err)
	}

	if got := m3SumInt64(m3SplitAllocations(t, pool, batchID)); got != net {
		t.Errorf("sum of settlement_batch_splits.allocated_fils = %d, want %d", got, net)
	}
	if got := m3PayoutDebitSum(t, pool, batchID); got != net {
		t.Errorf("sum of merchant_payable debit legs = %d, want %d", got, net)
	}
	if got := m3SharesTotal(res.Shares); got != net {
		t.Errorf("sum of result.Shares = %d, want %d", got, net)
	}
}

func TestM3_SplitParentCacheFullyPaid(t *testing.T) {
	pool := m3MustPool(t)
	ctx := context.Background()

	const net int64 = 10001
	parent, batchID, _ := m3SetupSplitParent(t, pool, net, []int64{3333, 3333, 3334})

	if _, err := PayoutSplitBatch(ctx, pool, batchID); err != nil {
		t.Fatalf("PayoutSplitBatch: %v", err)
	}

	var cached int64
	err := pool.QueryRow(ctx, `
		SELECT cached_payable_fils FROM merchant_balances WHERE merchant_id = $1
	`, parent).Scan(&cached)
	if err != nil {
		t.Fatalf("read merchant_balances: %v", err)
	}
	if cached != 0 {
		t.Errorf("parent merchant_balances.cached_payable_fils after payout = %d, want 0", cached)
	}
}

func TestM3_SplitExactDivisionUnchanged(t *testing.T) {
	pool := m3MustPool(t)
	ctx := context.Background()

	const net int64 = 9000
	_, batchID, _ := m3SetupSplitParent(t, pool, net, []int64{3000, 3000, 4000})

	if _, err := PayoutSplitBatch(ctx, pool, batchID); err != nil {
		t.Fatalf("PayoutSplitBatch: %v", err)
	}

	got := m3SplitAllocations(t, pool, batchID)
	want := []int64{2700, 2700, 3600}
	if len(got) != len(want) {
		t.Fatalf("settlement_batch_splits allocations = %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("settlement_batch_splits allocations = %v, want multiset %v", got, want)
			break
		}
	}
}
