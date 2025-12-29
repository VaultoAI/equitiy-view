# Cache Testing and Debugging Guide

## Why No Cache is Available

The cache system uses **in-memory storage**, which means:

1. **Cache is lost on server restart** - This is expected behavior for in-memory cache
2. **Cache needs initial population** - The cache must be populated by calling the refresh endpoint at least once
3. **Cache persists during server uptime** - Once populated, cache remains available until server restarts or expires

## Testing Cache System

### 1. Check Cache Status

```bash
curl http://localhost:3000/api/cache/status
```

This will show:
- Whether cache exists for each pool type
- Cache age and validity
- Number of pools cached
- Timestamp of last cache update

### 2. Populate Cache (One-Time Test)

```bash
# Using the refresh endpoint (no auth required)
curl -X POST http://localhost:3000/api/cache/refresh

# Or using GET
curl http://localhost:3000/api/cache/refresh
```

Expected response:
```json
{
  "tokenizedStockPools": {
    "success": true,
    "count": 16
  },
  "solanaPools": {
    "success": true,
    "count": 5
  },
  "timestamp": "2024-01-01T12:00:00.000Z",
  "verification": {
    "tokenizedStockPools": {
      "cached": true,
      "count": 16,
      "timestamp": 1704110400000,
      "timestampFormatted": "2024-01-01T12:00:00.000Z"
    },
    "solanaPools": {
      "cached": true,
      "count": 5,
      "timestamp": 1704110400000,
      "timestampFormatted": "2024-01-01T12:00:00.000Z"
    }
  }
}
```

### 3. Verify Cache is Working

After refreshing, test the pool endpoints:

```bash
# Tokenized Stock Pools
curl http://localhost:3000/api/cache/tokenized-stock-pools

# Solana Pools
curl http://localhost:3000/api/cache/solana-pools
```

Both should return cached data with `cached: true` and a `cacheTimestamp`.

### 4. Test Cron Job Endpoint

The cron job endpoint requires authentication:

```bash
# Set CACHE_REFRESH_SECRET environment variable first
export CACHE_REFRESH_SECRET=your-secret-here

# Then test with secret
curl "http://localhost:3000/api/cron/refresh-cache?secret=your-secret-here"

# Or with Authorization header
curl -H "Authorization: Bearer your-secret-here" http://localhost:3000/api/cron/refresh-cache
```

## Using the Test Script

A test script is provided for convenience:

```bash
./test-cache.sh [base_url]

# Example:
./test-cache.sh http://localhost:3000
```

This script will:
1. Check cache status before refresh
2. Trigger cache refresh
3. Check cache status after refresh
4. Test both pool endpoints

## Troubleshooting

### Issue: 404 on `/api/cache/refresh`

**Solution:** Restart the Next.js development server. New API routes require a server restart.

```bash
# Stop the server (Ctrl+C) and restart
npm run dev
```

### Issue: Cache not persisting

**Expected Behavior:** In-memory cache is lost on server restart. This is normal. The cron job will repopulate it hourly.

### Issue: Cache verification fails

**Check:**
1. Are external APIs (GraphQL, Meteora) accessible?
2. Check server logs for fetch errors
3. Verify environment variables are set correctly

### Issue: Cron job not working

**Check:**
1. Is `CACHE_REFRESH_SECRET` environment variable set?
2. Is the secret in the cron job URL correct?
3. Check cron service logs
4. Test the endpoint manually with the secret

## Cache Flow

```
1. Initial State: No cache
   ↓
2. Cron job runs (or manual refresh)
   ↓
3. Fetches fresh data from external APIs
   ↓
4. Saves to in-memory cache with timestamp
   ↓
5. Verifies cache was saved
   ↓
6. User requests → Returns cached data instantly
   ↓
7. Cron job runs again (hourly) → Updates cache
```

## Important Notes

1. **Cache is in-memory** - Lost on server restart, repopulated by cron
2. **Cache-only mode** - User-facing endpoints never fetch fresh (return 503 if no cache)
3. **Cron job updates hourly** - Ensures cache stays fresh
4. **Verification built-in** - Both refresh endpoints verify cache was saved
5. **Status endpoint** - Use `/api/cache/status` to debug cache state

## Production Deployment

For production:

1. **Set up cron job** to call `/api/cron/refresh-cache` hourly
2. **Set `CACHE_REFRESH_SECRET`** environment variable
3. **Initial cache population** - Cron job will populate on first run
4. **Monitor** - Use `/api/cache/status` to monitor cache health
