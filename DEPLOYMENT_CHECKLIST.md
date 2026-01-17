# Deployment Checklist for Netlify Stock Price Fix

## Pre-Deployment Steps

### 1. Verify Local Build
- [x] Run `npm run build` - Build completes successfully
- [ ] Run `npm start` - Application starts correctly
- [ ] Test tokenized stock pool page (e.g., NVDA, AAPL, TSLA)
- [ ] Check browser console for successful stock price fetches
- [ ] Verify price charts display correctly

### 2. Environment Variables
- [ ] Confirm `STOCKDATA_ORG_API_TOKEN` is set in Netlify dashboard
  - Go to: Site Settings → Environment Variables
  - Variable name: `STOCKDATA_ORG_API_TOKEN`
  - Variable value: Your StockData.org API token
  - Scopes: Production, Deploy Previews, Branch deploys

### 3. Code Review
- [x] `lib/services/stockdata.service.ts` - Added `fetchStockDataDirectly()` function
- [x] `app/api/stock-price-history/route.ts` - Updated to use direct fetch
- [x] `app/api/stock-price/route.ts` - Updated to use direct fetch
- [x] No linting errors
- [x] TypeScript compilation successful

## Deployment Steps

### 1. Commit Changes
```bash
git add .
git commit -m "Fix: Update stock price API to work in Netlify serverless environment"
git push origin main
```

### 2. Netlify Deployment
- [ ] Netlify automatically starts building from the push
- [ ] Monitor build logs in Netlify dashboard
- [ ] Wait for deployment to complete

### 3. Verify Deployment
- [ ] Build completes successfully
- [ ] No errors in Netlify function logs
- [ ] Site deploys successfully

## Post-Deployment Testing

### 1. Smoke Test
- [ ] Visit the main page: `https://your-site.netlify.app`
- [ ] Navigate to Ethereum pools: `https://your-site.netlify.app/eth`
- [ ] Click on a tokenized stock pool (NVDA, AAPL, TSLA, etc.)

### 2. API Testing
- [ ] Open browser DevTools (F12)
- [ ] Go to Console tab
- [ ] Look for log messages:
  ```
  📊 [Stock Price History API] Fetching prices for NVDA from ...
  ✅ [Stock Price History API] Found XX price points for NVDA
  ```

### 3. Visual Testing
- [ ] Pool details page loads
- [ ] TVL chart displays
- [ ] Stock price chart displays correctly
- [ ] All price data points are visible
- [ ] No error messages in the console

### 4. Error Checking
- [ ] Check Netlify function logs for any errors
  - Go to: Netlify Dashboard → Functions → View logs
  - Look for stock-price-history and stock-price functions
  - Verify no 500 errors
  - Verify no "fetch failed" errors

### 5. Performance Check
- [ ] Page loads within 3 seconds
- [ ] API responses are cached (check for "cached: true" in responses)
- [ ] No excessive API calls

## Rollback Plan

If issues occur after deployment:

### Option 1: Revert to Previous Deployment
1. Go to Netlify Dashboard → Deploys
2. Find the last working deployment
3. Click "..." → "Publish deploy"

### Option 2: Revert Git Commit
```bash
git revert HEAD
git push origin main
```

### Option 3: Emergency Fix
If API token is missing:
1. Add `STOCKDATA_ORG_API_TOKEN` to Netlify environment variables
2. Trigger a redeploy (Site Settings → Build & deploy → Trigger deploy)

## Expected Results

### Success Indicators
- ✅ Tokenized stock pools display correctly
- ✅ Price charts show historical data
- ✅ Console logs show successful API calls
- ✅ No 500 errors in function logs
- ✅ Page loads quickly

### What Changed
1. **Server-side API calls now go directly to StockData.org API**
   - Eliminates localhost dependency
   - Works in serverless environment
   - Reduces API call hops

2. **Better environment detection**
   - Automatically detects Netlify environment
   - Falls back to Vercel if needed
   - Works locally for development

3. **More reliable architecture**
   - Fewer points of failure
   - Better error messages
   - Improved performance

## Common Issues and Solutions

### Issue: "API token not configured" Error
**Solution:** Add `STOCKDATA_ORG_API_TOKEN` to Netlify environment variables and redeploy

### Issue: "Rate limit exceeded" Error
**Solution:** 
- Check your StockData.org plan limits
- Verify caching is working (5-minute TTL)
- Consider upgrading your StockData.org plan

### Issue: Stock prices not loading
**Solution:**
- Check browser console for specific error messages
- Verify Netlify function logs
- Test the API endpoint directly: `/api/stock-price-history?ticker=NVDA&startDate=1704067200&endDate=1706659200`

### Issue: Charts display but with old/incorrect data
**Solution:**
- Clear browser cache
- Check if caching is too aggressive (currently 5 minutes)
- Verify correct ticker symbols are being used

## Support Resources

- [StockData.org API Documentation](https://www.stockdata.org/documentation)
- [Netlify Functions Documentation](https://docs.netlify.com/functions/overview/)
- [Next.js API Routes](https://nextjs.org/docs/api-routes/introduction)
- [Fix Documentation](NETLIFY_STOCK_PRICE_FIX.md)

## Notes

- The fix maintains backward compatibility
- No breaking changes to the frontend
- Client-side code continues to work unchanged
- The Netlify function (`netlify/functions/stockdata-org.js`) is still available but not used by server-side API routes

## Sign-off

- [ ] Developer tested locally
- [ ] Code reviewed
- [ ] Environment variables confirmed
- [ ] Deployed to production
- [ ] Post-deployment testing completed
- [ ] Stakeholders notified

---

**Deployment Date:** _________________

**Deployed By:** _________________

**Verification Status:** _________________
