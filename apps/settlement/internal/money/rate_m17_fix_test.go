package money

import "testing"

func TestM17_ApplyRateAvoidsIntermediateOverflow(t *testing.T) {
	for _, tc := range []struct {
		amount Fils
		rate   int64
		want   Fils
	}{
		{1_000_000_000_000_000, 10_000, 1_000_000_000_000_000},
		{1_000_000_000_000_001, 5_000, 500_000_000_000_000},
		{-1_000_000_000_000_001, 5_000, -500_000_000_000_000},
	} {
		if got := ApplyRateFils(tc.amount, tc.rate); got != tc.want {
			t.Errorf("ApplyRateFils(%d, %d) = %d, want %d", tc.amount, tc.rate, got, tc.want)
		}
	}
}

func TestM17_UnrepresentableResultsReturnErrors(t *testing.T) {
	const max = Fils(1<<63 - 1)
	if _, err := ApplyRateFilsChecked(max, 20_000); err == nil {
		t.Fatal("expected error for rate result outside int64")
	}
	if _, err := AddFilsChecked(max, 1); err == nil {
		t.Fatal("expected error for overflowing sum")
	}
	if _, err := AddFilsChecked(-max-1, -1); err == nil {
		t.Fatal("expected error for underflowing sum")
	}
	if _, err := SubtractFilsChecked(0, -max-1); err == nil {
		t.Fatal("expected error for overflowing difference")
	}
}
