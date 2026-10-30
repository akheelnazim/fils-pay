package scheduler

import (
	"testing"
	"time"
)

// T1: the daily close must fall due just after Bahrain midnight, not once
// the UTC date rolls over at 03:00 Bahrain.
func TestT1_DueBusinessDateFollowsBahrainMidnight(t *testing.T) {
	bahrain, err := time.LoadLocation("Asia/Bahrain")
	if err != nil {
		t.Fatalf("load Asia/Bahrain: %v", err)
	}
	at := func(y int, m time.Month, d, hh, mm int) time.Time {
		return time.Date(y, m, d, hh, mm, 0, 0, bahrain).UTC()
	}

	cases := []struct {
		name     string
		now      time.Time
		delay    int
		wantDue  bool
		wantDate string
	}{
		{"before the delay after midnight", at(2026, 5, 15, 0, 10), 15, false, ""},
		{"just after midnight plus delay", at(2026, 5, 15, 0, 20), 15, true, "2026-05-14"},
		{"exactly midnight plus delay", at(2026, 5, 15, 0, 15), 15, true, "2026-05-14"},
		{"exactly midnight, no delay", at(2026, 5, 15, 0, 0), 0, true, "2026-05-14"},
		{"02:59 Bahrain, UTC still the day before", at(2026, 5, 15, 2, 59), 15, true, "2026-05-14"},
		{"03:15 Bahrain, UTC has rolled over", at(2026, 5, 15, 3, 15), 15, true, "2026-05-14"},
		{"late evening Bahrain", at(2026, 5, 15, 23, 59), 15, true, "2026-05-14"},
		{"year end", at(2027, 1, 1, 0, 20), 15, true, "2026-12-31"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			date, due := dueBusinessDate(tc.now, tc.delay)
			if due != tc.wantDue {
				t.Fatalf("T1: dueBusinessDate(%s Bahrain) due = %v, want %v", tc.now.In(bahrain).Format("2006-01-02 15:04"), due, tc.wantDue)
			}
			if due && date.Format("2006-01-02") != tc.wantDate {
				t.Errorf("T1: dueBusinessDate(%s Bahrain) business date = %s, want %s", tc.now.In(bahrain).Format("2006-01-02 15:04"), date.Format("2006-01-02"), tc.wantDate)
			}
		})
	}
}
