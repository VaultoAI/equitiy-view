import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/stockdata-org?symbol=AAPL&date_from=2024-01-01&date_to=2024-01-31
 * Proxy endpoint to StockData.org API
 * This serves the same purpose as the Netlify function but works in Next.js dev/prod
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const symbol = searchParams.get('symbol');
    const date_from = searchParams.get('date_from');
    const date_to = searchParams.get('date_to');

    // Validate required parameters
    if (!symbol) {
      return NextResponse.json(
        { error: 'Symbol parameter is required' },
        { status: 400 }
      );
    }

    // Check for API token in environment
    const apiToken = process.env.STOCKDATA_ORG_API_TOKEN;
    if (!apiToken) {
      console.error('❌ [StockData Proxy] STOCKDATA_ORG_API_TOKEN environment variable is not set');
      return NextResponse.json(
        { error: 'API token not configured. Please contact support.' },
        { status: 500 }
      );
    }

    // Build API URL
    const baseUrl = 'https://api.stockdata.org/v1/data/eod';
    const params = new URLSearchParams({
      api_token: apiToken,
      symbols: symbol.toUpperCase(),
      interval: 'day',
      sort: 'asc',
    });

    // Add optional date parameters
    if (date_from) {
      params.append('date_from', date_from);
    }
    if (date_to) {
      params.append('date_to', date_to);
    }

    const apiUrl = `${baseUrl}?${params.toString()}`;

    console.log(`📊 [StockData Proxy] Fetching data for ${symbol}${date_from ? ` from ${date_from}` : ''}${date_to ? ` to ${date_to}` : ''}`);

    // Make request to StockData.org API
    const response = await fetch(apiUrl);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [StockData Proxy] API error for ${symbol}: ${response.status} ${response.statusText}`, errorText);
      
      // Determine appropriate error message
      let errorMessage = 'Failed to fetch stock data';
      
      if (response.status === 404) {
        errorMessage = `Invalid ticker or no data available: ${symbol}`;
      } else if (response.status === 429) {
        errorMessage = 'Rate limit exceeded. Please try again later.';
      } else if (response.status === 401 || response.status === 403) {
        errorMessage = 'API authentication failed. Please check your API token.';
      }
      
      return NextResponse.json(
        { error: errorMessage },
        { status: response.status }
      );
    }

    const data = await response.json();

    console.log(`✅ [StockData Proxy] Successfully fetched data for ${symbol}`);

    // Return response with CORS headers
    return NextResponse.json(data, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET',
      },
    });
  } catch (error) {
    console.error(`❌ [StockData Proxy] Error:`, error);

    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
