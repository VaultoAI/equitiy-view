import { NextRequest, NextResponse } from 'next/server';
import { fetchStockDataDirectly } from '@/lib/services/stockdata.service';
import { fetchPriceForDate, shouldUseAlphaVantage } from '@/lib/services/alphavantage.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Cache for stock prices with dynamic TTL
const priceCache = new Map<string, { price: number; timestamp: number }>();
const HISTORICAL_CACHE_TTL = 60 * 60 * 1000; // 1 hour for historical data
const CURRENT_CACHE_TTL = 1 * 60 * 1000; // 1 minute for current/recent data
const MAX_CACHE_SIZE = 1000; // Maximum number of cache entries

/**
 * Determines if a date is today or within the last 2 days (needs fresh data)
 */
function isRecentDate(dateStr: string): boolean {
  const targetDate = new Date(dateStr);
  const now = new Date();
  const twoDaysAgo = new Date(now);
  twoDaysAgo.setDate(now.getDate() - 2);
  
  // Reset time components for comparison
  targetDate.setHours(0, 0, 0, 0);
  twoDaysAgo.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  
  return targetDate >= twoDaysAgo;
}

/**
 * GET /api/stock-price?ticker=AAPL&date=2024-01-15
 * Fetches stock price for a given ticker and date
 * Now uses StockData.org API via serverless function proxy
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const ticker = searchParams.get('ticker');
    const dateParam = searchParams.get('date');

    if (!ticker) {
      return NextResponse.json(
        { error: 'Ticker parameter is required' },
        { status: 400 }
      );
    }

    // Use provided date or default to today
    let targetDate: Date;
    if (dateParam) {
      targetDate = new Date(dateParam);
      if (isNaN(targetDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid date format. Use YYYY-MM-DD' },
          { status: 400 }
        );
      }
    } else {
      targetDate = new Date();
    }

    // Format date as YYYY-MM-DD
    const dateStr = targetDate.toISOString().split('T')[0];

    // Check cache first with dynamic TTL
    const cacheKey = `${ticker}-${dateStr}`;
    const cached = priceCache.get(cacheKey);
    const cacheTTL = isRecentDate(dateStr) ? CURRENT_CACHE_TTL : HISTORICAL_CACHE_TTL;
    
    if (cached && Date.now() - cached.timestamp < cacheTTL) {
      console.log(`📊 [Stock Price API] Cache hit for ${ticker} on ${dateStr} (TTL: ${cacheTTL/1000}s)`);
      return NextResponse.json({ 
        ticker,
        date: dateStr,
        price: cached.price,
        cached: true
      });
    }

    console.log(`📊 [Stock Price API] Fetching price for ${ticker} on ${dateStr}`);

    try {
      let price: number | null = null;
      let dataSource: 'alphavantage' | 'stockdata' = 'alphavantage';

      // Try Alpha Vantage first (PRIMARY SOURCE)
      console.log(`📊 [Stock Price API] Using Alpha Vantage as primary source for ${dateStr}`);
      try {
        const result = await fetchPriceForDate(ticker, dateStr);
        price = result.price;
        dataSource = 'alphavantage';
        console.log(`✅ [Stock Price API] Alpha Vantage returned price: $${price} for ${result.date}`);
      } catch (avError: any) {
        console.warn(`⚠️ [Stock Price API] Alpha Vantage failed, falling back to StockData.org:`, avError.message);
        // Fall through to StockData.org as backup
      }

      // Use StockData.org only as fallback
      if (price === null) {
        console.log(`📊 [Stock Price API] Using StockData.org for ${dateStr}`);
        dataSource = 'stockdata';
        
        // Check if requesting today's price
        const todayStr = new Date().toISOString().split('T')[0];
        
        // For both today and historical dates, fetch a range around the target date
        // Add buffer days to handle weekends/holidays
        const startDate = new Date(targetDate);
        startDate.setDate(startDate.getDate() - 7); // 7 days before
        const endDate = new Date(targetDate);
        endDate.setDate(endDate.getDate() + 1); // 1 day after

        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];

        const stockData = await fetchStockDataDirectly(ticker, startDateStr, endDateStr);

        // If requesting today's price, use the most recent price
        if (dateStr === todayStr) {
          price = stockData.currentPrice;
        } else {
          // Find the price for the target date or closest date before it
          const targetTime = targetDate.getTime();
          let closestPrice: number | null = null;
          let closestTimeDiff = Infinity;

          for (const priceData of stockData.prices) {
            const priceDate = new Date(priceData.date);
            const timeDiff = Math.abs(targetTime - priceDate.getTime());
            
            // Prefer dates on or before the target date
            if (priceDate.getTime() <= targetTime) {
              if (timeDiff < closestTimeDiff) {
                closestTimeDiff = timeDiff;
                closestPrice = priceData.price;
              }
            }
          }

          // If no date found before target, use the earliest available
          if (closestPrice === null && stockData.prices.length > 0) {
            closestPrice = stockData.prices[0].price;
          }

          price = closestPrice;
        }
      }

      if (price === null) {
        console.warn(`⚠️ [Stock Price API] No price data found for ${ticker} on ${dateStr}`);
        return NextResponse.json(
          { error: `No price data available for ${ticker} on ${dateStr}` },
          { status: 404 }
        );
      }

      // Cache the result with size management
      if (priceCache.size >= MAX_CACHE_SIZE) {
        // Remove oldest entries (first 20% of cache)
        const entriesToRemove = Math.floor(MAX_CACHE_SIZE * 0.2);
        const keys = Array.from(priceCache.keys());
        for (let i = 0; i < entriesToRemove && i < keys.length; i++) {
          priceCache.delete(keys[i]);
        }
      }
      priceCache.set(cacheKey, { price, timestamp: Date.now() });

      console.log(`✅ [Stock Price API] Found price for ${ticker}: $${price} on ${dateStr} (source: ${dataSource})`);

      return NextResponse.json({
        ticker,
        date: dateStr,
        price,
        cached: false,
        source: dataSource
      });
    } catch (serviceError: any) {
      console.error(`❌ [Stock Price API] StockData service error for ${ticker}:`, serviceError.message);
      
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
        { error: `Failed to fetch stock price: ${errorMessage}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('❌ [Stock Price API] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
