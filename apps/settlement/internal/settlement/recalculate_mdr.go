package settlement

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/filspay/settlement/internal/balances"
	"github.com/filspay/settlement/internal/money"
)

// BatchAdjustment is one batch's before/after fee, as changed by a
// recalculation pass.
//
// DiffFils is NewFeeFils - OldFeeFils. A positive diff means the merchant was
// undercharged at close; the correcting ledger group lands in the current
// period's batch, so the original batch's figures stay as they were paid.
type BatchAdjustment struct {
	BatchID    uuid.UUID
	BatchDate  time.Time
	Status     string
	OldFeeFils money.Fils
	NewFeeFils money.Fils
	DiffFils   money.Fils
}

// RecalcResult summarizes one RecalculateMDR pass.
type RecalcResult struct {
	BatchesConsidered int
	Adjusted          []BatchAdjustment
}

// batchRow is one settlement_batches row as read by the recalculation scan.
type batchRow struct {
	id            uuid.UUID
	batchDate     time.Time
	status        string
	grossFils     money.Fils
	feeFils       money.Fils
	netPayoutFils money.Fils
}

// RecalculateMDR re-derives the fee on a merchant's closed batches in
// [from, to) at the merchant's current terms and posts the difference.
func RecalculateMDR(ctx context.Context, db *pgxpool.Pool, merchantID uuid.UUID, from, to time.Time) (RecalcResult, error) {
	tx, err := db.Begin(ctx)
	if err != nil {
		return RecalcResult{}, fmt.Errorf("settlement: RecalculateMDR: begin: %w", err)
	}
	defer tx.Rollback(ctx) //nolint:errcheck

	var mdrBps, discountBps int64
	err = tx.QueryRow(ctx, `SELECT mdr_bps, negotiated_discount_bps FROM merchants WHERE id = $1`, merchantID).
		Scan(&mdrBps, &discountBps)
	if err != nil {
		return RecalcResult{}, fmt.Errorf("settlement: RecalculateMDR: load merchant: %w", err)
	}

	rows, err := tx.Query(ctx, `
		SELECT id, batch_date, status, gross_fils, fee_fils, net_payout_fils
		  FROM settlement_batches
		 WHERE merchant_id = $1 AND batch_date >= $2 AND batch_date < $3
		   AND status <> 'open'
		 ORDER BY batch_date
		 FOR UPDATE
	`, merchantID, from, to)
	if err != nil {
		return RecalcResult{}, fmt.Errorf("settlement: RecalculateMDR: select batches: %w", err)
	}
	var batches []batchRow
	for rows.Next() {
		var b batchRow
		var gross, fee, net int64
		if err := rows.Scan(&b.id, &b.batchDate, &b.status, &gross, &fee, &net); err != nil {
			rows.Close()
			return RecalcResult{}, fmt.Errorf("settlement: RecalculateMDR: scan batch: %w", err)
		}
		b.grossFils = money.Fils(gross)
		b.feeFils = money.Fils(fee)
		b.netPayoutFils = money.Fils(net)
		batches = append(batches, b)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return RecalcResult{}, fmt.Errorf("settlement: RecalculateMDR: iterate batches: %w", err)
	}
	rows.Close()

	var adjusted []BatchAdjustment
	for _, b := range batches {
		newFee, err := recomputeBatchFee(ctx, tx, b.id, mdrBps, discountBps)
		if err != nil {
			return RecalcResult{}, err
		}
		// F20: the fee compared is the one the batch kept: capture fees less the
		// fee given back on the refunds it took. Re-rating only the kept part
		// means a fully refunded batch has nothing to re-rate at any rate.
		refundFeeNew, refundFeeOld, err := batchRefundFees(ctx, tx, b.id, mdrBps, discountBps)
		if err != nil {
			return RecalcResult{}, err
		}
		if newFee, err = money.SubtractFilsChecked(newFee, refundFeeNew); err != nil {
			return RecalcResult{}, fmt.Errorf("settlement: RecalculateMDR: kept fee: %w", err)
		}
		oldFee, err := money.SubtractFilsChecked(b.feeFils, refundFeeOld)
		if err != nil {
			return RecalcResult{}, fmt.Errorf("settlement: RecalculateMDR: kept fee before: %w", err)
		}
		if b.status == "paid" {
			// M8: a paid batch's fee_fils is never rewritten, so count what
			// earlier passes already booked against it, or a re-run posts again.
			booked, err := paidBatchBookedAdjustment(ctx, tx, b.id)
			if err != nil {
				return RecalcResult{}, err
			}
			oldFee, err = money.AddFilsChecked(oldFee, booked)
			if err != nil {
				return RecalcResult{}, fmt.Errorf("settlement: RecalculateMDR: sum booked fee: %w", err)
			}
		}
		diff, err := money.SubtractFilsChecked(newFee, oldFee)
		if err != nil {
			return RecalcResult{}, fmt.Errorf("settlement: RecalculateMDR: fee difference: %w", err)
		}
		if diff == 0 {
			continue
		}
		// F16/F18: refunds can already have taken an unpaid batch's net to 0, so a
		// fee increase can only be charged up to the net that is left. The charge
		// actually applied is what the ledger, the stored fee, the net and the
		// cache all move by, so a later decrease gives back only what was taken.
		if b.status != "paid" && diff > b.netPayoutFils {
			diff = b.netPayoutFils
			if diff == 0 {
				continue
			}
		}
		if newFee, err = money.AddFilsChecked(oldFee, diff); err != nil {
			return RecalcResult{}, fmt.Errorf("settlement: RecalculateMDR: applied fee: %w", err)
		}
		// fee_fils keeps holding the capture fee (what CloseBatch stored), moved
		// by the change actually applied.
		storedFee, err := money.AddFilsChecked(b.feeFils, diff)
		if err != nil {
			return RecalcResult{}, fmt.Errorf("settlement: RecalculateMDR: stored fee: %w", err)
		}
		// F8: move the stored net by the fee difference rather than rebuilding
		// it as gross - fee, which would drop the refunds CloseBatch deducted.
		newNetPayout, err := money.SubtractFilsChecked(b.netPayoutFils, diff)
		if err != nil {
			return RecalcResult{}, fmt.Errorf("settlement: RecalculateMDR: net payout: %w", err)
		}
		if err := postMdrAdjustment(ctx, tx, merchantID, b.id, diff); err != nil {
			return RecalcResult{}, err
		}
		// M8: a paid batch's figures are what was actually paid out and are no
		// longer in the payable cache, so only the ledger adjustment is posted.
		if b.status != "paid" {
			if _, err := tx.Exec(ctx, `
				UPDATE settlement_batches SET fee_fils = $2, net_payout_fils = $3 WHERE id = $1
			`, b.id, int64(storedFee), int64(newNetPayout)); err != nil {
				return RecalcResult{}, fmt.Errorf("settlement: RecalculateMDR: update batch %s: %w", b.id, err)
			}
			// A fee increase (diff > 0) reduces net payout owed, so the cache
			// moves by -diff — the same signed-delta idiom ApplyBatchClose
			// already exposes for a batch close's own net payout.
			cacheDelta, err := money.SubtractFilsChecked(0, diff)
			if err != nil {
				return RecalcResult{}, fmt.Errorf("settlement: RecalculateMDR: cache delta: %w", err)
			}
			if err := balances.ApplyBatchClose(ctx, tx, merchantID, b.id, cacheDelta); err != nil {
				return RecalcResult{}, fmt.Errorf("settlement: RecalculateMDR: apply cache delta for %s: %w", b.id, err)
			}
		}
		adjusted = append(adjusted, BatchAdjustment{
			BatchID:    b.id,
			BatchDate:  b.batchDate,
			Status:     b.status,
			OldFeeFils: oldFee,
			NewFeeFils: newFee,
			DiffFils:   diff,
		})
	}

	if err := tx.Commit(ctx); err != nil {
		return RecalcResult{}, fmt.Errorf("settlement: RecalculateMDR: commit: %w", err)
	}
	return RecalcResult{BatchesConsidered: len(batches), Adjusted: adjusted}, nil
}

// recomputeBatchFee sums ComputeSettlementFee over every transaction_events
// row carrying this batch's id — the same per-event-then-sum discipline
// CloseBatch step 8 uses, never ApplyRateFils applied once to a pre-summed
// total, so this recomputation can never itself diverge from what a fresh
// CloseBatch would have produced at today's rate.
func recomputeBatchFee(ctx context.Context, tx pgx.Tx, batchID uuid.UUID, mdrBps, discountBps int64) (money.Fils, error) {
	rows, err := tx.Query(ctx, `
		SELECT amount_fils FROM transaction_events WHERE settlement_batch_id = $1 ORDER BY id
	`, batchID)
	if err != nil {
		return 0, fmt.Errorf("settlement: RecalculateMDR: select batch events for %s: %w", batchID, err)
	}
	defer rows.Close()

	var fee money.Fils
	for rows.Next() {
		var amountFils int64
		if err := rows.Scan(&amountFils); err != nil {
			return 0, fmt.Errorf("settlement: RecalculateMDR: scan batch event for %s: %w", batchID, err)
		}
		// FH: sums every event with this batch id -- incl. refund events once FP-212 lands? need an event_type filter?
		// MK: refunds won't carry settlement_batch_id on transaction_events, they live in their own table. non-issue
		eventFee, err := computeSettlementFeeChecked(money.Fils(amountFils), mdrBps, discountBps)
		if err != nil {
			return 0, fmt.Errorf("settlement: RecalculateMDR: compute fee: %w", err)
		}
		fee, err = money.AddFilsChecked(fee, eventFee)
		if err != nil {
			return 0, fmt.Errorf("settlement: RecalculateMDR: sum fees: %w", err)
		}
	}
	if err := rows.Err(); err != nil {
		return 0, fmt.Errorf("settlement: RecalculateMDR: iterate batch events for %s: %w", batchID, err)
	}
	return fee, nil
}

// batchRefundFees returns, for the refunds a batch took (F8), the fee they
// would give back at the given terms (each refund re-rated on its own, the
// same per-event rule as a capture) and the fee they actually gave back.
func batchRefundFees(ctx context.Context, tx pgx.Tx, batchID uuid.UUID, mdrBps, discountBps int64) (atNewTerms, given money.Fils, err error) {
	rows, err := tx.Query(ctx, `
		SELECT amount_fils, fee_reversed_fils FROM refunds WHERE settlement_batch_id = $1 ORDER BY id
	`, batchID)
	if err != nil {
		return 0, 0, fmt.Errorf("settlement: RecalculateMDR: select batch refunds for %s: %w", batchID, err)
	}
	defer rows.Close()
	for rows.Next() {
		var amount, reversed int64
		if err := rows.Scan(&amount, &reversed); err != nil {
			return 0, 0, fmt.Errorf("settlement: RecalculateMDR: scan batch refund for %s: %w", batchID, err)
		}
		fee, err := computeSettlementFeeChecked(money.Fils(amount), mdrBps, discountBps)
		if err != nil {
			return 0, 0, fmt.Errorf("settlement: RecalculateMDR: refund fee: %w", err)
		}
		if atNewTerms, err = money.AddFilsChecked(atNewTerms, fee); err != nil {
			return 0, 0, fmt.Errorf("settlement: RecalculateMDR: sum refund fees: %w", err)
		}
		if given, err = money.AddFilsChecked(given, money.Fils(reversed)); err != nil {
			return 0, 0, fmt.Errorf("settlement: RecalculateMDR: sum reversed fees: %w", err)
		}
	}
	if err := rows.Err(); err != nil {
		return 0, 0, fmt.Errorf("settlement: RecalculateMDR: iterate batch refunds for %s: %w", batchID, err)
	}
	return atNewTerms, given, nil
}

// paidBatchBookedAdjustment returns the fee change already booked on a paid
// batch by MDR adjustments posted after it was paid (fee revenue credits minus
// debits). Adjustments posted while it was still closed are already in its
// fee_fils, so they are not counted.
func paidBatchBookedAdjustment(ctx context.Context, tx pgx.Tx, batchID uuid.UUID) (money.Fils, error) {
	var booked int64
	err := tx.QueryRow(ctx, `
		SELECT COALESCE(SUM(CASE WHEN le.direction = 'credit' THEN le.amount_fils ELSE -le.amount_fils END), 0)
		  FROM ledger_entries le
		  JOIN settlement_batches sb ON sb.id = le.settlement_batch_id
		 WHERE le.settlement_batch_id = $1
		   AND le.account_id = 'platform_fee_revenue'
		   AND le.description = 'MDR recalculation adjustment'
		   AND le.occurred_at >= sb.paid_at
	`, batchID).Scan(&booked)
	if err != nil {
		return 0, fmt.Errorf("settlement: RecalculateMDR: booked adjustments for %s: %w", batchID, err)
	}
	return money.Fils(booked), nil
}

// postMdrAdjustment posts the two-leg, entry_group_id-balanced pair for one
// batch's fee difference. A fee increase moves money from the merchant to
// platform fee revenue; a decrease reverses both legs. ledger_entries has a
// CHECK (amount_fils > 0), so the magnitude is always posted positive and
// the sign is carried by which account is debited.
//
// Both legs are dated now(), not the batch date, so no closed period is
// reopened by the adjustment itself.
func postMdrAdjustment(ctx context.Context, tx pgx.Tx, merchantID, batchID uuid.UUID, diff money.Fils) error {
	if diff == 0 {
		return nil
	}
	magnitude := diff
	if magnitude < 0 {
		var err error
		magnitude, err = money.SubtractFilsChecked(0, magnitude)
		if err != nil {
			return fmt.Errorf("settlement: RecalculateMDR: adjustment magnitude: %w", err)
		}
	}

	// YA 2026-01-20: a fee decrease still debits merchant_payable here, same as an increase, the sign is in the amount
	debitAccount, creditAccount := "merchant_payable", "platform_fee_revenue"
	if diff < 0 {
		debitAccount, creditAccount = "platform_fee_revenue", "merchant_payable"
	}

	_, err := tx.Exec(ctx, `
		INSERT INTO ledger_entries
		  (entry_group_id, merchant_id, settlement_batch_id, account_id, direction, amount_fils, occurred_at, description)
		VALUES
		  ($1, $2, $3, $4, 'debit',  $6, now(), 'MDR recalculation adjustment'),
		  ($1, $2, $3, $5, 'credit', $6, now(), 'MDR recalculation adjustment')
	`, uuid.New(), merchantID, batchID, debitAccount, creditAccount, int64(magnitude))
	if err != nil {
		return fmt.Errorf("settlement: RecalculateMDR: post adjustment for batch %s: %w", batchID, err)
	}
	return nil
}
