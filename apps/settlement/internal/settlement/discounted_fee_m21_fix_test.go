package settlement

import (
	"testing"

	"github.com/filspay/settlement/internal/money"
)

func TestM21SettlementFeeMatchesCaptureDiscount(t *testing.T) {
	cases := []struct {
		amount money.Fils
		mdr, discount int64
		want money.Fils
	}{
		{10_200, 250, 1000, 229},
		{1_000, 250, 1000, 23},
		{602, 275, 1250, 15},
		{0, 250, 1000, 0},
		{10_200, 250, 0, 255},
		{10_200, 250, 10_000, 0},
	}
	for _, tc := range cases {
		if got := ComputeSettlementFee(tc.amount, tc.mdr, tc.discount); got != tc.want {
			t.Errorf("amount %d, mdr %d, discount %d: got %d, want %d", tc.amount, tc.mdr, tc.discount, got, tc.want)
		}
	}
}
