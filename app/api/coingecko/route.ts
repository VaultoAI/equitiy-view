import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COINGECKO_API_URL = 'https://api.coingecko.com/api/v3';

/**
 * Fetches token prices from CoinGecko
 * Supports:
 * - Single coin by ID: ?coinId=ethereum
 * - Multiple coins by ID: ?coinIds=ethereum,usd-coin
 * - Single contract address: ?contract=0x...&chainId=ethereum
 * - Multiple contract addresses: ?contracts=0x...,0x...&chainId=ethereum
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const coinId = searchParams.get('coinId');
    const coinIds = searchParams.get('coinIds');
    const contract = searchParams.get('contract');
    const contracts = searchParams.get('contracts');
    const chainId = searchParams.get('chainId') || 'ethereum'; // Default to ethereum chain
    
    // Handle multiple coin IDs
    if (coinIds) {
      const ids = coinIds.split(',').map(id => id.trim()).filter(Boolean);
      if (ids.length === 0) {
        return NextResponse.json({ error: 'No coin IDs provided' }, { status: 400 });
      }
      
      const url = `${COINGECKO_API_URL}/simple/price?ids=${ids.join(',')}&vs_currencies=usd`;
      console.log(`🔍 [CoinGecko] Fetching prices for ${ids.length} coins`);
      
      const response = await fetch(url, {
        next: { revalidate: 60 }, // Cache for 60 seconds
      });
      
      if (!response.ok) {
        throw new Error(`CoinGecko API returned ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`✅ [CoinGecko] Fetched prices for ${Object.keys(data).length} coins`);
      return NextResponse.json({ prices: data });
    }
    
    // Handle multiple contract addresses
    if (contracts) {
      const addresses = contracts.split(',').map(addr => addr.trim()).filter(Boolean);
      if (addresses.length === 0) {
        return NextResponse.json({ error: 'No contract addresses provided' }, { status: 400 });
      }
      
      // Fetch prices for each contract address
      const pricePromises = addresses.map(async (address) => {
        try {
          const url = `${COINGECKO_API_URL}/coins/${chainId}/contract/${address}`;
          const response = await fetch(url, {
            next: { revalidate: 60 },
          });
          
          if (!response.ok) {
            console.warn(`⚠️ [CoinGecko] Failed to fetch price for ${address}: ${response.status}`);
            return { address: address.toLowerCase(), price: null };
          }
          
          const data = await response.json();
          const price = data.market_data?.current_price?.usd;
          
          if (price) {
            return { address: address.toLowerCase(), price };
          }
          return { address: address.toLowerCase(), price: null };
        } catch (error) {
          console.warn(`⚠️ [CoinGecko] Error fetching price for ${address}:`, error);
          return { address: address.toLowerCase(), price: null };
        }
      });
      
      const results = await Promise.all(pricePromises);
      const priceMap: Record<string, number> = {};
      results.forEach(({ address, price }) => {
        if (price !== null) {
          priceMap[address] = price;
        }
      });
      
      console.log(`✅ [CoinGecko] Fetched prices for ${Object.keys(priceMap).length}/${addresses.length} contracts`);
      return NextResponse.json({ prices: priceMap });
    }
    
    // Handle single contract address
    if (contract) {
      const url = `${COINGECKO_API_URL}/coins/${chainId}/contract/${contract}`;
      console.log(`🔍 [CoinGecko] Fetching price for contract ${contract}`);
      
      const response = await fetch(url, {
        next: { revalidate: 60 },
      });
      
      if (!response.ok) {
        throw new Error(`CoinGecko API returned ${response.status}`);
      }
      
      const data = await response.json();
      const price = data.market_data?.current_price?.usd;
      
      if (price !== undefined) {
        console.log(`✅ [CoinGecko] Price for ${contract}: $${price}`);
        return NextResponse.json({ 
          price,
          contract,
          currency: 'usd'
        });
      } else {
        throw new Error(`Price data not found for contract ${contract}`);
      }
    }
    
    // Handle single coin ID (backward compatibility)
    const finalCoinId = coinId || 'ethereum';
    const url = `${COINGECKO_API_URL}/simple/price?ids=${finalCoinId}&vs_currencies=usd`;
    
    console.log(`🔍 [CoinGecko] Fetching price for ${finalCoinId}`);
    
    const response = await fetch(url, {
      next: { revalidate: 60 }, // Cache for 60 seconds
    });
    
    if (!response.ok) {
      throw new Error(`CoinGecko API returned ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data[finalCoinId] && data[finalCoinId].usd) {
      const price = data[finalCoinId].usd;
      console.log(`✅ [CoinGecko] Price for ${finalCoinId}: $${price}`);
      return NextResponse.json({ 
        price,
        coinId: finalCoinId,
        currency: 'usd'
      });
    } else {
      throw new Error(`Price data not found for ${finalCoinId}`);
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

