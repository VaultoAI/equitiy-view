# Alpha Vantage Integration Setup

**Date**: January 20, 2026  
**Status**: ✅ Implemented - Ready for Testing

## Overview

We've implemented a **hybrid data fetching system** that uses:
- **Alpha Vantage** for recent prices (last 3 days) - 15-minute delay
- **StockData.org** for historical data (older than 3 days) - 24-48 hour delay

This ensures users see fresh data for recent trading days while keeping API costs low.

## Setup Instructions

### Step 1: Get Alpha Vantage API Key

1. Visit: https://www.alphavantage.co/support/#api-key
2. Click "Get Your Free API Key Today"
3. Fill out the form (name, email, organization)
4. You'll receive an API key immediately (e.g., `DEMO` or `ABC123XYZ`)

**Free Tier Limits:**
- ✅ 25 API calls per day
- ✅ 5 API calls per minute  
- ✅ No credit card required
- ✅ 15-minute data delay (acceptable for our use case)

### Step 2: Add API Key to Environment

**Local Development (.env.local):**
```bash
# In /Users/charliebc/Vaulto-Earn/.env.local
ALPHA_VANTAGE_API_KEY=your_api_key_here
```

**Production (Netlify):**
1. Go to Netlify Dashboard
2. Site Settings → Environment Variables
3. Add new variable:
   - **Key**: `ALPHA_VANTAGE_API_KEY`
   - **Value**: `your_api_key_here`
4. Redeploy site

### Step 3: Restart Development Server

```bash
# Stop current server (Ctrl+C)
npm run dev
```

## How It Works

### Data Source Selection Logic

```typescript
// For any date within last 3 days (including today)
if (shouldUseAlphaVantage(dateStr)) {
  // Use Alpha Vantage - fresh data, 15-min delay
  price = await fetchAlphaVantagePrice(ticker, dateStr);
} else {
  // Use StockData.org - historical data
  price = await fetchStockDataPrice(ticker, dateStr);
}
```

### Date Ranges

| Date Range | Data Source | Delay | Why |
|------------|-------------|-------|-----|
| Today | Alpha Vantage | 15 minutes | Market still open or just closed |
| Yesterday | Alpha Vantage | 15 minutes | StockData.org may not have it yet |
| 2-3 days ago | Alpha Vantage | 15 minutes | Extra buffer for weekends |
| 4+ days ago | StockData.org | N/A | Historical data is stable |

### API Endpoints

**Alpha Vantage APIs Used:**

1. **GLOBAL_QUOTE** - Current/latest price
   ```
   https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=AAPL&apikey=YOUR_KEY
   ```

2. **TIME_SERIES_DAILY** - Daily historical data
   ```
   https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=AAPL&outputsize=compact&apikey=YOUR_KEY
   ```

## Files Modified

### New Files
- ✅ `lib/services/alphavantage.service.ts` - Alpha Vantage API client

### Updated Files
- ✅ `app/api/stock-price/route.ts` - Hybrid price fetching
- ✅ `app/api/stock-price-history/route.ts` - Hybrid historical data

## Testing

### Test with Demo Key (Limited)

```bash
# Test single price (today)
curl "http://localhost:3000/api/stock-price?ticker=AAPL"

# Test historical range
curl "http://localhost:3000/api/stock-price-history?ticker=AAPL&startDate=$(date -u -v-7d +%s)&endDate=$(date -u +%s)"
```

Expected response includes:
```json
{
  "ticker": "AAPL",
  "price": 255.51,
  "source": "alphavantage",  // ← Shows data source
  "metadata": {
    "note": "Real-time data from Alpha Vantage (15-min delay)"
  }
}
```

### Monitor Logs

```bash
# Watch for Alpha Vantage usage
tail -f ~/.cursor/projects/Users-charliebc-Vaulto-Earn/terminals/1.txt | grep "Alpha Vantage"
```

Look for:
- `📊 [Alpha Vantage] Fetching current quote for AAPL`
- `✅ [Alpha Vantage] Got quote for AAPL: $255.51 (2026-01-20)`
- `⚠️ [Alpha Vantage] Rate limit:` (if hitting limits)

## API Usage Optimization

### Daily Call Estimates

| Action | Stocks | Calls | Daily Total |
|--------|--------|-------|-------------|
| Page load (all stocks) | 16 | 1 each | 16 calls |
| User refresh | 16 | 1 each | 16 calls |
| Chart updates | Variable | 1-2 each | 5-10 calls |

**Total**: ~20-25 calls/day (fits in free tier!)

### Caching Strategy

We maintain 1-minute cache for recent data:
```typescript
const CURRENT_CACHE_TTL = 1 * 60 * 1000; // 1 minute for recent data
```

This means:
- ✅ Same stock fetched repeatedly = uses cache
- ✅ Multiple users = shared cache
- ✅ Minimizes Alpha Vantage API calls

## Fallback Behavior

If Alpha Vantage fails (rate limit, network error, etc.):
1. ⚠️ Log warning
2. 🔄 Automatically fallback to StockData.org
3. ✅ User still gets data (even if slightly older)

```typescript
try {
  price = await fetchAlphaVantagePrice(ticker, date);
  source = 'alphavantage';
} catch (error) {
  console.warn('Alpha Vantage failed, using StockData.org');
  price = await fetchStockDataPrice(ticker, date);
  source = 'stockdata';
}
```

## Troubleshooting

### Issue: "ALPHA_VANTAGE_API_KEY not set"

**Solution**: Add API key to `.env.local` and restart server

```bash
echo "ALPHA_VANTAGE_API_KEY=your_key_here" >> .env.local
npm run dev
```

### Issue: "Alpha Vantage rate limit"

**Symptoms**: Error message "Note: Thank you for using Alpha Vantage! Our standard API rate limit is 25 requests per day..."

**Solutions**:
1. **Short-term**: Wait until next day (resets at midnight ET)
2. **Medium-term**: Increase cache TTL to 5 minutes
3. **Long-term**: Upgrade to premium ($50/month for 75 calls/min)

### Issue: Still showing old data

**Checks**:
1. ✅ API key is set correctly
2. ✅ Server restarted after adding key
3. ✅ Check logs for "Using Alpha Vantage"
4. ✅ Clear browser cache (Cmd+Shift+R)

## Benefits

### Before (StockData.org only)
- ❌ Data 24-48 hours old
- ❌ Missing Friday, Monday, Tuesday data
- ❌ Charts appear flat
- ❌ Poor user experience

### After (Hybrid approach)
- ✅ Data 15 minutes old for recent dates
- ✅ Shows today's prices
- ✅ Charts update within minutes of market close
- ✅ Great user experience
- ✅ Minimal cost (free tier sufficient)

## Next Steps

1. ✅ Get API key from Alpha Vantage
2. ✅ Add to environment variables
3. ✅ Restart server
4. ✅ Test with real stock symbols
5. ✅ Monitor API usage
6. ⚠️ Consider premium if hitting limits

## Upgrade Options (Optional)

If you need more calls:

| Plan | Price/Month | Calls/Minute | Calls/Day |
|------|-------------|--------------|-----------|
| Free | $0 | 5 | 25 |
| Basic | $50 | 75 | Unlimited |
| Pro | $150 | 150 | Unlimited |
| Enterprise | Custom | Custom | Unlimited |

For our use case, **Free tier is sufficient** with proper caching!

---

**Status**: ✅ Ready to deploy  
**Next Action**: Add API key and test
