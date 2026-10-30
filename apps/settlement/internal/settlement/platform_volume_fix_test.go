package settlement

import (
	"context"
	"testing"
)

// M6: the platform volume counter must keep counting past the int32 limit
// (2,147,483,647 fils), just above the 2,000,000,000-fil tier threshold.
func TestM6_PlatformVolumePastInt32(t *testing.T) {
	pool := mustPool(t)
	ctx := context.Background()
	resetPlatformStats(t, pool)
	t.Cleanup(func() { resetPlatformStats(t, pool) })

	cases := []struct {
		name  string
		start int64
		gross int64
		want  int64
	}{
		{"crosses the int32 limit", 2_100_000_000, 100_000_000, 2_200_000_000},
		{"lands exactly on the int32 limit", 2_147_483_000, 647, 2_147_483_647},
		{"one fil past the int32 limit", 2_147_483_647, 1, 2_147_483_648},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			tx, err := pool.Begin(ctx)
			if err != nil {
				t.Fatalf("begin: %v", err)
			}
			defer tx.Rollback(ctx) //nolint:errcheck

			if _, err := tx.Exec(ctx, `UPDATE platform_stats SET total_processed_fils = $1 WHERE id = 1`, tc.start); err != nil {
				t.Fatalf("M6: seed counter at %d: %v", tc.start, err)
			}
			current, err := ReadAndLockPlatformProcessedFils(ctx, tx)
			if err != nil {
				t.Fatalf("M6: ReadAndLockPlatformProcessedFils: %v", err)
			}
			if err := RecordPlatformProcessedVolume(ctx, tx, current, tc.gross); err != nil {
				t.Fatalf("M6: RecordPlatformProcessedVolume(%d): %v", tc.gross, err)
			}

			var got int64
			if err := tx.QueryRow(ctx, `SELECT total_processed_fils FROM platform_stats WHERE id = 1`).Scan(&got); err != nil {
				t.Fatalf("M6: read back total: %v", err)
			}
			if got != tc.want {
				t.Fatalf("M6: total_processed_fils = %d, want %d (counter must not wrap)", got, tc.want)
			}

			after, err := ReadAndLockPlatformProcessedFils(ctx, tx)
			if err != nil {
				t.Fatalf("M6: re-read counter: %v", err)
			}
			if bonus := VolumeTierMdrBonusBps(after); bonus != 15 {
				t.Errorf("M6: VolumeTierMdrBonusBps(%d) = %d, want 15 (tier must stay on past int32)", got, bonus)
			}
		})
	}
}
