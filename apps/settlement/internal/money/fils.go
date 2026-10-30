// Package money is the Go port of packages/money/src/fils.ts's integer-fils
// arithmetic, matching its rounding exactly.
package money

import (
	"fmt"
	"math/big"
)

// Fils is a validated integer number of fils. 1 BD = 1000 fils.
type Fils int64

// AddFilsChecked reports a sum outside the int64 fils range.
func AddFilsChecked(a, b Fils) (Fils, error) {
	const max = int64(^uint64(0) >> 1)
	const min = -max - 1
	if (b > 0 && int64(a) > max-int64(b)) || (b < 0 && int64(a) < min-int64(b)) {
		return 0, fmt.Errorf("AddFilsChecked: result exceeds int64")
	}
	return a + b, nil
}

// SubtractFilsChecked reports a difference outside the int64 fils range.
func SubtractFilsChecked(a, b Fils) (Fils, error) {
	result := new(big.Int).Sub(big.NewInt(int64(a)), big.NewInt(int64(b)))
	if !result.IsInt64() {
		return 0, fmt.Errorf("SubtractFilsChecked: result exceeds int64")
	}
	return Fils(result.Int64()), nil
}

// ApplyRateFils applies a rate expressed in basis points to an amount, e.g.
// ApplyRateFils(10000, 250) applies a 2.50% MDR to 10.000 BD and returns
// 250. Uses deterministic half-to-even rounding.
func ApplyRateFils(amount Fils, rateBasisPoints int64) Fils {
	result, err := ApplyRateFilsChecked(amount, rateBasisPoints)
	if err != nil {
		panic(err)
	}
	return result
}

// ApplyRateFilsChecked reports results outside the int64 fils range.
func ApplyRateFilsChecked(amount Fils, rateBasisPoints int64) (Fils, error) {
	product := new(big.Int).Mul(big.NewInt(int64(amount)), big.NewInt(rateBasisPoints))
	negative := product.Sign() < 0
	product.Abs(product)
	quotient, remainder := new(big.Int), new(big.Int)
	quotient.QuoRem(product, big.NewInt(10_000), remainder)
	if remainder.Int64() > 5_000 || (remainder.Int64() == 5_000 && quotient.Bit(0) == 1) {
		quotient.Add(quotient, big.NewInt(1))
	}
	if negative {
		quotient.Neg(quotient)
	}
	if !quotient.IsInt64() {
		return 0, fmt.Errorf("ApplyRateFils: result exceeds int64")
	}
	return Fils(quotient.Int64()), nil
}

// BankersRoundDiv performs round-half-to-even integer division of
// numerator/denominator, matching packages/money/src/fils.ts's
// bankersRoundDiv's tie-breaking rule exactly, so Go and TypeScript never
// disagree about a shared rounding decision.
func BankersRoundDiv(numerator, denominator int64) int64 {
	if denominator == 0 {
		panic("BankersRoundDiv: denominator must not be zero")
	}
	negative := (numerator < 0) != (denominator < 0)
	absNum, absDen := abs64(numerator), abs64(denominator)
	quotient, remainder := absNum/absDen, absNum%absDen
	twiceRemainder := remainder * 2

	var rounded int64
	switch {
	case twiceRemainder < absDen:
		rounded = quotient
	case twiceRemainder > absDen:
		rounded = quotient + 1
	default: // exact tie: round to even
		if quotient%2 == 0 {
			rounded = quotient
		} else {
			rounded = quotient + 1
		}
	}
	if negative {
		return -rounded
	}
	return rounded
}

func abs64(n int64) int64 {
	if n < 0 {
		return -n
	}
	return n
}

// String satisfies fmt.Stringer for readable test failure output and log
// lines (fils integer, no unit conversion — never used for money display,
// which has no requirement in apps/settlement).
func (f Fils) String() string {
	return fmt.Sprintf("%dfils", int64(f))
}
