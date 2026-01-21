/**
 * Stock Data Service
 * Fetches historical stock data from StockData.org API via serverless function proxy
 */

export interface StockPriceData {
  date: string; // ISO date string
  price: number;
}

export interface StockDataResponse {
  symbol: string;
  prices: StockPriceData[];
  currentPrice: number;
}

export interface StockDataApiResponse {
  data: Array<{
    date: string; // YYYY-MM-DD format
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }>;
}

/**
 * Time period mappings to days
 */
const PERIOD_TO_DAYS: Record<string, number> = {
  '24h': 2,    // 2 days for daily movements
  '7d': 7,     // 7 days
  '30d': 30,   // 30 days
  '3m': 90,    // ~3 months
  '6m': 180,   // ~6 months
  '1y': 365,   // 1 year
};

/**
 * Calculates date range based on time period
 * @param period - Time period (e.g., '7d', '30d', '3m', '6m', '1y')
 * @returns Object with date_from and date_to in YYYY-MM-DD format
 */
function calculateDateRange(period: string): { date_from: string; date_to: string } {
  const days = PERIOD_TO_DAYS[period] || 30; // Default to 30 days
  
  const endDate = new Date();
  endDate.setHours(0, 0, 0, 0);
  
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);
  
  return {
    date_from: formatDate(startDate),
    date_to: formatDate(endDate),
  };
}

/**
 * Formats a date to YYYY-MM-DD
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Normalizes a date to midnight UTC
 */
function normalizeDate(dateStr: string): string {
  const date = new Date(dateStr);
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString();
}

/**
 * Validates that a price is a valid number greater than 0
 */
function isValidPrice(price: number): boolean {
  return typeof price === 'number' && !isNaN(price) && price > 0;
}

/**
 * Transforms API response to application format
 */
function transformApiResponse(symbol: string, apiData: StockDataApiResponse): StockDataResponse {
  if (!apiData.data || !Array.isArray(apiData.data) || apiData.data.length === 0) {
    throw new Error(`No price data available for ${symbol}`);
  }

  // Extract close prices and convert to application format
  const prices: StockPriceData[] = apiData.data
    .filter(item => isValidPrice(item.close))
    .map(item => ({
      date: normalizeDate(item.date),
      price: item.close,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // Sort oldest first

  if (prices.length === 0) {
    throw new Error(`No valid price data available for ${symbol}`);
  }

  // Current price is the last (most recent) price
  const currentPrice = prices[prices.length - 1].price;

  return {
    symbol,
    prices,
    currentPrice,
  };
}

/**
 * Gets the base URL for API calls
 * Handles both client-side and server-side contexts
 */
function getBaseUrl(): string {
  // Client-side: use relative URLs (empty string means current origin)
  if (typeof window !== 'undefined') {
    return '';
  }
  
  // Server-side: determine the correct URL based on environment
  // Check for Netlify environment
  if (process.env.URL) {
    // Netlify provides the URL environment variable
    return process.env.URL;
  }
  
  // Check for Vercel environment
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  
  // Check for custom API URL
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  
  // Default to localhost for local development
  return 'http://localhost:3000';
}

/**
 * Fetches historical stock data for a given symbol and time period
 * @param symbol - Stock ticker symbol (e.g., 'AAPL')
 * @param period - Time period (e.g., '7d', '30d', '3m', '6m', '1y')
 * @returns Stock data response with prices and current price
 */
export async function fetchStockData(
  symbol: string,
  period: string = '30d'
): Promise<StockDataResponse> {
  if (!symbol || typeof symbol !== 'string') {
    throw new Error('Symbol is required and must be a string');
  }

  const { date_from, date_to } = calculateDateRange(period);

  try {
    // Call the serverless function proxy (not the external API directly)
    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/api/stockdata-org?symbol=${encodeURIComponent(symbol.toUpperCase())}&date_from=${date_from}&date_to=${date_to}`;
    
    console.log(`📊 [StockData Service] Fetching data for ${symbol} from ${date_from} to ${date_to}`);

    const response = await fetch(url);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(
        errorData.error || `Failed to fetch stock data: ${response.status} ${response.statusText}`
      );
    }

    const apiData: StockDataApiResponse = await response.json();

    // Validate response structure
    if (!apiData.data) {
      throw new Error('Invalid API response: missing data field');
    }

    const transformedData = transformApiResponse(symbol.toUpperCase(), apiData);
    
    console.log(`✅ [StockData Service] Successfully fetched ${transformedData.prices.length} price points for ${symbol}`);

    return transformedData;
  } catch (error) {
    console.error(`❌ [StockData Service] Error fetching data for ${symbol}:`, error);
    
    if (error instanceof Error) {
      throw error;
    }
    
    throw new Error(`Failed to fetch stock data for ${symbol}: Unknown error`);
  }
}

/**
 * Fetches stock data directly from StockData.org API
 * This function is for server-side use only (requires API token)
 * @param symbol - Stock ticker symbol
 * @param startDate - Start date in YYYY-MM-DD format
 * @param endDate - End date in YYYY-MM-DD format
 * @returns Stock data response
 */
export async function fetchStockDataDirectly(
  symbol: string,
  startDate: string,
  endDate: string
): Promise<StockDataResponse> {
  if (!symbol || typeof symbol !== 'string') {
    throw new Error('Symbol is required and must be a string');
  }

  if (!startDate || !endDate) {
    throw new Error('Start date and end date are required');
  }

  // Check for API token (server-side only)
  const apiToken = process.env.STOCKDATA_ORG_API_TOKEN;
  if (!apiToken) {
    throw new Error('API token not configured');
  }

  try {
    // Build API URL
    const baseUrl = 'https://api.stockdata.org/v1/data/eod';
    const params = new URLSearchParams({
      api_token: apiToken,
      symbols: symbol.toUpperCase(),
      interval: 'day',
      sort: 'asc',
      date_from: startDate,
      date_to: endDate,
    });

    const apiUrl = `${baseUrl}?${params.toString()}`;
    
    console.log(`📊 [StockData Service Direct] Fetching data for ${symbol} from ${startDate} to ${endDate}`);

    const response = await fetch(apiUrl);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [StockData Service Direct] API error: ${response.status} ${response.statusText}`, errorText);
      
      if (response.status === 404) {
        throw new Error(`Invalid ticker or no data available: ${symbol}`);
      } else if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      } else if (response.status === 401 || response.status === 403) {
        throw new Error('API authentication failed. Please check your API token.');
      }
      
      throw new Error(`Failed to fetch stock data: ${response.status} ${response.statusText}`);
    }

    const apiData: StockDataApiResponse = await response.json();

    if (!apiData.data) {
      throw new Error('Invalid API response: missing data field');
    }

    // Log raw API data for debugging
    console.log(`📊 [StockData Service Direct] Raw API returned ${apiData.data.length} data points`);
    if (apiData.data.length > 0) {
      const lastFive = apiData.data.slice(-5);
      console.log(`📊 [StockData Service Direct] Last 5 data points:`, 
        lastFive.map(d => ({ date: d.date, close: d.close }))
      );
    }

    const transformedData = transformApiResponse(symbol.toUpperCase(), apiData);
    
    console.log(`✅ [StockData Service Direct] Successfully fetched ${transformedData.prices.length} price points for ${symbol}`);

    return transformedData;
  } catch (error) {
    console.error(`❌ [StockData Service Direct] Error fetching data for ${symbol}:`, error);
    
    if (error instanceof Error) {
      throw error;
    }
    
    throw new Error(`Failed to fetch stock data for ${symbol}: Unknown error`);
  }
}

/**
 * Fetches stock data for a specific date range
 * @param symbol - Stock ticker symbol
 * @param startDate - Start date in YYYY-MM-DD format
 * @param endDate - End date in YYYY-MM-DD format
 * @returns Stock data response
 */
export async function fetchStockDataByDateRange(
  symbol: string,
  startDate: string,
  endDate: string
): Promise<StockDataResponse> {
  if (!symbol || typeof symbol !== 'string') {
    throw new Error('Symbol is required and must be a string');
  }

  if (!startDate || !endDate) {
    throw new Error('Start date and end date are required');
  }

  try {
    const baseUrl = getBaseUrl();
    const url = `${baseUrl}/api/stockdata-org?symbol=${encodeURIComponent(symbol.toUpperCase())}&date_from=${startDate}&date_to=${endDate}`;
    
    console.log(`📊 [StockData Service] Fetching data for ${symbol} from ${startDate} to ${endDate}`);

    const response = await fetch(url);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(
        errorData.error || `Failed to fetch stock data: ${response.status} ${response.statusText}`
      );
    }

    const apiData: StockDataApiResponse = await response.json();

    if (!apiData.data) {
      throw new Error('Invalid API response: missing data field');
    }

    const transformedData = transformApiResponse(symbol.toUpperCase(), apiData);
    
    console.log(`✅ [StockData Service] Successfully fetched ${transformedData.prices.length} price points for ${symbol}`);

    return transformedData;
  } catch (error) {
    console.error(`❌ [StockData Service] Error fetching data for ${symbol}:`, error);
    
    if (error instanceof Error) {
      throw error;
    }
    
    throw new Error(`Failed to fetch stock data for ${symbol}: Unknown error`);
  }
}

/**
 * Fetches current stock price
 * @param symbol - Stock ticker symbol
 * @returns Current price or null if not available
 */
export async function fetchCurrentStockPrice(symbol: string): Promise<number | null> {
  try {
    const data = await fetchStockData(symbol, '24h');
    return data.currentPrice;
  } catch (error) {
    console.error(`❌ [StockData Service] Error fetching current price for ${symbol}:`, error);
    return null;
  }
}
