import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Create yahoo-finance2 instance (suppress notices for cleaner logs)
const yahooFinance = new YahooFinance({ 
  suppressNotices: ['yahooSurvey', 'ripHistorical'] 
});

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
 * Finds the closest trading day price for a given date
 * Returns the price from the most recent trading day <= target date
 */
function findClosestTradingDayPrice(
  quotes: any[],
  targetTimestamp: number
): number | null {
  if (!quotes || quotes.length === 0) return null;

  const targetDate = normalizeToStartOfDay(targetTimestamp);
  
  // Find quotes on or before the target date
  const validQuotes = quotes.filter((q: any) => {
    const quoteDate = normalizeToStartOfDay(new Date(q.date).getTime() / 1000);
    return quoteDate <= targetDate;
  });

  if (validQuotes.length > 0) {
    // Return the most recent trading day's close price
    return validQuotes[validQuotes.length - 1].close || null;
  }

  // If all quotes are after target date, use the first available price
  return quotes[0]?.close || null;
}

/**
 * GET /api/stock-price-history?ticker=AAPL&startDate=1704067200&endDate=1706659200
 * Fetches historical stock prices for a given ticker and date range
 * Returns array of { date: number, price: number } where date is Unix timestamp in seconds
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
      // Fetch historical data using chart API
      // Add a buffer of 7 days before startDate to handle weekends/holidays
      const bufferStart = startDate - (7 * 86400);
      const bufferEnd = endDate + 86400; // Add 1 day to ensure we get endDate

      const chartData = await yahooFinance.chart(ticker, {
        period1: bufferStart,
        period2: bufferEnd,
        interval: '1d', // Daily interval
      });

      if (!chartData || !chartData.quotes || chartData.quotes.length === 0) {
        console.warn(`⚠️ [Stock Price History API] No price data found for ${ticker}`);
        return NextResponse.json(
          { error: `No price data available for ${ticker} in the specified date range` },
          { status: 404 }
        );
      }

      // Create a map of normalized dates to prices for quick lookup
      const priceMap = new Map<number, number>();
      chartData.quotes.forEach((quote: any) => {
        const quoteDate = normalizeToStartOfDay(new Date(quote.date).getTime() / 1000);
        if (quote.close && quote.close > 0) {
          priceMap.set(quoteDate, quote.close);
        }
      });

      // Generate array of prices for each day in the requested range
      // Match each pool data date to the closest trading day
      const prices: Array<{ date: number; price: number }> = [];
      const sortedQuotes = [...chartData.quotes].sort((a: any, b: any) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      // For each day in the range, find the closest trading day price
      let currentDate = startDate;
      while (currentDate <= endDate) {
        const normalizedDate = normalizeToStartOfDay(currentDate);
        
        // Try to find exact match first
        let price: number | null | undefined = priceMap.get(normalizedDate);
        
        // If no exact match, find closest trading day
        if (price === undefined) {
          price = findClosestTradingDayPrice(sortedQuotes, currentDate);
        }

        if (price !== null && price !== undefined && price > 0) {
          prices.push({
            date: normalizedDate,
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
    } catch (yahooError: any) {
      console.error(`❌ [Stock Price History API] Yahoo Finance error for ${ticker}:`, yahooError.message);
      
      // Handle specific error cases
      const errorMessage = yahooError.message || yahooError.toString() || 'Unknown error';
      
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

      // Handle rate limiting or network errors
      if (
        errorMessage.includes('rate limit') ||
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
