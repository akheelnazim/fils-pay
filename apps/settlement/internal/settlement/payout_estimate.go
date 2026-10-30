package settlement

import (
	"context"
	"fmt"

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
		SELECT sb.id, sb.net_payout_fils,
		       COALESCE(SUM(le.amount_fils) FILTER (WHERE le.description IN ('settlement payout: batch paid', 'settlement payout: split to sub-merchant')), 0),
		       COUNT(le.id) FILTER (WHERE le.description IN ('settlement payout: batch paid', 'settlement payout: split to sub-merchant')),
		       COUNT(le.id) FILTER (WHERE le.description IS NULL OR le.description NOT IN ('settlement payout: batch paid', 'settlement payout: split to sub-merchant')),
		       EXISTS (SELECT 1 FROM settlement_batch_splits s WHERE s.settlement_batch_id = sb.id)
		       AND NOT EXISTS (SELECT 1 FROM settlement_batch_splits s WHERE s.settlement_batch_id = sb.id AND s.allocated_fils <> 0)
		  FROM settlement_batches sb
		  LEFT JOIN ledger_entries le ON le.settlement_batch_id = sb.id AND le.merchant_id = sb.merchant_id
		       AND le.account_id = 'platform_cash' AND le.direction = 'credit'
		 WHERE sb.merchant_id = $1 AND sb.status = 'paid' AND sb.paid_at >= now() - interval '30 days'
		 GROUP BY sb.id
		 ORDER BY sb.paid_at DESC
	`, merchantID)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	var total money.Fils
	for rows.Next() {
		var batchID uuid.UUID
		var netFils, payoutFils, recognized, unknown int64
		var zeroSplit bool
		if err := rows.Scan(&batchID, &netFils, &payoutFils, &recognized, &unknown, &zeroSplit); err != nil {
			return 0, err
		}
		if unknown > 0 || (netFils != 0 && recognized == 0 && !zeroSplit) {
			return 0, fmt.Errorf("EstimateMonthlyPayout: cannot determine payout for batch %s", batchID)
		}
		total, err = money.AddFilsChecked(total, money.Fils(payoutFils))
		if err != nil {
			return 0, err
		}
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
