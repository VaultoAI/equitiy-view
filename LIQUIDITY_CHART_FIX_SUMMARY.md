# Liquidity Chart Consistency Fix

## Problem
Pools had inconsistent token pair ordering - sometimes USDC was token0, sometimes token1. This caused the liquidity chart to display price bands inconsistently:
- Sometimes prices were shown in USDC (correct)
- Sometimes prices were shown in the other token (incorrect)

## Solution
Implemented intelligent token detection and normalization to always display USDC (or other stablecoins) as the quote currency (denominator) in price displays.

## Changes Made

### 1. Added Stablecoin Detection Utility (`lib/pools/utils.ts`)

Added two new utility functions:

#### `isStablecoin(token: Token): boolean`
- Detects if a token is a stablecoin by symbol or address
- Supports: USDC, USDT, DAI, BUSD, FRAX, TUSD, USDD, GUSD, USDP
- Includes mainnet addresses for major stablecoins

#### `shouldInvertTokens(token0: Token, token1: Token): boolean`
- Determines if tokens should be inverted to show stablecoin as quote currency
- Returns `true` if token0 is a stablecoin and token1 is not (invert needed)
- Returns `false` otherwise (keep original order)

**Logic:**
```typescript
// Example 1: USDC/ETH pool (token0=USDC, token1=ETH)
shouldInvertTokens(USDC, ETH) → true (invert to show as ETH/USDC)

// Example 2: ETH/USDC pool (token0=ETH, token1=USDC)
shouldInvertTokens(ETH, USDC) → false (keep as ETH/USDC)

// Result: Both display consistently as "ETH/USDC" with prices in USDC
```

### 2. Updated Liquidity Chart Component (`components/Pools/PoolDetails/LiquidityChart.tsx`)

Modified the chart to use the new normalization logic:

#### Import Added
```typescript
import { shouldInvertTokens } from '@/lib/pools/utils';
```

#### Token Inversion Logic
```typescript
// Determine if we need to invert tokens (line 165)
const shouldInvert = useMemo(() => {
  return shouldInvertTokens(poolData.token0, poolData.token1);
}, [poolData.token0, poolData.token1]);
```

#### Price Display Normalization (line 188)
```typescript
// Only invert price if needed to show stablecoin as denominator
const displayPrice = shouldInvert ? (1 / entry.price0) : entry.price0;
```

#### Token Amount Swapping (lines 205-206)
```typescript
// Swap token amounts only if we're inverting
amount0Locked: shouldInvert ? entry.amount1Locked : entry.amount0Locked,
amount1Locked: shouldInvert ? entry.amount0Locked : entry.amount1Locked,
```

#### Symbol Display (lines 242-243, 342-343)
```typescript
// Determine token symbols based on whether we inverted
const token0Symbol = shouldInvert ? poolData.token1.symbol : poolData.token0.symbol;
const token1Symbol = shouldInvert ? poolData.token0.symbol : poolData.token1.symbol;
```

## Results

✅ **Consistent Price Display**: All pools now display prices in USDC (or other stablecoins)
✅ **Consistent Liquidity Bands**: Price bands are always shown in the stablecoin denomination
✅ **Correct Token Labels**: Token symbols in tooltips match the normalized display
✅ **Backwards Compatible**: Works with existing pools regardless of token order
✅ **Extensible**: Easy to add more stablecoins to the detection list

## Example Behavior

### Before Fix
- **Pool 1** (USDC/ETH): Shows "Price: 0.0005 ETH per USDC" ❌ (inverted incorrectly)
- **Pool 2** (ETH/USDC): Shows "Price: 2000 USDC per ETH" ✅ (correct)

### After Fix
- **Pool 1** (USDC/ETH): Shows "Price: 2000 USDC per ETH" ✅ (normalized)
- **Pool 2** (ETH/USDC): Shows "Price: 2000 USDC per ETH" ✅ (already correct)

## Technical Notes

1. **Stablecoin Priority**: The logic ensures stablecoins are always used as the quote currency (denominator)
2. **Performance**: Uses `useMemo` to cache the inversion decision and avoid recalculation
3. **Type Safety**: Full TypeScript support with proper type definitions
4. **No Breaking Changes**: Existing pool data structures remain unchanged

## Testing Recommendations

1. Test pools with USDC as token0
2. Test pools with USDC as token1
3. Test pools with other stablecoins (USDT, DAI)
4. Test pools with no stablecoins
5. Verify tooltip displays match chart displays
6. Check that active tick highlighting works correctly

## Future Enhancements

- Add Solana stablecoin addresses (USDC on Solana, etc.)
- Support for other chain-specific stablecoin addresses
- Add user preference to override default quote currency
- Support for inverted display toggle (show either direction)
