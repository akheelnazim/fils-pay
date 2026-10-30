package splits

import (
	"fmt"
	"math/big"

	"github.com/filspay/settlement/internal/money"
)

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
	shares, err := ChildSharesChecked(netPayout, children)
	if err != nil {
		panic(err)
	}
	return shares
}

// ChildSharesChecked returns an error when a payout or allocation cannot be represented.
func ChildSharesChecked(netPayout money.Fils, children []ChildWeight) ([]money.Fils, error) {
	if netPayout < 0 {
		return nil, fmt.Errorf("ChildShares: negative payout")
	}
	out := make([]money.Fils, len(children))
	fractions := make([]int64, len(children))
	var totalWeight int64
	var allocated money.Fils
	const maxInt64 = int64(^uint64(0) >> 1)
	for i, c := range children {
		if c.WeightBps < 0 || c.WeightBps > maxInt64-totalWeight {
			return nil, fmt.Errorf("ChildShares: invalid or overflowing weight")
		}
		exact := new(big.Int).Mul(big.NewInt(int64(netPayout)), big.NewInt(c.WeightBps))
		quotient, remainder := new(big.Int), new(big.Int)
		quotient.QuoRem(exact, big.NewInt(10_000), remainder)
		if !quotient.IsInt64() {
			return nil, fmt.Errorf("ChildShares: share exceeds int64")
		}
		out[i] = money.Fils(quotient.Int64())
		fractions[i] = remainder.Int64()
		totalWeight += c.WeightBps
		if int64(out[i]) > maxInt64-int64(allocated) {
			return nil, fmt.Errorf("ChildShares: allocated total exceeds int64")
		}
		allocated += out[i]
	}
	total, err := money.ApplyRateFilsChecked(netPayout, totalWeight)
	if err != nil {
		return nil, fmt.Errorf("ChildShares: total: %w", err)
	}
	owed := total - allocated
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
	return out, nil
}
