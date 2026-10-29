package settlement

import (
	"context"
	"testing"
	"time"
)

// M7 twin: when two schedules start on the same day, settlement must use
// the one entered last, the same tie-break apps/api billing uses
// (effective_from DESC, created_at DESC).
func TestM7_SameDayScheduleTieUsesNewestEntry(t *testing.T) {
	pool := mustPool(t)
	merchantID := insertActiveMerchant(t, pool, 250)
	effective := time.Date(2026, 6, 1, 0, 0, 0, 0, time.UTC)

	// The later-entered row is inserted first, so physical order alone
	// would put the older entry last.
	for _, row := range []struct {
		bps     int64
		created time.Time
	}{
		{205, effective.AddDate(0, 0, 10)},
		{210, effective},
	} {
		if _, err := pool.Exec(context.Background(), `
			INSERT INTO fee_schedules (merchant_id, mdr_bps, effective_from, created_at) VALUES ($1, $2, $3, $4)
		`, merchantID, row.bps, effective, row.created); err != nil {
			t.Fatalf("insert fee schedule: %v", err)
		}
	}

	schedules := loadSchedules(t, pool, merchantID)
	if got := EffectiveMdrBpsAt(schedules, effective.AddDate(0, 1, 0), 250); got != 205 {
		t.Errorf("EffectiveMdrBpsAt on a same-day tie = %d, want 205 (the row entered last)", got)
	}
}
