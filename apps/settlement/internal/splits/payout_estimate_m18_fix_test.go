package splits

import (
	"context"
	"testing"
)

func TestM18_SplitPayoutUpdatesLifetimeEstimateOnce(t *testing.T) {
	pool := m3MustPool(t)
	ctx := context.Background()
	for _, tc := range []struct {
		name    string
		net     int64
		weights []int64
		want    int64
	}{
		{"full allocation", 10001, []int64{5000, 5000}, 10001},
		{"partial allocation", 10000, []int64{2500}, 2500},
		{"zero payout", 0, []int64{10000}, 0},
	} {
		t.Run(tc.name, func(t *testing.T) {
			parent, batch, _ := m3SetupSplitParent(t, pool, tc.net, tc.weights)
			if _, err := pool.Exec(ctx, `UPDATE merchants SET lifetime_net_payout_monitoring_estimate = 100 WHERE id = $1`, parent); err != nil {
				t.Fatal(err)
			}
			if _, err := PayoutSplitBatch(ctx, pool, batch); err != nil {
				t.Fatal(err)
			}
			if _, err := PayoutSplitBatch(ctx, pool, batch); err != nil {
				t.Fatal(err)
			}
			var got int64
			if err := pool.QueryRow(ctx, `SELECT lifetime_net_payout_monitoring_estimate FROM merchants WHERE id = $1`, parent).Scan(&got); err != nil {
				t.Fatal(err)
			}
			if got != 100+tc.want {
				t.Fatalf("estimate = %d, want %d after payout and replay", got, 100+tc.want)
			}
		})
	}
}
