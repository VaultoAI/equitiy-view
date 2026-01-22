# Horizontal Liquidity Band Chart - Quick Start Guide

## Overview
The horizontal liquidity band chart is now integrated into the pool details page. This guide will help you test and verify the implementation.

## What Was Implemented

Following the `HORIZONTAL_LIQUIDITY_INTEGRATION_GUIDE.md`, we've added:

1. ✅ GraphQL query for fetching tick data
2. ✅ Custom React hook for tick data management
3. ✅ Liquidity calculation utilities (Uniswap V3 formulas)
4. ✅ Horizontal bar chart component with Recharts
5. ✅ Integration into pool details page with responsive grid layout

## How to Test

### Step 1: Start the Development Server
```bash
npm run dev
```

### Step 2: Navigate to a Pool Details Page
Visit any Ethereum Uniswap V3 pool:
```
http://localhost:3000/pools/ethereum/[POOL_ADDRESS]
```

**Example pools to test:**
- SLVon/USDC pool (tokenized stock)
- ETH/USDC pool (standard pair)
- Any V3 pool from the pools list page

### Step 3: Verify the Chart Appears
The page should show:
- **Left side (2 columns)**: TVL, Volume & Price chart (existing)
- **Right side (1 column)**: Horizontal Liquidity Distribution chart (new)

### Step 4: Check Chart Features

#### Visual Elements
- [ ] Horizontal bars showing liquidity amounts
- [ ] Price labels on the right Y-axis
- [ ] Liquidity amounts on the X-axis
- [ ] Current price band highlighted in pink with stroke
- [ ] Bands above current price in green
- [ ] Bands below current price in blue
- [ ] Legend showing token symbols

#### Interactions
- [ ] Hover over bars shows tooltip with:
  - Price range (e.g., "$30.50 ↔ $31.00")
  - Liquidity amount (e.g., "$50,000")
- [ ] Chart scrolls if many bands (> 32)
- [ ] Responsive layout on mobile (stacks vertically)

#### Loading States
- [ ] Skeleton loader shows while fetching tick data
- [ ] Chart appears after data loads
- [ ] No errors in browser console

## Expected Behavior

### Desktop (xl breakpoint: ≥ 1280px)
```
┌──────────────────────────┬─────────────┐
│  TVL, Volume & Price    │  Liquidity  │
│       (2 columns)        │ Distribution│
│                          │ (1 column)  │
└──────────────────────────┴─────────────┘
```

### Mobile/Tablet (< 1280px)
```
┌──────────────────────────┐
│  TVL, Volume & Price    │
└──────────────────────────┘
┌──────────────────────────┐
│  Liquidity Distribution  │
└──────────────────────────┘
```

## Color Coding Guide

| Color | Price Position | Meaning |
|-------|---------------|---------|
| 🟢 Green (#10B981) | Above current | Pool holds USDC, will sell for token |
| 🩷 Pink (#F51E87) | Current range | Actively trading band |
| 🔵 Blue (#2172E5) | Below current | Pool holds token, will sell for USDC |

## Troubleshooting

### Chart Not Appearing

**Problem**: Horizontal chart doesn't show up

**Solutions**:
1. Check browser console for errors
2. Verify The Graph API key is configured:
   ```bash
   # Check .env.local
   NEXT_PUBLIC_THE_GRAPH_API_KEY=your_key_here
   ```
3. Ensure pool has initialized ticks (most active pools do)
4. Try a different pool (some pools may have no liquidity)

### GraphQL Errors

**Problem**: "Failed to fetch ticks" error in console

**Solutions**:
1. Verify API key is valid at: https://thegraph.com/studio/apikeys/
2. Check network connection
3. Ensure pool address is valid Ethereum address

### Incorrect Colors

**Problem**: Colors don't match price position

**Solutions**:
1. Verify pool data is loading correctly (check TVL chart works)
2. Check current tick value in console logs
3. Ensure USDC detection is working (should be green above, blue below)

### Performance Issues

**Problem**: Page is slow or laggy

**Solutions**:
1. Check number of ticks being fetched (console logs show count)
2. If > 5000 ticks, the fetch is capped automatically
3. Consider reducing `numSurroundingTicks` from 100 to 50 in:
   ```typescript
   // app/pools/[chain]/[poolAddress]/page.tsx
   computeActiveLiquidityBands(..., 50, ...) // Changed from 100
   ```

## Configuration Options

### Adjust Number of Price Bands
Edit `app/pools/[chain]/[poolAddress]/page.tsx`:
```typescript
const bands = computeActiveLiquidityBands(
  ticksData.tick,
  ticksData.liquidity,
  tickSpacing,
  token0,
  token1,
  100, // <- Change this (default: 100 bands each direction)
  ticksData.ticks,
  isUSDC0
);
```

### Change Minimum Liquidity Filter
Edit `components/Pools/PoolDetails/HorizontalLiquidityChart.tsx`:
```typescript
.filter((band) => band.liquidityActive >= 0.50) // <- Increase to hide small bands
```

### Modify Chart Height
Edit `components/Pools/PoolDetails/HorizontalLiquidityChart.tsx`:
```typescript
style={{
  height: `${Math.min(barHeight, 800)}px`, // <- Change max height
  maxHeight: '800px', // <- Change max height
  overflowY: 'auto',
}}
```

## Browser Console Logs

When testing, you should see logs like:
```
🔍 [GraphQL Proxy] Forwarding query to https://gateway.thegraph.com/...
✅ Fetched 1000 ticks, continuing...
✅ Fetched 2000 ticks, continuing...
✅ Total ticks fetched: 2,453
📊 Computing liquidity bands for pool 0x123...
✅ Generated 200 liquidity bands
```

## API Endpoints Used

1. **GraphQL (The Graph)**:
   - Endpoint: Uniswap V3 Subgraph
   - Query: `PoolTicks` (defined in `lib/graphql/queries/poolTicks.graphql`)
   - Data: Tick indices, liquidity values, prices

2. **Existing APIs** (no changes):
   - Pool data: Already being fetched
   - Transactions: Already being fetched

## File Locations

### New Files
```
lib/
  graphql/queries/poolTicks.graphql    # GraphQL query
  uniswap/activeLiquidity.ts           # Calculation utilities
hooks/
  usePoolTicks.ts                       # Custom hook
components/
  Pools/PoolDetails/
    HorizontalLiquidityChart.tsx        # Chart component
```

### Modified Files
```
app/
  pools/[chain]/[poolAddress]/page.tsx  # Added integration
components/
  Pools/PoolDetails/TVLChart.tsx        # Removed margin
```

## Testing Checklist

Before deploying to production:

- [ ] Test on Chrome, Firefox, Safari
- [ ] Test on mobile devices (responsive layout)
- [ ] Test with pools that have:
  - [ ] High liquidity (concentrated bands)
  - [ ] Low liquidity (sparse bands)
  - [ ] Tokenized stocks (SLVon/USDC)
  - [ ] Standard pairs (ETH/USDC, WBTC/USDC)
- [ ] Verify loading states work correctly
- [ ] Check that charts align properly in grid
- [ ] Test with dark and light mode
- [ ] Verify no console errors
- [ ] Check memory usage (no leaks)
- [ ] Test navigation between pools (data updates)

## Production Deployment

### Prerequisites
1. Ensure `NEXT_PUBLIC_THE_GRAPH_API_KEY` is set in production environment
2. Build and test locally:
   ```bash
   npm run build
   npm run start
   ```
3. No additional dependencies needed (uses existing packages)

### Environment Variables
```bash
# .env.production or Vercel/Netlify settings
NEXT_PUBLIC_THE_GRAPH_API_KEY=your_production_key
```

### Build Verification
```bash
npm run build
# Should complete without errors
# Check output for any warnings
```

## Known Limitations

1. **Ethereum Only**: Currently only supports Ethereum mainnet
2. **Tick Limit**: Fetches maximum 5000 ticks
3. **Solana Disabled**: Not available for Solana pools
4. **Loading Delay**: 1-3 seconds for tick data to load

## Next Steps

Recommended enhancements:
1. Add user position overlay (show where user's liquidity is)
2. Implement click-to-zoom on specific price ranges
3. Add historical liquidity distribution slider
4. Export chart as PNG/SVG
5. Add comparison with other pools
6. Support for multi-chain (Arbitrum, Optimism, Polygon)

## Support

If you encounter issues:
1. Check browser console for error messages
2. Verify GraphQL API is accessible
3. Review the implementation guide: `HORIZONTAL_LIQUIDITY_INTEGRATION_GUIDE.md`
4. Check the detailed summary: `HORIZONTAL_LIQUIDITY_IMPLEMENTATION_SUMMARY.md`

## Success Criteria

The implementation is successful if:
- ✅ Chart appears on pool details pages
- ✅ Bars are colored correctly (green above, pink current, blue below)
- ✅ Current price band is highlighted
- ✅ Tooltips show accurate price ranges and liquidity
- ✅ Layout is responsive on all screen sizes
- ✅ No performance degradation
- ✅ No console errors

---

**Status**: ✅ Implementation Complete
**Version**: 1.0
**Date**: January 2026
