import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COINGECKO_API_URL = 'https://api.coingecko.com/api/v3';

/**
 * Fetches the current USD price of Ethereum (ETH) from CoinGecko
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const coinId = searchParams.get('coinId') || 'ethereum'; // Default to Ethereum
    
    const url = `${COINGECKO_API_URL}/simple/price?ids=${coinId}&vs_currencies=usd`;
    
    console.log(`🔍 [CoinGecko] Fetching price for ${coinId}`);
    
    const response = await fetch(url, {
      next: { revalidate: 60 }, // Cache for 60 seconds
    });
    
    if (!response.ok) {
      throw new Error(`CoinGecko API returned ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data[coinId] && data[coinId].usd) {
      const price = data[coinId].usd;
      console.log(`✅ [CoinGecko] Price for ${coinId}: $${price}`);
      return NextResponse.json({ 
        price,
        coinId,
        currency: 'usd'
      });
    } else {
      throw new Error(`Price data not found for ${coinId}`);
    }
  } catch (error) {
    console.error('❌ [CoinGecko] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch price from CoinGecko', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

