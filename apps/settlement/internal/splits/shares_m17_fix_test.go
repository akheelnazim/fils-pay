package splits

import (
	"github.com/filspay/settlement/internal/money"
	"testing"
)

func TestM17_LargePayoutSplitsWithoutOverflow(t *testing.T) {
	amount := money.Fils(1_000_000_000_000_001)
	shares := ChildShares(amount, []ChildWeight{{5000}, {5000}})
	if len(shares) != 2 || shares[0] != 500_000_000_000_001 || shares[1] != 500_000_000_000_000 {
		t.Fatalf("shares = %v for payout %d", shares, amount)
	}
	one := ChildShares(amount, []ChildWeight{{10000}})
	if len(one) != 1 || one[0] != amount {
		t.Fatalf("single share = %v for payout %d", one, amount)
	}
}

func TestM17_UnrepresentableSplitReturnsError(t *testing.T) {
	if _, err := ChildSharesChecked(money.Fils(1<<63-1), []ChildWeight{{10000}, {10000}}); err == nil {
		t.Fatal("expected error for shares whose total exceeds int64")
	}
}
