# StockData.org API Integration Setup Guide

This guide explains how to set up and configure the StockData.org API integration for fetching stock price data.

## Overview

The application uses **StockData.org** as the primary source for historical stock price data. The integration follows a serverless function proxy pattern to securely handle API authentication and avoid CORS issues.

## Architecture

```
Frontend → /api/stockdata-org → Netlify Function → StockData.org API
```

### Components

1. **Frontend Service** (`lib/services/stockdata.service.ts`)
   - Provides TypeScript functions to fetch stock data
   - Handles date range calculations and data transformation
   - Calls the serverless function proxy (not the external API directly)

2. **Serverless Function Proxy** (`netlify/functions/stockdata-org.js`)
   - Netlify serverless function that proxies requests to StockData.org
   - Securely handles API authentication using environment variables
   - Adds CORS headers to responses
   - Provides error handling and rate limit management

3. **API Routes** (`app/api/stock-price/route.ts` and `app/api/stock-price-history/route.ts`)
   - Next.js API routes that use the frontend service
   - Provide caching for improved performance
   - Maintain backward compatibility with existing application code

## Environment Variables

### Required Environment Variable

**`STOCKDATA_ORG_API_TOKEN`**
- **Description**: Your API token from StockData.org
- **Where to get it**: https://www.stockdata.org/
- **Security**: This token should NEVER be exposed to the frontend or committed to git

### Setting Environment Variables

#### Local Development

Create a `.env.local` file in the project root:

```bash
# StockData.org API Configuration
STOCKDATA_ORG_API_TOKEN=your_api_token_here
```

**Important**: Make sure `.env.local` is listed in your `.gitignore` file.

#### Netlify Deployment

1. Go to your Netlify site dashboard
2. Navigate to **Site Settings** → **Environment Variables**
3. Click **Add a variable**
4. Set:
   - **Key**: `STOCKDATA_ORG_API_TOKEN`
   - **Value**: Your API token from StockData.org
5. Click **Save**

#### Vercel Deployment

If deploying to Vercel:

1. Go to your project dashboard on Vercel
2. Navigate to **Settings** → **Environment Variables**
3. Add the variable:
   - **Name**: `STOCKDATA_ORG_API_TOKEN`
   - **Value**: Your API token
   - **Environments**: Select all (Production, Preview, Development)
4. Click **Save**

## Getting Your StockData.org API Token

1. Visit https://www.stockdata.org/
2. Sign up for an account or log in
3. Navigate to your dashboard
4. Find your API token in the API section
5. Copy the token and add it to your environment variables

## API Usage

### Frontend Service Functions

```typescript
import { 
  fetchStockData, 
  fetchStockDataByDateRange,
  fetchCurrentStockPrice 
} from '@/lib/services/stockdata.service';

// Fetch stock data for a time period
const data = await fetchStockData('AAPL', '3m');
// Returns: { symbol: 'AAPL', prices: [...], currentPrice: 150.23 }

// Fetch stock data for a specific date range
const data = await fetchStockDataByDateRange('AAPL', '2024-01-01', '2024-03-31');

// Fetch only the current price
const price = await fetchCurrentStockPrice('AAPL');
// Returns: 150.23
```

### Available Time Periods

- `'24h'` - 2 days (for daily movements)
- `'7d'` - 7 days
- `'30d'` - 30 days
- `'3m'` - 90 days (~3 months)
- `'6m'` - 180 days (~6 months)
- `'1y'` - 365 days (1 year)

### API Routes (Backward Compatible)

The existing API routes have been updated to use the new StockData.org service:

```javascript
// Get single price for a date
GET /api/stock-price?ticker=AAPL&date=2024-01-15

// Get historical prices
GET /api/stock-price-history?ticker=AAPL&startDate=1704067200&endDate=1706659200
```

## Configuration Files

### netlify.toml

The `netlify.toml` file configures the redirect from `/api/stockdata-org` to the Netlify function:

```toml
[[redirects]]
  from = "/api/stockdata-org"
  to = "/.netlify/functions/stockdata-org"
  status = 200
```

This creates a clean URL path for the serverless function.

## Error Handling

The integration includes comprehensive error handling:

- **400 Bad Request**: Missing or invalid parameters
- **404 Not Found**: Invalid ticker or no data available
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: API token not configured or other server errors
- **503 Service Unavailable**: Timeout or network errors
- **504 Gateway Timeout**: Request timeout

## Rate Limiting

- Rate limits depend on your StockData.org plan
- The application includes 5-minute caching to reduce API calls
- Failed requests are not cached
- Consider implementing additional caching strategies for frequently requested data

## Testing

### Local Testing

1. Set the `STOCKDATA_ORG_API_TOKEN` in your `.env.local` file
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Test the service:
   ```bash
   curl "http://localhost:3000/api/stock-price?ticker=AAPL"
   ```

### Production Testing

After deploying to Netlify:

1. Verify the environment variable is set in Netlify dashboard
2. Test the API endpoint:
   ```bash
   curl "https://your-site.netlify.app/api/stock-price?ticker=AAPL"
   ```

## Migration from Yahoo Finance

The previous implementation used `yahoo-finance2`. Key differences:

### Before (Yahoo Finance)
- Free, no API key required
- Used `chart()` method for historical data
- Direct API calls from Next.js routes

### After (StockData.org)
- Requires API token (paid plans available)
- Serverless proxy pattern for security
- Better reliability and data quality
- Cleaner error handling

### Removed Dependency

You can now remove the `yahoo-finance2` package if it's no longer needed elsewhere:

```bash
npm uninstall yahoo-finance2
```

## Troubleshooting

### "API token not configured" Error

**Cause**: The `STOCKDATA_ORG_API_TOKEN` environment variable is not set.

**Solution**: 
1. Check that the environment variable is set in Netlify (or your deployment platform)
2. Verify the variable name is exactly `STOCKDATA_ORG_API_TOKEN`
3. Redeploy your site after adding the variable

### "Invalid ticker or no data available" Error

**Cause**: The stock symbol doesn't exist or data is not available for the requested date range.

**Solution**:
1. Verify the ticker symbol is correct
2. Check that the symbol is available on StockData.org
3. Try a different date range

### Rate Limit Errors

**Cause**: Too many API requests in a short time period.

**Solution**:
1. Implement additional caching in your application
2. Upgrade your StockData.org plan
3. Add delays between requests
4. Consider using a Redis cache for production

### 404 Errors in Production

**Cause**: Netlify function not deploying correctly.

**Solution**:
1. Verify the `netlify/functions/stockdata-org.js` file exists
2. Check the build logs in Netlify dashboard
3. Ensure `netlify.toml` is in the project root
4. Redeploy the site

## Security Best Practices

1. **Never commit API tokens** to version control
2. **Use environment variables** for all sensitive data
3. **Rotate API tokens** periodically
4. **Monitor API usage** to detect unusual activity
5. **Set up alerts** for rate limit warnings

## Support

For issues with:
- **StockData.org API**: Contact StockData.org support
- **Netlify Functions**: Check Netlify function logs in your dashboard
- **Application Integration**: Review error logs in your application

## Additional Resources

- [StockData.org Documentation](https://www.stockdata.org/documentation)
- [Netlify Functions Documentation](https://docs.netlify.com/functions/overview/)
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
