import { NextRequest, NextResponse } from 'next/server';
import { fetchStockDataByDateRange, fetchCurrentStockPrice } from '@/lib/services/stockdata.service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Cache for stock prices (5 minute TTL)
const priceCache = new Map<string, { price: number; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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

    // Check cache first
    const cacheKey = `${ticker}-${dateStr}`;
    const cached = priceCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`📊 [Stock Price API] Cache hit for ${ticker} on ${dateStr}`);
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

      // Check if requesting today's price
      const todayStr = new Date().toISOString().split('T')[0];
      
      if (dateStr === todayStr) {
        // For today, fetch the most recent price
        price = await fetchCurrentStockPrice(ticker);
      } else {
        // For historical dates, fetch a range around the target date
        // Add buffer days to handle weekends/holidays
        const startDate = new Date(targetDate);
        startDate.setDate(startDate.getDate() - 7); // 7 days before
        const endDate = new Date(targetDate);
        endDate.setDate(endDate.getDate() + 1); // 1 day after

        const startDateStr = startDate.toISOString().split('T')[0];
        const endDateStr = endDate.toISOString().split('T')[0];

        const stockData = await fetchStockDataByDateRange(ticker, startDateStr, endDateStr);

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

      if (price === null) {
        console.warn(`⚠️ [Stock Price API] No price data found for ${ticker} on ${dateStr}`);
        return NextResponse.json(
          { error: `No price data available for ${ticker} on ${dateStr}` },
          { status: 404 }
        );
      }

      // Cache the result
      priceCache.set(cacheKey, { price, timestamp: Date.now() });

      console.log(`✅ [Stock Price API] Found price for ${ticker}: $${price} on ${dateStr}`);

      return NextResponse.json({
        ticker,
        date: dateStr,
        price,
        cached: false
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
