package settlement

import (
	"testing"

	"github.com/filspay/settlement/internal/money"
)

// M4: net payout is gross minus fee in whole fils (ADR-0001), exact for
// every size of batch, never via float32.
func TestM4_NetPayableIsExactIntegerSubtraction(t *testing.T) {
	cases := []struct {
		gross, fee, want money.Fils
	}{
		{4750, 119, 4631},                      // ordinary capture
		{0, 0, 0},                              // empty batch
		{123_456_789, 0, 123_456_789},          // 123,456.789 BD: float32 gives 123,456,792
		{123_456_789, 3_086_420, 120_370_369},  // large batch with a 2.5% fee
		{20_000_123, 500_003, 19_500_120},      // the Delta Wholesale day, odd fils both sides
		{9_007_199_254_740, 1, 9_007_199_254_739}, // far beyond float32 precision
	}
	for _, c := range cases {
		if got := NetPayableFils(c.gross, c.fee); got != c.want {
			t.Errorf("NetPayableFils(%d, %d) = %d, want %d", c.gross, c.fee, got, c.want)
		}
	}
}
