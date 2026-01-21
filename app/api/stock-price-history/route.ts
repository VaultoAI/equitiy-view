import { NextRequest, NextResponse } from 'next/server';
import { fetchStockDataDirectly } from '@/lib/services/stockdata.service';
import { fetchDailyTimeSeries } from '@/lib/services/alphavantage.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Cache for historical stock prices with dynamic TTL
const historyCache = new Map<string, { data: Array<{ date: number; price: number }>; timestamp: number }>();
const HISTORICAL_CACHE_TTL = 30 * 60 * 1000; // 30 minutes for older historical data
const CURRENT_CACHE_TTL = 1 * 60 * 1000; // 1 minute for recent data
const MAX_CACHE_SIZE = 500; // Maximum number of cache entries

/**
 * Determines if a date range includes recent dates (last 2 days)
 */
function includesRecentDates(endDate: number): boolean {
  const now = Date.now();
  const twoDaysAgo = now - (2 * 86400 * 1000); // 2 days in milliseconds
  const endDateTime = endDate * 1000; // Convert from seconds to milliseconds
  
  return endDateTime >= twoDaysAgo;
}

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

    // Check cache first with dynamic TTL
    const cacheKey = `${ticker}-${startDate}-${endDate}`;
    const cached = historyCache.get(cacheKey);
    const cacheTTL = includesRecentDates(endDate) ? CURRENT_CACHE_TTL : HISTORICAL_CACHE_TTL;
    
    if (cached && Date.now() - cached.timestamp < cacheTTL) {
      console.log(`📊 [Stock Price History API] Cache hit for ${ticker} from ${startDate} to ${endDate} (TTL: ${cacheTTL/1000}s)`);
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

      // Try Alpha Vantage first (PRIMARY SOURCE)
      let dataSource: 'alphavantage' | 'stockdata' = 'alphavantage';
      const priceMap = new Map<number, number>();

      console.log(`📊 [Stock Price History API] Using Alpha Vantage as primary source`);
      
      try {
        // Use 'compact' output (last 100 days) - 'full' requires premium subscription
        const avData = await fetchDailyTimeSeries(ticker, 'compact');
        
        if (avData && avData.length > 0) {
          dataSource = 'alphavantage';
          
          // Convert Alpha Vantage data to price map
          avData.forEach(dataPoint => {
            const date = new Date(dataPoint.date);
            const normalizedTimestamp = normalizeToStartOfDay(Math.floor(date.getTime() / 1000));
            priceMap.set(normalizedTimestamp, dataPoint.close);
          });
          
          console.log(`✅ [Stock Price History API] Alpha Vantage provided ${avData.length} data points`);
          if (avData.length > 0) {
            console.log(`📊 [Stock Price History API] Latest from Alpha Vantage: ${avData[0].date} at $${avData[0].close}`);
            console.log(`📊 [Stock Price History API] Oldest from Alpha Vantage: ${avData[avData.length - 1].date}`);
          }
        }
      } catch (avError: any) {
        console.warn(`⚠️ [Stock Price History API] Alpha Vantage failed, falling back to StockData.org:`, avError.message);
      }

      // Use StockData.org only as fallback
      if (priceMap.size === 0) {
        console.log(`📊 [Stock Price History API] Using StockData.org`);
        dataSource = 'stockdata';
        
        const stockData = await fetchStockDataDirectly(ticker, startDateStr, endDateStr);

        if (!stockData.prices || stockData.prices.length === 0) {
          console.warn(`⚠️ [Stock Price History API] No price data found for ${ticker}`);
          return NextResponse.json(
            { error: `No price data available for ${ticker} in the specified date range` },
            { status: 404 }
          );
        }

        // Create a map of normalized dates to prices from the service response
        stockData.prices.forEach(priceData => {
          const priceDate = new Date(priceData.date);
          const normalizedTimestamp = normalizeToStartOfDay(Math.floor(priceDate.getTime() / 1000));
          priceMap.set(normalizedTimestamp, priceData.price);
        });
      }
      
      // Alpha Vantage 'full' output provides 20+ years of data, so no need to supplement

      console.log(`📊 [Stock Price History API] Created price map with ${priceMap.size} unique dates`);
      const lastFiveDates = Array.from(priceMap.keys()).slice(-5).map(ts => ({
        timestamp: ts,
        date: new Date(ts * 1000).toISOString().split('T')[0],
        price: priceMap.get(ts)
      }));
      console.log(`📊 [Stock Price History API] Price map dates:`, lastFiveDates);

      // Generate array of prices for each day in the requested range
      // Fill in weekend/holiday gaps with last known price
      const prices: Array<{ date: number; price: number }> = [];
      const normalizedStartDate = normalizeToStartOfDay(startDate);
      const normalizedEndDate = normalizeToStartOfDay(endDate);

      // Get sorted list of available trading days
      const tradingDays = Array.from(priceMap.keys()).sort((a, b) => a - b);

      // For each day in the range, find price (exact or last known)
      let currentDate = normalizedStartDate;
      while (currentDate <= normalizedEndDate) {
        let price: number | undefined = priceMap.get(currentDate);
        
        // If no exact match, find the last trading day before this date
        if (price === undefined) {
          for (let i = tradingDays.length - 1; i >= 0; i--) {
            if (tradingDays[i] <= currentDate) {
              price = priceMap.get(tradingDays[i]);
              break;
            }
          }
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

      // Cache the result with size management
      if (historyCache.size >= MAX_CACHE_SIZE) {
        // Remove oldest entries (first 20% of cache)
        const entriesToRemove = Math.floor(MAX_CACHE_SIZE * 0.2);
        const keys = Array.from(historyCache.keys());
        for (let i = 0; i < entriesToRemove && i < keys.length; i++) {
          historyCache.delete(keys[i]);
        }
      }
      historyCache.set(cacheKey, { data: prices, timestamp: Date.now() });

      console.log(`✅ [Stock Price History API] Found ${prices.length} price points for ${ticker}`);

      // Find the last trading day from price map
      const lastTradingDay = priceMap.size > 0 ? Math.max(...Array.from(priceMap.keys())) : 0;
      const lastTradingDate = lastTradingDay > 0 ? new Date(lastTradingDay * 1000).toISOString().split('T')[0] : 'unknown';
      
      // Calculate data freshness
      const now = Date.now();
      const lastDataTimestamp = lastTradingDay * 1000;
      const dataAgeHours = lastTradingDay > 0 ? Math.floor((now - lastDataTimestamp) / (1000 * 60 * 60)) : 999;
      const isStale = dataAgeHours > 24;

      return NextResponse.json({
        ticker,
        startDate,
        endDate,
        prices,
        cached: false,
        source: dataSource,
        metadata: {
          lastTradingDay: lastTradingDate,
          dataAgeHours,
          isStale,
          note: dataSource === 'alphavantage' 
            ? 'Real-time data from Alpha Vantage (15-min delay)'
            : isStale 
            ? 'EOD data updates once per trading day after market close' 
            : 'Data is current'
        }
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
