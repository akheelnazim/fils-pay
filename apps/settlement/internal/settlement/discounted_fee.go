package settlement

import "github.com/filspay/settlement/internal/money"

// ComputeSettlementFee computes the platform fee owed on one capture event,
// net of any negotiated per-merchant discount.
func ComputeSettlementFee(amountFils money.Fils, mdrBasisPoints, discountBasisPoints int64) money.Fils {
	fee, err := computeSettlementFeeChecked(amountFils, mdrBasisPoints, discountBasisPoints)
	if err != nil {
		panic(err)
	}
	return fee
}

func computeSettlementFeeChecked(amountFils money.Fils, mdrBasisPoints, discountBasisPoints int64) (money.Fils, error) {
	fee, err := money.ApplyRateFilsChecked(amountFils, mdrBasisPoints)
	if err != nil {
		return 0, err
	}
	discount, err := money.ApplyRateFilsChecked(fee, discountBasisPoints)
	if err != nil {
		return 0, err
	}
	return money.SubtractFilsChecked(fee, discount)
}
