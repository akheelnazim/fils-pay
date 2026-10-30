package splits

import (
	"testing"

	"github.com/filspay/settlement/internal/money"
)

// M3: shares must add up to exactly the payout their weights cover, so no
// rounding remainder is left unpaid in the parent's account.
func TestM3_ChildSharesSumWithRounding(t *testing.T) {
	cases := []struct {
		name       string
		netPayout  money.Fils
		weightsBps []int64
		want       money.Fils
	}{
		{"thirds of an odd amount", 10001, []int64{3333, 3333, 3334}, 10001},
		{"halves of an odd amount", 10001, []int64{5000, 5000}, 10001},
		{"halves rounding up twice", 3, []int64{5000, 5000}, 3},
		{"one fil, two children", 1, []int64{5000, 5000}, 1},
		{"zero payout", 0, []int64{3333, 3333, 3334}, 0},
		{"large amount", 123_456_789, []int64{1, 2_499, 7_500}, 123_456_789},
		{"weights under 100% keep the parent's part", 10001, []int64{2500, 2500}, 5000},
		{"five children each rounding up", 3, []int64{2000, 2000, 2000, 2000, 2000}, 3},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			children := make([]ChildWeight, len(tc.weightsBps))
			for i, w := range tc.weightsBps {
				children[i] = ChildWeight{WeightBps: w}
			}
			shares := ChildShares(tc.netPayout, children)
			var total money.Fils
			for _, s := range shares {
				if s < 0 {
					t.Fatalf("M3: negative share %d in %v", s, shares)
				}
				total += s
			}
			if total != tc.want {
				t.Errorf("M3: shares %v sum to %d, want %d", shares, total, tc.want)
			}
		})
	}
}
