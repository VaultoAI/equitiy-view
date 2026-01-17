import { NextRequest, NextResponse } from 'next/server';
import { fetchStockDataDirectly } from '@/lib/services/stockdata.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Cache for historical stock prices (5 minute TTL)
const historyCache = new Map<string, { data: Array<{ date: number; price: number }>; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Normalizes a Unix timestamp to the start of the day (00:00:00 UTC)
 */
function normalizeToStartOfDay(timestamp: number): number {
  const date = new Date(timestamp * 1000);
  date.setUTCHours(0, 0, 0, 0);
  return Math.floor(date.getTime() / 1000);
}

/**
 * Converts Unix timestamp to YYYY-MM-DD format
 */
function timestampToDateString(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * GET /api/stock-price-history?ticker=AAPL&startDate=1704067200&endDate=1706659200
 * Fetches historical stock prices for a given ticker and date range
 * Returns array of { date: number, price: number } where date is Unix timestamp in seconds
 * Now uses StockData.org API via serverless function proxy
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const ticker = searchParams.get('ticker');
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');

    if (!ticker) {
      return NextResponse.json(
        { error: 'Ticker parameter is required' },
        { status: 400 }
      );
    }

    if (!startDateParam || !endDateParam) {
      return NextResponse.json(
        { error: 'startDate and endDate parameters are required (Unix timestamps in seconds)' },
        { status: 400 }
      );
    }

    const startDate = parseInt(startDateParam, 10);
    const endDate = parseInt(endDateParam, 10);

    if (isNaN(startDate) || isNaN(endDate)) {
      return NextResponse.json(
        { error: 'Invalid date format. startDate and endDate must be Unix timestamps in seconds' },
        { status: 400 }
      );
    }

    if (startDate > endDate) {
      return NextResponse.json(
        { error: 'startDate must be less than or equal to endDate' },
        { status: 400 }
      );
    }

    // Check cache first
    const cacheKey = `${ticker}-${startDate}-${endDate}`;
    const cached = historyCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`📊 [Stock Price History API] Cache hit for ${ticker} from ${startDate} to ${endDate}`);
      return NextResponse.json({
        ticker,
        startDate,
        endDate,
        prices: cached.data,
        cached: true
      });
    }

    console.log(`📊 [Stock Price History API] Fetching prices for ${ticker} from ${startDate} to ${endDate}`);

    try {
      // Convert Unix timestamps to YYYY-MM-DD format for the service
      // Add buffer days to handle weekends/holidays
      const bufferStartDate = startDate - (7 * 86400); // 7 days before
      const bufferEndDate = endDate + 86400; // 1 day after

      const startDateStr = timestampToDateString(bufferStartDate);
      const endDateStr = timestampToDateString(bufferEndDate);

      // Fetch data from StockData service directly
      const stockData = await fetchStockDataDirectly(ticker, startDateStr, endDateStr);

      if (!stockData.prices || stockData.prices.length === 0) {
        console.warn(`⚠️ [Stock Price History API] No price data found for ${ticker}`);
        return NextResponse.json(
          { error: `No price data available for ${ticker} in the specified date range` },
          { status: 404 }
        );
      }

      // Create a map of normalized dates to prices from the service response
      const priceMap = new Map<number, number>();
      stockData.prices.forEach(priceData => {
        const priceDate = new Date(priceData.date);
        const normalizedTimestamp = normalizeToStartOfDay(Math.floor(priceDate.getTime() / 1000));
        priceMap.set(normalizedTimestamp, priceData.price);
      });

      // Generate array of prices for each day in the requested range
      // Match each pool data date to the closest trading day
      const prices: Array<{ date: number; price: number }> = [];
      const normalizedStartDate = normalizeToStartOfDay(startDate);
      const normalizedEndDate = normalizeToStartOfDay(endDate);

      // Sort stock prices by date for finding closest trading days
      const sortedPrices = [...stockData.prices].sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      // For each day in the range, find the closest trading day price
      let currentDate = normalizedStartDate;
      while (currentDate <= normalizedEndDate) {
        // Try to find exact match first
        let price: number | undefined = priceMap.get(currentDate);
        
        // If no exact match, find closest trading day on or before the target date
        if (price === undefined) {
          const currentDateTime = currentDate * 1000; // Convert to milliseconds
          let closestPrice: number | null = null;
          
          for (let i = sortedPrices.length - 1; i >= 0; i--) {
            const priceDateTime = new Date(sortedPrices[i].date).getTime();
            if (priceDateTime <= currentDateTime) {
              closestPrice = sortedPrices[i].price;
              break;
            }
          }
          
          // If no date found before current, use the first available price
          if (closestPrice === null && sortedPrices.length > 0) {
            closestPrice = sortedPrices[0].price;
          }
          
          price = closestPrice !== null ? closestPrice : undefined;
        }

        if (price !== undefined && price > 0) {
          prices.push({
            date: currentDate,
            price: price
          });
        }

        // Move to next day
        currentDate += 86400; // Add 1 day in seconds
      }

      if (prices.length === 0) {
        console.warn(`⚠️ [Stock Price History API] No valid prices found for ${ticker} in date range`);
        return NextResponse.json(
          { error: `No valid price data available for ${ticker} in the specified date range` },
          { status: 404 }
        );
      }

      // Cache the result
      historyCache.set(cacheKey, { data: prices, timestamp: Date.now() });

      console.log(`✅ [Stock Price History API] Found ${prices.length} price points for ${ticker}`);

      return NextResponse.json({
        ticker,
        startDate,
        endDate,
        prices,
        cached: false
      });
    } catch (serviceError: any) {
      console.error(`❌ [Stock Price History API] StockData service error for ${ticker}:`, serviceError.message);
      
      const errorMessage = serviceError.message || serviceError.toString() || 'Unknown error';
      
      if (
        errorMessage.includes('Invalid ticker') || 
        errorMessage.includes('not found') ||
        errorMessage.includes('No data') ||
        errorMessage.includes('404')
      ) {
        return NextResponse.json(
          { error: `Invalid ticker or no data available: ${ticker}` },
          { status: 404 }
        );
      }

      if (
        errorMessage.includes('rate limit') ||
        errorMessage.includes('429')
      ) {
        return NextResponse.json(
          { error: `Rate limit exceeded. Please try again later.` },
          { status: 429 }
        );
      }

      if (
        errorMessage.includes('timeout') ||
        errorMessage.includes('network')
      ) {
        return NextResponse.json(
          { error: `Service temporarily unavailable. Please try again later.` },
          { status: 503 }
        );
      }

      return NextResponse.json(
        { error: `Failed to fetch stock prices: ${errorMessage}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('❌ [Stock Price History API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
