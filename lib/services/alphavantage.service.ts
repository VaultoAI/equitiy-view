/**
 * Alpha Vantage Service
 * Fetches real-time and recent stock data from Alpha Vantage API
 * Used for current/recent prices (last 3 days) with minimal delay (15 minutes)
 */

export interface AlphaVantageQuote {
  symbol: string;
  price: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  latestTradingDay: string;
  previousClose: number;
  change: number;
  changePercent: string;
}

export interface AlphaVantageDailyData {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Fetches current/latest price quote for a symbol
 * Uses GLOBAL_QUOTE function - provides most recent trading data
 */
export async function fetchCurrentQuote(symbol: string): Promise<AlphaVantageQuote> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  
  if (!apiKey) {
    throw new Error('ALPHA_VANTAGE_API_KEY environment variable is not set');
  }

  const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol.toUpperCase()}&apikey=${apiKey}`;
  
  console.log(`📊 [Alpha Vantage] Fetching current quote for ${symbol}`);

  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Check for API errors
    if (data['Error Message']) {
      throw new Error(`Alpha Vantage API error: ${data['Error Message']}`);
    }

    if (data['Note']) {
      throw new Error(`Alpha Vantage rate limit: ${data['Note']}`);
    }

    if (!data['Global Quote'] || Object.keys(data['Global Quote']).length === 0) {
      throw new Error(`No quote data available for ${symbol}`);
    }

    const quote = data['Global Quote'];
    
    const result: AlphaVantageQuote = {
      symbol: quote['01. symbol'],
      price: parseFloat(quote['05. price']),
      open: parseFloat(quote['02. open']),
      high: parseFloat(quote['03. high']),
      low: parseFloat(quote['04. low']),
      volume: parseInt(quote['06. volume'], 10),
      latestTradingDay: quote['07. latest trading day'],
      previousClose: parseFloat(quote['08. previous close']),
      change: parseFloat(quote['09. change']),
      changePercent: quote['10. change percent'],
    };

    console.log(`✅ [Alpha Vantage] Got quote for ${symbol}: $${result.price} (${result.latestTradingDay})`);

    return result;
  } catch (error) {
    console.error(`❌ [Alpha Vantage] Error fetching quote for ${symbol}:`, error);
    throw error;
  }
}

/**
 * Fetches daily time series data for a symbol
 * Uses TIME_SERIES_DAILY function - provides daily OHLCV data
 */
export async function fetchDailyTimeSeries(
  symbol: string,
  outputSize: 'compact' | 'full' = 'compact'
): Promise<AlphaVantageDailyData[]> {
  const apiKey = process.env.ALPHA_VANTAGE_API_KEY;
  
  if (!apiKey) {
    throw new Error('ALPHA_VANTAGE_API_KEY environment variable is not set');
  }

  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol.toUpperCase()}&outputsize=${outputSize}&apikey=${apiKey}`;
  
  console.log(`📊 [Alpha Vantage] Fetching daily time series for ${symbol} (${outputSize})`);

  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Check for API errors
    if (data['Error Message']) {
      throw new Error(`Alpha Vantage API error: ${data['Error Message']}`);
    }

    if (data['Note']) {
      throw new Error(`Alpha Vantage rate limit: ${data['Note']}`);
    }

    const timeSeries = data['Time Series (Daily)'];
    
    if (!timeSeries) {
      // Log the actual response to understand what Alpha Vantage is returning
      console.error(`❌ [Alpha Vantage] No time series data for ${symbol}. Response keys:`, Object.keys(data));
      console.error(`📊 [Alpha Vantage] Full response:`, JSON.stringify(data, null, 2));
      throw new Error(`No time series data available for ${symbol}`);
    }

    // Convert to array and sort by date (newest first)
    const result: AlphaVantageDailyData[] = Object.entries(timeSeries)
      .map(([date, values]: [string, any]) => ({
        date,
        open: parseFloat(values['1. open']),
        high: parseFloat(values['2. high']),
        low: parseFloat(values['3. low']),
        close: parseFloat(values['4. close']),
        volume: parseInt(values['5. volume'], 10),
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    console.log(`✅ [Alpha Vantage] Got ${result.length} daily data points for ${symbol}`);
    if (result.length > 0) {
      console.log(`📊 [Alpha Vantage] Latest: ${result[0].date} at $${result[0].close}`);
    }

    return result;
  } catch (error) {
    console.error(`❌ [Alpha Vantage] Error fetching time series for ${symbol}:`, error);
    throw error;
  }
}

/**
 * Gets the price for a specific date from daily time series
 * Returns the exact date if available, or the closest previous trading day
 */
export async function fetchPriceForDate(
  symbol: string,
  targetDate: string // YYYY-MM-DD format
): Promise<{ date: string; price: number }> {
  // Use 'compact' for last 100 days (faster, sufficient for single date queries)
  const dailyData = await fetchDailyTimeSeries(symbol, 'compact'); // Last 100 days
  
  const targetTime = new Date(targetDate).getTime();
  
  // Find exact match first
  const exactMatch = dailyData.find(d => d.date === targetDate);
  if (exactMatch) {
    return { date: exactMatch.date, price: exactMatch.close };
  }

  // Find closest date on or before target
  const sortedData = [...dailyData].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  let closestDate: AlphaVantageDailyData | null = null;
  
  for (const dataPoint of sortedData) {
    const dataTime = new Date(dataPoint.date).getTime();
    if (dataTime <= targetTime) {
      closestDate = dataPoint;
    } else {
      break;
    }
  }

  if (!closestDate) {
    // If no date found before target, use the earliest available
    closestDate = sortedData[0];
  }

  console.log(`📊 [Alpha Vantage] For date ${targetDate}, using ${closestDate.date} price: $${closestDate.close}`);

  return { date: closestDate.date, price: closestDate.close };
}

/**
 * Determines if we should use Alpha Vantage for this date
 * Use for current day and last 3 days to get fresher data
 */
export function shouldUseAlphaVantage(dateStr: string): boolean {
  const targetDate = new Date(dateStr);
  const now = new Date();
  const threeDaysAgo = new Date(now);
  threeDaysAgo.setDate(now.getDate() - 3);
  
  // Reset time components for comparison
  targetDate.setHours(0, 0, 0, 0);
  threeDaysAgo.setHours(0, 0, 0, 0);
  now.setHours(0, 0, 0, 0);
  
  return targetDate >= threeDaysAgo && targetDate <= now;
}
