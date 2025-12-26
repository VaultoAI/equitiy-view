# Pool Fetching Logic Fix

## Issues Fixed

### 1. Deprecated Subgraph Endpoint
**Problem**: The old Uniswap V3 subgraph endpoint (`https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3`) has been removed by The Graph.

**Solution**: Updated to use The Graph's new Gateway API with the decentralized subgraph endpoint.

### 2. GraphQL Query Syntax
**Problem**: The query was using incorrect filter syntax for nested fields.

**Solution**: Updated the query to use the correct syntax for filtering by nested object fields:
- Changed from: `{ token0: $tokenAddress }`
- Changed to: `{ token0_: { id: $tokenAddress } }`

## Changes Made

### Files Updated

1. **`app/api/graphql/route.ts`**
   - Updated to use The Graph Gateway endpoint
   - Added support for API key via environment variable
   - Added better error logging

2. **`hooks/usePoolsFromTokenAddress.ts`**
   - Fixed GraphQL query filter syntax
   - Added comprehensive error logging
   - Made `tokenAddress` a required parameter

3. **`lib/graphql/queries/pools.graphql`**
   - Updated query to use correct nested field filtering syntax

4. **`lib/graphql/client.ts`**
   - Updated fallback endpoint (though this shouldn't be used in browser)

## Setup Required

### 1. Get The Graph API Key

1. Visit [https://thegraph.com/studio/apikeys/](https://thegraph.com/studio/apikeys/)
2. Sign up or log in
3. Create a new API key
4. Copy the API key

### 2. Add to Environment Variables

Add to your `.env.local` file:
```bash
NEXT_PUBLIC_THE_GRAPH_API_KEY=your_api_key_here
```

### 3. Restart Development Server

After adding the environment variable, restart your dev server:
```bash
npm run dev
```

## Testing

After setup, test the pool fetching:

1. Connect your wallet
2. Check the browser console for logs:
   - `🔍 [Pools From Token] Fetching pools for token: ...`
   - `✅ [Pools From Token] Found X pools for token ...`
   - `📋 [Pools From Token] Pool details: ...`

3. Check server logs for:
   - `🔍 [GraphQL Proxy] Using The Graph Gateway with API key`
   - `✅ [GraphQL Proxy] Successfully fetched X pools`

## Expected Behavior

- Tokens are extracted from wallet using Etherscan API ✅
- Pools are fetched for each token using Uniswap V3 subgraph ✅
- Pool data includes: TVL, volume, fee tier, token pairs ✅
- Pools are displayed in a sortable table ✅

## Troubleshooting

### Error: "This endpoint has been removed"
- **Cause**: Missing or incorrect API key
- **Solution**: Add `NEXT_PUBLIC_THE_GRAPH_API_KEY` to `.env.local` and restart server

### Error: "GraphQL errors" in console
- **Cause**: Query syntax issue or subgraph schema mismatch
- **Solution**: Check the query syntax matches the current subgraph schema

### No pools found
- **Cause**: Token may not have any liquidity pools, or token address is incorrect
- **Solution**: Verify the token address is correct and has pools on Uniswap V3

## GraphQL Query Structure

The correct query structure for filtering pools by token address:

```graphql
query TopV3Pools($first: Int!, $tokenAddress: String!) {
  pools(
    first: $first
    where: {
      or: [
        { token0_: { id: $tokenAddress } }
        { token1_: { id: $tokenAddress } }
      ]
    }
    orderBy: totalValueLockedUSD
    orderDirection: desc
  ) {
    id
    token0 {
      id
      symbol
      name
      decimals
    }
    token1 {
      id
      symbol
      name
      decimals
    }
    feeTier
    totalValueLockedUSD
    volumeUSD
    txCount
  }
}
```

## Resources

- [The Graph Studio](https://thegraph.com/studio/)
- [Uniswap Subgraph Documentation](https://docs.uniswap.org/api/subgraph/overview)
- [The Graph API Documentation](https://thegraph.com/docs/)


