package settlement

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestR3ConcurrentEnqueueCreatesOneEventPerPaidBatch(t *testing.T) {
	pool := mustPool(t)
	ctx := context.Background()
	var before int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM outbox_events WHERE event_type = 'settlement.paid'`).Scan(&before); err != nil {
		t.Fatalf("count settlement.paid events before: %v", err)
	}
	merchantID := insertActiveMerchant(t, pool, 250)
	base := time.Date(2026, 8, 21, 0, 0, 0, 0, time.UTC)

	const batchCount = 10
	batchIDs := make([]uuid.UUID, 0, batchCount)
	for i := 0; i < batchCount; i++ {
		id := insertBatch(t, pool, merchantID, base.AddDate(0, 0, i), "paid", int64(1000+i))
		batchIDs = append(batchIDs, id)
	}

	start := make(chan struct{})
	type result struct {
		count int
		err   error
	}
	results := make(chan result, 2)
	var ready sync.WaitGroup
	ready.Add(2)
	for i := 0; i < 2; i++ {
		go func() {
			ready.Done()
			<-start
			count, err := EnqueuePayoutNotifications(ctx, pool)
			results <- result{count: count, err: err}
		}()
	}
	ready.Wait()
	close(start)

	combinedCount := 0
	for i := 0; i < 2; i++ {
		got := <-results
		if got.err != nil {
			t.Fatalf("concurrent EnqueuePayoutNotifications: %v", got.err)
		}
		combinedCount += got.count
	}
	var after int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM outbox_events WHERE event_type = 'settlement.paid'`).Scan(&after); err != nil {
		t.Fatalf("count settlement.paid events after: %v", err)
	}
	if combinedCount != after-before {
		t.Fatalf("combined enqueued count = %d, event count increased by %d", combinedCount, after-before)
	}

	for _, batchID := range batchIDs {
		if got := countPaidEvents(t, pool, batchID); got != 1 {
			t.Errorf("batch %s has %d settlement.paid events, want 1", batchID, got)
		}
	}

	count, err := EnqueuePayoutNotifications(ctx, pool)
	if err != nil {
		t.Fatalf("sequential EnqueuePayoutNotifications: %v", err)
	}
	if count != 0 {
		t.Fatalf("sequential enqueue count = %d, want 0", count)
	}
}
