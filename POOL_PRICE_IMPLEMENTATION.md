# Pool Price Implementation - Using Uniswap Subgraph Data

## Overview
Modified the pool details implementation to fetch token prices directly from Uniswap V3 subgraph pool data instead of relying on external stock price APIs. This provides more accurate, real-time pricing data from the actual liquidity pool.

## Changes Made

### 1. GraphQL Query Updates
**File**: `lib/graphql/queries/poolDetails.graphql`

Added `token0Price` and `token1Price` fields to `poolDayData`:
```graphql
poolDayData(
  orderBy: date
  orderDirection: desc
  first: 30
) {
  date
  volumeUSD
  feesUSD
  tvlUSD
  token0Price    // ← Added
  token1Price    // ← Added
  open
  high
  low
  close
}
```

### 2. Hook Updates
**File**: `hooks/usePoolData.ts`

#### Added TypeScript Interface Fields
Updated `PoolDetailsResponse` interface to include the new price fields:
```typescript
poolDayData: Array<{
  date: number;
  volumeUSD: string;
  feesUSD: string;
  tvlUSD: string;
  token0Price?: string;    // ← Added
  token1Price?: string;    // ← Added
  open?: string;
  high?: string;
  low?: string;
  close?: string;
}>;
```

#### Removed External API Dependencies
- Removed stock price history API calls
- Removed `isTokenizedStock` and `getStockTicker` imports
- Removed date range calculation for external API
- Removed stockPriceHistoryData query

#### Added Stablecoin Detection Logic
```typescript
const USDC_ADDRESS = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const USDT_ADDRESS = '0xdac17f958d2ee523a2206206994597c13d831ec7';
const DAI_ADDRESS = '0x6b175474e89094c44da98b954eedeac495271d0f';

const isToken0Stablecoin = [USDC_ADDRESS, USDT_ADDRESS, DAI_ADDRESS].includes(poolToken0Address);
const isToken1Stablecoin = [USDC_ADDRESS, USDT_ADDRESS, DAI_ADDRESS].includes(poolToken1Address);
```

#### Updated Price Calculation in tvlHistory
Now calculates price directly from pool data:
```typescript
if (day.token0Price && day.token1Price) {
  const token0Price = parseFloat(day.token0Price);
  const token1Price = parseFloat(day.token1Price);
  
  if (isToken1Stablecoin && token1Price > 0) {
    // If token1 is USDC, calculate token0 price in USDC
    price = 1 / token1Price;
  } else if (isToken0Stablecoin && token0Price > 0) {
    // If token0 is USDC, token0Price gives token1 price in USDC
    price = token0Price;
  } else if (token0Price > 0) {
    // Neither is a stablecoin, use token0Price
    price = token0Price;
  }
}
```

### 3. Chart Component Updates
**File**: `components/Pools/PoolDetails/TVLChart.tsx`

#### Added Dynamic Price Label
```typescript
const priceLabel = useMemo(() => {
  if (!poolData) return 'Price';
  
  const USDC_ADDRESS = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
  const USDT_ADDRESS = '0xdac17f958d2ee523a2206206994597c13d831ec7';
  const DAI_ADDRESS = '0x6b175474e89094c44da98b954eedeac495271d0f';
  
  const token0Address = poolData.token0.address.toLowerCase();
  const token1Address = poolData.token1.address.toLowerCase();
  
  const isToken0Stablecoin = [USDC_ADDRESS, USDT_ADDRESS, DAI_ADDRESS].includes(token0Address);
  const isToken1Stablecoin = [USDC_ADDRESS, USDT_ADDRESS, DAI_ADDRESS].includes(token1Address);
  
  if (isToken1Stablecoin) {
    return `${poolData.token0.symbol} Price`;
  } else if (isToken0Stablecoin) {
    return `${poolData.token1.symbol} Price`;
  } else {
    return `${poolData.token0.symbol} Price`;
  }
}, [poolData]);
```

#### Updated Chart Labels
- Chart title: Changed from "TVL, Volume & Price" to "Pool Metrics & {priceLabel}"
- Tooltip: Uses dynamic `priceLabel` instead of static "Price"
- Legend: Uses dynamic `priceLabel` for the price line
- Line component: Uses dynamic `priceLabel` in the name prop

## How It Works

### Uniswap V3 Subgraph Price Fields
According to the Uniswap V3 subgraph documentation:
- `token0Price`: Price of token0 in terms of token1
- `token1Price`: Price of token1 in terms of token0

### Price Calculation Logic
1. **If token1 is a stablecoin (USDC/USDT/DAI)**:
   - `token1Price` gives us token1 in terms of token0
   - So `1/token1Price` gives us token0 price in USD

2. **If token0 is a stablecoin**:
   - `token0Price` directly gives us token1 price in USD

3. **If neither is a stablecoin**:
   - Use `token0Price` as the relative price

### Fallback Strategy
If `token0Price` and `token1Price` are not available, the system falls back to the `close` price from `poolDayData`.

## Benefits

1. **Real-time Data**: Prices come directly from the liquidity pool, reflecting actual trading prices
2. **No External Dependencies**: Eliminates reliance on external stock price APIs
3. **More Accurate**: Pool prices reflect the actual market conditions in the Uniswap pool
4. **Better Performance**: Fewer API calls and data sources to manage
5. **Consistent Data Source**: All pool metrics (TVL, volume, fees, price) come from the same source

## Testing

The build was verified with:
```bash
npm run build
```

Result: ✓ Compiled successfully

All TypeScript types are correct and the application builds without errors.

## Example Pool Price Display

For a pool like AAPL/USDC:
- Chart title shows: "Pool Metrics & AAPL Price"
- Tooltip shows: "AAPL Price: $175.23"
- Price data comes from Uniswap V3 pool's token0Price/token1Price fields

For a pool like ETH/DAI:
- Chart title shows: "Pool Metrics & ETH Price"
- Tooltip shows: "ETH Price: $2,450.00"
- Price calculated from pool data based on which token is the stablecoin
