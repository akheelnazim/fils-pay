package config

import (
	"testing"
	"time"
)

func TestT4_PollIntervalMustBePositive(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://a/db")
	t.Setenv("PGCONN_SETTLEMENT", "")
	for _, value := range []string{"0", "-1", "9223372037"} {
		t.Run(value, func(t *testing.T) {
			t.Setenv("SETTLEMENT_DAEMON_POLL_INTERVAL_SECONDS", value)
			if _, err := Load(); err == nil {
				t.Fatalf("poll interval %s must be rejected", value)
			}
		})
	}
	t.Setenv("SETTLEMENT_DAEMON_POLL_INTERVAL_SECONDS", "1")
	cfg, err := Load()
	if err != nil || cfg.DaemonPollInterval != time.Second {
		t.Fatalf("valid interval: got %v, error %v", cfg.DaemonPollInterval, err)
	}
	t.Setenv("SETTLEMENT_DAEMON_POLL_INTERVAL_SECONDS", "9223372036")
	if _, err := Load(); err != nil {
		t.Fatalf("largest valid interval rejected: %v", err)
	}
}
