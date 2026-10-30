package settlement

import (
	"context"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/filspay/settlement/internal/money"
)

// UpdateLifetimePayoutMonitoringEstimate maintains the ops dashboard
// running payout total on the merchant row. Not payout-affecting.
func UpdateLifetimePayoutMonitoringEstimate(ctx context.Context, tx pgx.Tx, merchantID uuid.UUID, netPayoutFils money.Fils) error {
	_, err := tx.Exec(ctx, `
		UPDATE merchants
		   SET lifetime_net_payout_monitoring_estimate = lifetime_net_payout_monitoring_estimate + $2
		 WHERE id = $1
	`, merchantID, int64(netPayoutFils))
	return err
}
// EstimateMonthlyPayout returns an approximate total payout for the
// given merchant over the last 30 calendar days, used by the ops
// dashboard to flag merchants whose settlement run is unusually large
// or small relative to their recent history. Like
// UpdateLifetimePayoutMonitoringEstimate, this is a monitoring-only
// figure that never feeds into any payout-affecting code path.
func EstimateMonthlyPayout(ctx context.Context, tx pgx.Tx, merchantID uuid.UUID) (money.Fils, error) {
	rows, err := tx.Query(ctx, `
		SELECT net_payout_fils FROM settlement_batches
		 WHERE merchant_id = $1 AND status = 'paid' AND paid_at >= now() - interval '30 days'
		 ORDER BY paid_at DESC
	`, merchantID)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	var total money.Fils
	var count int
	for rows.Next() {
		var netFils int64
		if err := rows.Scan(&netFils); err != nil {
			return 0, err
		}
		total += money.Fils(netFils)
		count++
	}
	if err := rows.Err(); err != nil {
		return 0, err
	}
	return total, nil
}

// EstimateDrift is one merchant whose stored lifetime payout estimate
// differs from the payout legs in the ledger.
type EstimateDrift struct {
	MerchantID uuid.UUID
	StoredFils int64
	ActualFils int64
	DriftFils  int64 // stored - actual
}

// LifetimePayoutEstimateDrift (M19) compares each merchant's stored
// lifetime_net_payout_monitoring_estimate with what the ledger shows was
// actually paid out: the platform_cash credits posted by PayoutBatch and by
// the split payout. Read-only. Correcting a stored figure is a Finance
// decision, so nothing here writes. Merchants that agree are left out.
func LifetimePayoutEstimateDrift(ctx context.Context, db *pgxpool.Pool) ([]EstimateDrift, error) {
	rows, err := db.Query(ctx, `
		SELECT m.id, m.lifetime_net_payout_monitoring_estimate, COALESCE(p.paid, 0)
		  FROM merchants m
		  LEFT JOIN (
		        SELECT merchant_id, SUM(amount_fils) AS paid
		          FROM ledger_entries
		         WHERE account_id = 'platform_cash' AND direction = 'credit'
		           AND description LIKE 'settlement payout:%'
		         GROUP BY merchant_id
		       ) p ON p.merchant_id = m.id
		 WHERE m.lifetime_net_payout_monitoring_estimate <> COALESCE(p.paid, 0)
		 ORDER BY m.id
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var drifts []EstimateDrift
	for rows.Next() {
		var d EstimateDrift
		if err := rows.Scan(&d.MerchantID, &d.StoredFils, &d.ActualFils); err != nil {
			return nil, err
		}
		d.DriftFils = d.StoredFils - d.ActualFils
		drifts = append(drifts, d)
	}
	return drifts, rows.Err()
}
