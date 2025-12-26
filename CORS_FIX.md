# CORS Fix Implementation

## Problem
The application was experiencing CORS errors when trying to fetch data from The Graph API:
```
Access to fetch at 'https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3' from origin 'http://localhost:3000' has been blocked by CORS policy
```

## Solution
Created a Next.js API route (`/app/api/graphql/route.ts`) that acts as a proxy server. This allows:
1. Browser makes requests to `/api/graphql` (same origin, no CORS issues)
2. Next.js server forwards the request to The Graph API
3. Server-to-server requests don't have CORS restrictions

## Changes Made

### 1. Created API Route
- **File**: `app/api/graphql/route.ts`
- Handles POST requests
- Proxies to The Graph API
- Returns GraphQL responses

### 2. Updated GraphQL Client
- **File**: `lib/graphql/client.ts`
- Uses `/api/graphql` when running in browser
- Falls back to direct URL for server-side rendering

## Testing
After this fix:
1. Restart your development server: `npm run dev`
2. Connect your wallet
3. The GraphQL requests should now work without CORS errors

## Note
The GraphQL query structure may still need adjustment based on the actual Uniswap API schema. If you see query errors after the CORS fix, you may need to:
1. Verify the query field names match the API
2. Check the response structure
3. Adjust data transformation logic in hooks

