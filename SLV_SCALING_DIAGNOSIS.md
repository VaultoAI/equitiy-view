# SLV Liquidity Chart Scaling Diagnosis

**Date:** January 24, 2026  
**Pool:** SLV-USDC (0xeeb8f880ead7281a301ef2e6791a6bbe790603ed)  
**Status:** ✅ **ROOT CAUSE IDENTIFIED**

---

## 1. Console Debug Output Summary

### Critical Values
```
Total raw liquidity: 677,292,234.47... (JSBI format, needs division by 1e18)
Number of raw bands: 199
Scaling factor: 1.504203698553...
TVL from props: $1,018,785.48
TVL value used for scaling: $1,018,785.48
Expected TVL: ~$1,024,411
```

### Top 5 Aggregated Bands (Displayed)
```
  1. $100.72 ↔ $98.75: $19,396.334
  2. $98.75 ↔ $96.79: $19,916.094
  3. $96.79 ↔ $94.82: $26,554.792
  4. $94.82 ↔ $92.85: $19,916.094
  5. $92.85 ↔ $90.89: $26,569.887
```

---

## 2. Root Cause Analysis

### Problem: Raw Liquidity is in JSBI Format (Not USD)

The key issue is in this line:
```typescript
const liquidityNum = parseFloat(band.liquidityActive.toString());
```

**`band.liquidityActive` is a JSBI value representing the raw Uniswap V3 liquidity**, not USD-denominated liquidity!

### Correct Formula

According to Uniswap V3:
```
Total Liquidity (USD) = Σ (amount0 × price0 + amount1 × price1)
```

Where:
- `amount0` and `amount1` are the token amounts locked in each tick range
- `price0` and `price1` are the USD prices of token0 and token1

### Current Incorrect Calculation

```typescript
// WRONG: Treating JSBI liquidity as USD value
const totalLiquidity = bands.reduce((sum, band) => {
  const liquidityNum = parseFloat(band.liquidityActive.toString());
  return sum + liquidityNum;
}, 0);
```

This sums up **raw JSBI liquidity values** (which are in wei-like units), not USD values!

---

## 3. Why the Scaling Factor is Wrong

```
scalingFactor = TVL / totalLiquidity
                = $1,018,785 / 677,292,234
                = 0.001503... (1.5e-3)
```

**This is backwards!** The denominator should be in **USD**, not raw JSBI units.

---

## 4. Correct Solution

### Option A: Use `band.liquidityUSD` Instead
If the `LiquidityBand` interface includes `liquidityUSD`:
```typescript
const totalLiquidity = bands.reduce((sum, band) => {
  return sum + band.liquidityUSD; // ← Use liquidityUSD, not liquidityActive
}, 0);
```

### Option B: Calculate USD Value from Amounts
If `liquidityUSD` is not available:
```typescript
const totalLiquidity = bands.reduce((sum, band) => {
  const amount0USD = parseFloat(band.amount0) * token0PriceUSD;
  const amount1USD = parseFloat(band.amount1) * token1PriceUSD;
  return sum + amount0USD + amount1USD;
}, 0);
```

---

## 5. Verification

### Expected After Fix
- `totalLiquidity` should be close to **$1,024,411** (the TVL)
- `scalingFactor` should be close to **1.0**
- Top band liquidity should be close to **$66,065**

### Current (Incorrect)
- `totalLiquidity` = **677,292,234** (raw JSBI, meaningless as USD)
- `scalingFactor` = **1.504**
- Top band liquidity = **$26,554** (40% of expected)

---

## 6. Implementation Plan

1. **Check `LiquidityBand` interface** - Does it include `liquidityUSD`?
2. **If yes**, change `totalLiquidity` calculation to use `band.liquidityUSD`
3. **If no**, calculate USD value from `amount0`, `amount1`, and token prices
4. **Remove or adjust scaling factor** - It should be close to 1.0 after fix
5. **Test with SLV pool** - Verify top band shows **~$66,065**

---

## Next Steps
1. Inspect `LiquidityBand` interface in `/lib/uniswap/activeLiquidity.ts`
2. Implement the fix based on Option A or B above
3. Reload the chart and verify values match expected data
