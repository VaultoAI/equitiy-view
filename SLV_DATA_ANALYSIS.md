# SLV Liquidity Chart Data Analysis

**Date:** January 24, 2026  
**Pool:** SLV-USDC (0xeeb8f880ead7281a301ef2e6791a6bbe790603ed)  
**Status:** ⚠️ **DATA MISMATCH CONFIRMED**

---

## 1. Console Debug Output

### Top 5 Aggregated Bands (Actual - from chart)
```
  1. $100.72 ↔ $98.75: $19,396.334
  2. $98.75 ↔ $96.79: $19,916.094
  3. $96.79 ↔ $94.82: $26,554.792 ← Focus band
  4. $94.82 ↔ $92.85: $19,916.094
  5. $92.85 ↔ $90.89: $26,569.887
```

### Expected Top Bands (from reliable source)
```
  1. $96.75 ↔ $94.84: $66,065 ← Expected match
  2. $94.84 ↔ $92.96: $65,772
  3. $92.96 ↔ $91.12: $65,807
```

---

## 2. Comparison Analysis

| Metric | Expected | Actual | Delta |
|--------|----------|--------|-------|
| **Top Band Price Range** | $96.75 ↔ $94.84 | $96.79 ↔ $94.82 | ✅ **±$0.04** (0.04%) |
| **Top Band Liquidity** | $66,065 | $26,554.792 | ❌ **-$39,510** (-60%) |
| **Price Precision** | Excellent | Excellent | Match |
| **Liquidity Value** | N/A | ~40% of expected | **Major Discrepancy** |

**Key Finding:** Price ranges are **nearly identical**, but liquidity values are **40% of expected**

---

## 3. Possible Root Causes

### A. Scaling Factor Issue ✅ (Most Likely)
- **Symptom:** Liquidity is consistently ~40% of expected
- **Cause:** Incorrect TVL value or raw liquidity calculation
- **Evidence:** Ratio is consistent (26,554 / 66,065 ≈ 0.40)
- **Next Step:** Check `tvlUSD`, `totalLiquidity`, and `scalingFactor` values

### B. Data Aggregation Issue
- **Symptom:** Bands might be incorrectly combined
- **Cause:** Band range ($100.72 ↔ $98.75) is larger than expected (~$2 vs expected tighter bands)
- **Evidence:** Chart uses `TARGET_BAR_COUNT = 20` to aggregate 200 raw bands
- **Next Step:** Check `combinedBands` logic

### C. Raw Data Fetching Issue
- **Symptom:** Source data from The Graph might be incomplete
- **Cause:** GraphQL query might not return all tick data
- **Evidence:** Need to verify raw tick data count
- **Next Step:** Add debug logs to show number of raw bands before aggregation

---

## 4. Diagnostic Steps Needed

### Step 1: Check Scaling Factor
Add logs in `HorizontalLiquidityChart.tsx` to inspect:
```typescript
console.log('[SLV DEBUG] Scaling factor:', scalingFactor);
console.log('[SLV DEBUG] TVL from props:', tvlUSD);
console.log('[SLV DEBUG] Total raw liquidity:', totalLiquidity);
console.log('[SLV DEBUG] Number of raw bands:', bands.length);
```

### Step 2: Verify Raw Data Count
Expected: ~200 raw bands  
Actual: Need to verify

### Step 3: Check Band Aggregation Logic
Verify that the `combinedBands` Map correctly sums liquidity for overlapping price ranges.

---

## 5. Expected Debug Output

When we add the logs from Step 1, we should see:
```
[SLV DEBUG] Total raw liquidity: [VALUE]
[SLV DEBUG] TVL from props: $1,024,411 (or similar)
[SLV DEBUG] Scaling factor: [VALUE]
[SLV DEBUG] Number of raw bands: ~200
```

If `scalingFactor` is close to **0.40**, that confirms the scaling issue.  
If `Number of raw bands` is significantly less than 200, that suggests a data fetching issue.

---

## 6. Recommended Fix

Based on the consistent 40% ratio, the most likely fix is to:
1. **Verify TVL calculation** in `usePoolData` hook
2. **Check raw liquidity calculation** in `processTicks` function
3. **Ensure scaling factor** correctly maps raw liquidity to TVL

---

## Next Steps
1. Add debug logs for `scalingFactor`, `tvlUSD`, and `totalLiquidity`
2. Run the chart again and capture console output
3. Identify which value is causing the 2.5x discrepancy (66,065 / 26,554 ≈ 2.49)
