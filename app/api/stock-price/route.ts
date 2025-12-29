import { NextRequest, NextResponse } from 'next/server';
import YahooFinance from 'yahoo-finance2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Create yahoo-finance2 instance (suppress notices for cleaner logs)
const yahooFinance = new YahooFinance({ 
  suppressNotices: ['yahooSurvey', 'ripHistorical'] 
});

// Cache for stock prices (5 minute TTL)
const priceCache = new Map<string, { price: number; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * GET /api/stock-price?ticker=AAPL&date=2024-01-15
 * Fetches stock price for a given ticker and date
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

    // Check cache first
    const cacheKey = `${ticker}-${targetDate.toISOString().split('T')[0]}`;
    const cached = priceCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log(`📊 [Stock Price API] Cache hit for ${ticker} on ${targetDate.toISOString().split('T')[0]}`);
      return NextResponse.json({ 
        ticker,
        date: targetDate.toISOString().split('T')[0],
        price: cached.price,
        cached: true
      });
    }

    console.log(`📊 [Stock Price API] Fetching price for ${ticker} on ${targetDate.toISOString().split('T')[0]}`);

    // Fetch price data for the date
    const dateStr = targetDate.toISOString().split('T')[0];
    const todayStr = new Date().toISOString().split('T')[0];
    
    try {
      let price: number | null = null;

      if (dateStr === todayStr) {
        // Today's price - use current quote
        const quote = await yahooFinance.quote(ticker);
        price = quote.regularMarketPrice || null;
      } else {
        // Historical price - use chart() API (historical() is deprecated)
        // Convert date to Unix timestamp (seconds)
        const targetTimestamp = Math.floor(targetDate.getTime() / 1000);
        const endTimestamp = targetTimestamp + 86400; // Add 1 day to ensure we get the date
        
        // Use chart() API which is the recommended replacement for historical()
        const chartData = await yahooFinance.chart(ticker, {
          period1: targetTimestamp,
          period2: endTimestamp,
          interval: '1d', // Daily interval
        });

        if (chartData && chartData.quotes && chartData.quotes.length > 0) {
          // Find the quote for the exact date or closest date
          const targetDateObj = new Date(targetDate);
          targetDateObj.setHours(0, 0, 0, 0);
          
          // Try to find exact date match first
          let quote = chartData.quotes.find((q: any) => {
            const quoteDate = new Date(q.date);
            quoteDate.setHours(0, 0, 0, 0);
            return quoteDate.getTime() === targetDateObj.getTime();
          });

          // If no exact match, get the closest date before or on target date
          if (!quote) {
            const validQuotes = chartData.quotes.filter((q: any) => {
              const quoteDate = new Date(q.date);
              return quoteDate.getTime() <= targetDate.getTime();
            });
            
            if (validQuotes.length > 0) {
              quote = validQuotes[validQuotes.length - 1];
            } else {
              // If all quotes are after target date, use the first one
              quote = chartData.quotes[0];
            }
          }

          if (quote) {
            price = quote.close || null;
          }
        }

        // Fallback: If no data for exact date, try a wider range (handles weekends/holidays)
        if (price === null) {
          const weekBefore = targetTimestamp - 7 * 86400; // 7 days before
          const weekAfter = targetTimestamp + 86400; // 1 day after
          
          const fallbackChart = await yahooFinance.chart(ticker, {
            period1: weekBefore,
            period2: weekAfter,
            interval: '1d',
          });

          if (fallbackChart && fallbackChart.quotes && fallbackChart.quotes.length > 0) {
            // Get the most recent price before or on the target date
            const validQuotes = fallbackChart.quotes.filter((q: any) => {
              return new Date(q.date).getTime() <= targetDate.getTime();
            });
            
            if (validQuotes.length > 0) {
              price = validQuotes[validQuotes.length - 1].close || null;
            } else {
              // Use the oldest available price if all are after target date
              price = fallbackChart.quotes[0].close || null;
            }
          }
        }
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
    } catch (yahooError: any) {
      console.error(`❌ [Stock Price API] Yahoo Finance error for ${ticker}:`, yahooError.message);
      
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
