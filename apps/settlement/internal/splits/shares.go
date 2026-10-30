package splits

import "github.com/filspay/settlement/internal/money"

// ChildWeight is one sub-merchant's configured share of a parent's payout.
type ChildWeight struct {
	WeightBps int64
}

// ChildShares distributes netPayout across children by their weights using
// largest remainders: every share is rounded down, then the fils still owed
// go one at a time to the shares with the largest dropped fraction. Shares are
// never negative and add up to exactly the payout the weights cover (all of
// netPayout when they total 10000 bps).
func ChildShares(netPayout money.Fils, children []ChildWeight) []money.Fils {
	out := make([]money.Fils, len(children))
	fractions := make([]int64, len(children))
	var totalWeight int64
	var allocated money.Fils
	for i, c := range children {
		exact := int64(netPayout) * c.WeightBps
		out[i] = money.Fils(exact / 10_000)
		fractions[i] = exact % 10_000
		totalWeight += c.WeightBps
		allocated += out[i]
	}
	owed := money.ApplyRateFils(netPayout, totalWeight) - allocated
	for ; owed > 0; owed-- {
		best := -1
		for i := range out {
			if best < 0 || fractions[i] > fractions[best] {
				best = i
			}
		}
		out[best]++
		fractions[best] = -1 // each share gets at most one extra fil
	}
	return out
}
