# Netlify Stock Price Data Fix

## Problem

The application was showing correct stock price data when running locally (`npm run build && npm start`) but failing on Netlify deployment with the error:

```
[Pool Data] Failed to fetch stock price history for NVDA: 500
error: "Failed to fetch stock prices: fetch failed"
```

## Root Cause

The issue was caused by the API route architecture in a serverless environment:

### Previous Flow (Broken on Netlify)
1. Client calls `/api/stock-price-history`
2. Next.js API route (Netlify Function) calls `fetchStockDataByDateRange()`
3. Service function calls `/api/stockdata-org` endpoint
4. Service's `getBaseUrl()` returned `http://localhost:3000` on server-side
5. **FAILURE**: Netlify function tries to fetch from `localhost:3000`, which doesn't exist

### Why It Worked Locally
- Local Next.js server runs continuously on port 3000
- Server-side API routes can make HTTP requests to localhost:3000
- All routes are available at the same origin

### Why It Failed on Netlify
- Each API route becomes an isolated serverless function
- Functions can't make HTTP requests to "localhost"
- No single server process exists at a fixed port
- The `getBaseUrl()` function couldn't determine the correct deployment URL

## Solution

### Changes Made

#### 1. Created Direct API Function (`lib/services/stockdata.service.ts`)

Added a new `fetchStockDataDirectly()` function that calls the StockData.org API directly from server-side code:

```typescript
export async function fetchStockDataDirectly(
  symbol: string,
  startDate: string,
  endDate: string
): Promise<StockDataResponse> {
  const apiToken = process.env.STOCKDATA_ORG_API_TOKEN;
  // Calls https://api.stockdata.org directly
}
```

**Benefits:**
- No intermediate API route needed
- Works in any serverless environment
- Reduces API call hops
- More efficient and reliable

#### 2. Updated API Routes

Both `/api/stock-price` and `/api/stock-price-history` now use `fetchStockDataDirectly()`:

```typescript
// Before
import { fetchStockDataByDateRange } from '@/lib/services/stockdata.service';
const stockData = await fetchStockDataByDateRange(ticker, startDateStr, endDateStr);

// After
import { fetchStockDataDirectly } from '@/lib/services/stockdata.service';
const stockData = await fetchStockDataDirectly(ticker, startDateStr, endDateStr);
```

#### 3. Improved `getBaseUrl()` Function

Enhanced the function to work correctly in different deployment environments:

```typescript
function getBaseUrl(): string {
  // Client-side: use relative URLs
  if (typeof window !== 'undefined') {
    return '';
  }
  
  // Server-side: check environment
  if (process.env.URL) {
    // Netlify provides URL env var
    return process.env.URL;
  }
  
  if (process.env.VERCEL_URL) {
    // Vercel provides VERCEL_URL
    return `https://${process.env.VERCEL_URL}`;
  }
  
  if (process.env.NEXT_PUBLIC_API_URL) {
    // Custom URL if provided
    return process.env.NEXT_PUBLIC_API_URL;
  }
  
  // Default to localhost for local dev
  return 'http://localhost:3000';
}
```

## New Architecture

### Current Flow (Working on Netlify)
1. Client calls `/api/stock-price-history`
2. Next.js API route (Netlify Function) calls `fetchStockDataDirectly()`
3. Service function calls `https://api.stockdata.org` directly
4. **SUCCESS**: Direct external API call works in serverless environment

### Benefits
- ✅ Works on Netlify
- ✅ Works on Vercel
- ✅ Works locally
- ✅ Fewer API call hops
- ✅ Better performance
- ✅ Clearer architecture

## Environment Variables Required

Ensure `STOCKDATA_ORG_API_TOKEN` is set in Netlify:

1. Go to Netlify Dashboard → Site Settings → Environment Variables
2. Add: `STOCKDATA_ORG_API_TOKEN` = your API token
3. Save and redeploy

## Testing

### Local Testing
```bash
npm run build
npm start
# Visit a pool page with tokenized stocks
```

### Production Testing
After deploying to Netlify:
1. Visit a tokenized stock pool page (e.g., NVDA, AAPL, etc.)
2. Check browser console for successful stock price fetches
3. Verify price charts display correctly

### Expected Console Output
```
📊 [StockData Service Direct] Fetching data for NVDA from 2024-12-18 to 2025-01-18
✅ [StockData Service Direct] Successfully fetched 22 price points for NVDA
```

## Files Modified

1. `lib/services/stockdata.service.ts`
   - Added `fetchStockDataDirectly()` function
   - Improved `getBaseUrl()` function

2. `app/api/stock-price-history/route.ts`
   - Changed to use `fetchStockDataDirectly()`

3. `app/api/stock-price/route.ts`
   - Changed to use `fetchStockDataDirectly()`

## Backward Compatibility

- The `/api/stockdata-org` proxy endpoint still exists for client-side usage
- The Netlify function (`netlify/functions/stockdata-org.js`) still works
- Client-side code continues to work without changes
- The `fetchStockDataByDateRange()` function still exists but is now only used for client-side calls

## Future Improvements

1. Consider removing the intermediate `/api/stockdata-org` proxy if not used by client-side code
2. Add retry logic with exponential backoff
3. Implement Redis caching for production
4. Add monitoring/alerting for API failures

## Summary

The fix resolves the serverless architecture issue by having server-side API routes call the StockData.org API directly instead of routing through another internal API endpoint. This eliminates the localhost dependency and works correctly in Netlify's serverless environment.
