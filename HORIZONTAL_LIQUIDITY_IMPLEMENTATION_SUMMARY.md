# Horizontal Liquidity Band Chart Implementation Summary

## Overview
Successfully implemented the horizontal liquidity band chart on the pool details page, following the integration guide specifications. The chart displays liquidity distribution across price bands in Uniswap V3 pools using horizontal bars.

## Implementation Details

### 1. GraphQL Query for Ticks (`lib/graphql/queries/poolTicks.graphql`)
- Created query to fetch pool tick data from Uniswap V3 subgraph
- Includes: tick index, liquidity gross/net, prices, current tick, and pool state
- Supports pagination to handle large tick datasets (up to 5000 ticks)

### 2. Custom Hook (`hooks/usePoolTicks.ts`)
- `usePoolTicks(poolAddress)` - Fetches and processes tick data
- Features:
  - Automatic batching for large tick datasets (1000 per request)
  - Safety limit of 5000 ticks to prevent excessive fetching
  - Proper data transformation from GraphQL to TypeScript types
  - Caching with 1-minute stale time

### 3. Liquidity Calculation Utilities (`lib/uniswap/activeLiquidity.ts`)
Based on Uniswap V3 methodology:
- `computeActiveLiquidityBands()` - Main function to calculate liquidity bands
- `tickToPriceNumber()` - Converts tick indices to human-readable prices
- `computeLockedAmounts()` - Calculates token amounts using Uniswap V3 formulas
- `convertToSecurityPerUSDC()` - Normalizes prices to USD denomination

**Key Features:**
- Processes ticks bidirectionally (above and below current price)
- Calculates active liquidity at each tick using `liquidityNet`
- Computes USD value for each liquidity band
- Supports proper tick spacing based on fee tiers

### 4. Horizontal Liquidity Chart Component (`components/Pools/PoolDetails/HorizontalLiquidityChart.tsx`)
A Recharts-based visualization with:

**Visual Features:**
- **Horizontal bars**: Price ranges on Y-axis, liquidity amounts on X-axis
- **Color coding**:
  - 🟢 Green (#10B981): Bands above current price (future USDC)
  - 🩷 Pink (#F51E87): Current price band (actively trading)
  - 🔵 Blue (#2172E5): Bands below current price (future security token)
- **Current band highlighting**: Distinctive stroke and 100% opacity
- **Sorted display**: High to low price (top to bottom)

**Technical Features:**
- TVL scaling to match pool's total value locked
- Filters negligible bands (< $0.50)
- Custom tooltip with price range and liquidity value
- Responsive height based on number of bands (max 800px)
- Custom legend showing token symbols

### 5. Integration into Pool Details Page (`app/pools/[chain]/[poolAddress]/page.tsx`)
Modified layout to create a responsive grid:
- **Desktop (xl breakpoint)**: 3-column grid
  - TVL/Volume/Price chart: 2 columns (left)
  - Horizontal liquidity chart: 1 column (right)
- **Mobile/Tablet**: Stacked vertically

**Data Flow:**
1. Fetch pool data (existing hook)
2. Fetch tick data (new hook)
3. Create Uniswap Token instances from pool data
4. Compute liquidity bands using tick data
5. Render horizontal chart alongside TVL chart

## Color Semantics

The chart uses a intuitive color system relative to current price:

- **Green Bands** (Above): Represent ranges where the pool holds mostly USDC. If price rises into these bands, liquidity will be swapped to the security token.
- **Pink Band** (Current): The active price range where trades are currently executing. This band has the most recent trading activity.
- **Blue Bands** (Below): Represent ranges where the pool holds mostly the security token. If price falls into these bands, liquidity will be swapped to USDC.

## Mathematical Foundation

### Active Liquidity Calculation
Following Uniswap V3 methodology:
1. Start with pool's total liquidity at current tick
2. Traverse ticks bidirectionally (up and down)
3. Add/subtract `liquidityNet` when crossing initialized ticks
4. Result: Available liquidity for swaps in each price band

### Locked Amounts Formula
```
amount0 = L × (√P_upper - √P_lower) / (√P_lower × √P_upper)
amount1 = L × (√P_upper - √P_lower)
```

Where:
- L = Liquidity value (JSBI BigInt)
- P = Price at tick (sqrt ratio)
- Q96 = 2^96 (fixed-point precision)

### USD Value Calculation
```
liquidityUSD = usdcAmount + (securityAmount × midPriceUSD)
```

## Files Created/Modified

### Created:
1. `lib/graphql/queries/poolTicks.graphql` - GraphQL query for ticks
2. `hooks/usePoolTicks.ts` - Custom hook for fetching ticks
3. `lib/uniswap/activeLiquidity.ts` - Liquidity calculation utilities
4. `components/Pools/PoolDetails/HorizontalLiquidityChart.tsx` - Chart component

### Modified:
1. `app/pools/[chain]/[poolAddress]/page.tsx` - Added chart integration
2. `components/Pools/PoolDetails/TVLChart.tsx` - Removed bottom margin

## Dependencies Used
All required dependencies already exist:
- `@uniswap/v3-sdk` - Tick math and price calculations
- `@uniswap/sdk-core` - Token abstractions
- `jsbi` - Big integer math (transitive dependency)
- `recharts` - Chart rendering
- `@tanstack/react-query` - Data fetching
- `@apollo/client` - GraphQL queries

## Features

✅ **Accurate Liquidity Display**: Shows real liquidity distribution from on-chain tick data
✅ **Dynamic Coloring**: Visual distinction between price ranges
✅ **Current Price Highlighting**: Pink stroke around active trading band
✅ **TVL Scaling**: Normalizes displayed values to match pool's TVL
✅ **Responsive Layout**: Works on desktop and mobile
✅ **Interactive Tooltips**: Hover for detailed price range and liquidity
✅ **Performance Optimized**: Memoized calculations and filtered display
✅ **Type Safe**: Full TypeScript support throughout

## Usage Example

The chart automatically appears on pool details pages for Ethereum pools:

```
/pools/ethereum/0x123...abc
```

**Data Requirements:**
- Pool must be Uniswap V3 on Ethereum
- Pool must have initialized ticks
- The Graph API must be accessible

## Configuration

### Number of Surrounding Ticks
Adjust the number of bands shown (default: 100 on each side):

```typescript
const bands = computeActiveLiquidityBands(
  ticksData.tick,
  ticksData.liquidity,
  tickSpacing,
  token0,
  token1,
  100, // <- Change this value
  ticksData.ticks,
  isUSDC0
);
```

### Minimum Liquidity Threshold
Filter out small bands (default: $0.50):

```typescript
.filter((band) => band.liquidityActive >= 0.50) // <- Change this value
```

### Chart Height
Adjust max height (default: 800px):

```typescript
maxHeight: '800px' // <- Change this value
```

## Known Limitations

1. **Tick Limit**: Fetches maximum 5000 ticks for performance
2. **Ethereum Only**: Currently only supports Ethereum mainnet pools
3. **Solana Pools**: Disabled for Solana (different AMM structure)
4. **Loading State**: Chart hidden until tick data loads

## Future Enhancements

- [ ] Add zoom/pan controls for large datasets
- [ ] Show historical liquidity distribution changes
- [ ] Add click-to-highlight band feature
- [ ] Display user's position within the bands
- [ ] Export chart as image
- [ ] Logarithmic scale option for large value ranges
- [ ] Cross-chain support (Arbitrum, Optimism, etc.)

## Testing Recommendations

1. **Test with various pool types**:
   - High liquidity pools (concentrated bands)
   - Low liquidity pools (sparse bands)
   - Tokenized stock pools (SLVon/USDC)
   - Standard pairs (ETH/USDC)

2. **Test responsive behavior**:
   - Desktop view (xl breakpoint)
   - Tablet view (md breakpoint)
   - Mobile view (< 768px)

3. **Verify color coding**:
   - Check current band is pink with stroke
   - Bands above are green
   - Bands below are blue

4. **Performance testing**:
   - Pools with 1000+ initialized ticks
   - Multiple charts on screen
   - Rapid navigation between pools

## Troubleshooting

### Chart Not Appearing
- Check browser console for GraphQL errors
- Verify The Graph API key is configured
- Ensure pool has initialized ticks
- Check that pool is on Ethereum mainnet

### Incorrect Colors
- Verify `isUSDC0` logic is correct
- Check `currentTick` matches actual pool state
- Ensure tick data is properly sorted

### Performance Issues
- Reduce `numSurroundingTicks` parameter
- Increase minimum liquidity threshold
- Check for excessive re-renders (use React DevTools)

## Technical Notes

1. **JSBI Usage**: All liquidity values use JSBI (JavaScript Big Integers) to prevent overflow
2. **Tick Spacing**: Automatically determined from pool's fee tier
3. **Price Inversion**: Handles both USDC/Token and Token/USDC pool orders
4. **Memory Management**: Memoized calculations prevent unnecessary recomputation
5. **Type Safety**: Complete TypeScript coverage with proper interfaces

## Resources

- [Uniswap V3 Whitepaper](https://uniswap.org/whitepaper-v3.pdf)
- [Uniswap V3 SDK Documentation](https://docs.uniswap.org/sdk/v3/overview)
- [The Graph Uniswap Subgraph](https://thegraph.com/hosted-service/subgraph/uniswap/uniswap-v3)
- [Recharts Documentation](https://recharts.org/)

## Conclusion

The horizontal liquidity band chart provides valuable insights into liquidity distribution across price ranges in Uniswap V3 pools. The implementation follows Uniswap's canonical methodology and integrates seamlessly with the existing pool details page architecture.
