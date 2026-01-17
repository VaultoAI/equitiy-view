# StockData.org API - Quick Reference

## Environment Variable

```bash
STOCKDATA_ORG_API_TOKEN=your_api_token_here
```

## Import the Service

```typescript
import {
  fetchStockData,
  fetchStockDataByDateRange,
  fetchCurrentStockPrice
} from '@/lib/services/stockdata.service';
```

## Usage Examples

### Fetch Stock Data by Time Period

```typescript
// Get 3 months of AAPL data
const data = await fetchStockData('AAPL', '3m');

console.log(data);
// {
//   symbol: 'AAPL',
//   prices: [
//     { date: '2023-10-17T00:00:00.000Z', price: 150.23 },
//     { date: '2023-10-18T00:00:00.000Z', price: 151.45 },
//     ...
//   ],
//   currentPrice: 155.30
// }
```

### Fetch Stock Data by Date Range

```typescript
// Get data for specific date range
const data = await fetchStockDataByDateRange(
  'TSLA',
  '2024-01-01',  // startDate (YYYY-MM-DD)
  '2024-03-31'   // endDate (YYYY-MM-DD)
);
```

### Fetch Current Price Only

```typescript
// Get just the current price
const price = await fetchCurrentStockPrice('GOOGL');
console.log(price); // 145.67
```

## Time Periods

| Period | Days | Use Case |
|--------|------|----------|
| `'24h'` | 2 | Daily movements |
| `'7d'` | 7 | Week view |
| `'30d'` | 30 | Month view |
| `'3m'` | 90 | Quarter view |
| `'6m'` | 180 | Half-year view |
| `'1y'` | 365 | Year view |

## API Routes (Backward Compatible)

### Single Price
```
GET /api/stock-price?ticker=AAPL&date=2024-01-15
```

Response:
```json
{
  "ticker": "AAPL",
  "date": "2024-01-15",
  "price": 150.23,
  "cached": false
}
```

### Historical Prices
```
GET /api/stock-price-history?ticker=AAPL&startDate=1704067200&endDate=1706659200
```

Response:
```json
{
  "ticker": "AAPL",
  "startDate": 1704067200,
  "endDate": 1706659200,
  "prices": [
    { "date": 1704067200, "price": 150.23 },
    { "date": 1704153600, "price": 151.45 }
  ],
  "cached": false
}
```

## Error Handling

```typescript
try {
  const data = await fetchStockData('AAPL', '3m');
} catch (error) {
  if (error.message.includes('Invalid ticker')) {
    // Handle invalid ticker
  } else if (error.message.includes('rate limit')) {
    // Handle rate limit
  } else {
    // Handle other errors
  }
}
```

## Common Error Messages

| Error | Meaning | Solution |
|-------|---------|----------|
| "Symbol is required" | Missing symbol parameter | Provide ticker symbol |
| "Invalid ticker or no data available" | Invalid/unknown ticker | Check ticker symbol |
| "Rate limit exceeded" | Too many requests | Wait or upgrade plan |
| "API token not configured" | Missing env variable | Set `STOCKDATA_ORG_API_TOKEN` |
| "No price data available" | No data for date range | Try different date range |

## Caching

- **Duration**: 5 minutes
- **Scope**: Per ticker and date/date range
- **Behavior**: Automatic, transparent to caller

## Best Practices

1. **Handle Errors**: Always wrap API calls in try-catch
2. **Validate Input**: Check ticker symbols before calling
3. **Cache Wisely**: Use appropriate time periods to minimize API calls
4. **Monitor Usage**: Keep track of API usage to avoid rate limits
5. **Use Current Price**: Use `fetchCurrentStockPrice()` when only current price is needed

## Development Workflow

```bash
# 1. Set environment variable
echo "STOCKDATA_ORG_API_TOKEN=your_token" > .env.local

# 2. Start dev server
npm run dev

# 3. Test the service
curl "http://localhost:3000/api/stock-price?ticker=AAPL"
```

## Deployment Checklist

- [ ] Get StockData.org API token
- [ ] Set `STOCKDATA_ORG_API_TOKEN` in deployment platform
- [ ] Deploy application
- [ ] Test in production
- [ ] Monitor API usage
- [ ] Set up error alerting

## Rate Limits

Rate limits depend on your StockData.org plan:
- Check your plan details at https://www.stockdata.org/
- Monitor usage in your StockData.org dashboard
- Implement additional caching if needed
- Consider upgrading plan based on usage

## Support

- **Setup Issues**: See `STOCKDATA_SETUP.md`
- **API Issues**: Contact StockData.org support
- **Integration Issues**: Check application logs

## Files Reference

- **Service**: `lib/services/stockdata.service.ts`
- **Function**: `netlify/functions/stockdata-org.js`
- **Config**: `netlify.toml`
- **Docs**: `STOCKDATA_SETUP.md`
- **Summary**: `STOCKDATA_MIGRATION_SUMMARY.md`
