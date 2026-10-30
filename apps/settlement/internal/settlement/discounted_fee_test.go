package settlement

import (
	"testing"

	"github.com/filspay/settlement/internal/money"
)

// The negotiated discount applies to the rounded fee, as in the capture ledger.
func TestComputeSettlementFee(t *testing.T) {
	cases := []struct {
		name        string
		amount      money.Fils
		mdrBps      int64
		discountBps int64
		want        money.Fils
	}{
		{
			name:        "602 fils at 275bps MDR with a 1250bps discount",
			amount:      602,
			mdrBps:      275,
			discountBps: 1250,
			// Rounded fee 17, less rounded discount 2.
			want: 15,
		},
		{
			name:        "100000 fils at 275bps MDR with a 1250bps discount",
			amount:      100_000,
			mdrBps:      275,
			discountBps: 1250,
			// Rounded fee 2750, less rounded discount 344.
			want: 2406,
		},
		{
			name:        "4750 fils at 250bps MDR with a 2000bps discount",
			amount:      4750,
			mdrBps:      250,
			discountBps: 2000,
			// Rounded fee 119, less rounded discount 24.
			want: 95,
		},
		{
			name:        "a full 10000bps discount leaves nothing to charge MDR against",
			amount:      50_000,
			mdrBps:      320,
			discountBps: 10_000,
			want:        0,
		},
		{
			name:        "zero amount, zero fee",
			amount:      0,
			mdrBps:      275,
			discountBps: 1250,
			want:        0,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := ComputeSettlementFee(tc.amount, tc.mdrBps, tc.discountBps)
			if got != tc.want {
				t.Fatalf("ComputeSettlementFee(%d, %d, %d) = %d, want %d",
					tc.amount, tc.mdrBps, tc.discountBps, got, tc.want)
			}
		})
	}
}

// Every merchant without a negotiated discount (the 0047 column default)
// must settle exactly as it did before the column existed.
// With a zero discount both orderings (discount first, fee first) agree, so
// this test cannot tell them apart.
func TestComputeSettlementFeeZeroDiscountMatchesApplyRateFils(t *testing.T) {
	rates := []int64{0, 180, 250, 275, 320, 10_000}
	for _, amount := range []money.Fils{0, 1, 3, 602, 4750, 9973, 123_457, 5_000_000} {
		for _, mdrBps := range rates {
			got := ComputeSettlementFee(amount, mdrBps, 0)
			want := money.ApplyRateFils(amount, mdrBps)
			if got != want {
				t.Fatalf("ComputeSettlementFee(%d, %d, 0) = %d, want ApplyRateFils = %d",
					amount, mdrBps, got, want)
			}
		}
	}
}
