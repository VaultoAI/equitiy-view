import { NextRequest, NextResponse } from 'next/server';
import { getCachedData, setCachedData } from '@/lib/cache/serverCache';
import { fetchTokenizedStockPools } from '@/lib/cache/poolFetchers';
import { TablePool } from '@/lib/pools/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CACHE_KEY = 'tokenizedStockPools';

export async function GET(request: NextRequest) {
  try {
    // If the client explicitly requests fresh data, bypass the server cache.
    // This is used by the ETH pools page to ensure users always see up-to-date pools.
    const searchParams = request.nextUrl.searchParams;
    const freshParam = searchParams.get('fresh');
    const forceFresh = freshParam === '1' || freshParam === 'true';

    // Check cache first
    const cachedData = forceFresh ? null : getCachedData<TablePool[]>(CACHE_KEY);
    
    if (cachedData !== null) {
      console.log(`✅ [Tokenized Stock Pools API] Returning cached data (${cachedData.length} pools)`);
      return NextResponse.json(
        { pools: cachedData, cached: true },
        {
          headers: {
            // Prevent intermediary caching of the API response.
            'Cache-Control': 'no-store',
          },
        }
      );
    }

    // Cache miss or expired, fetch fresh data
    console.log(
      `🔄 [Tokenized Stock Pools API] ${forceFresh ? 'Force-fresh request' : 'Cache miss'}, fetching fresh data...`
    );
    const pools = await fetchTokenizedStockPools();
    
    // Update cache
    setCachedData(CACHE_KEY, pools);
    console.log(`💾 [Tokenized Stock Pools API] Cached ${pools.length} pools for 1 hour`);
    
    return NextResponse.json(
      { pools, cached: false },
      {
        headers: {
          // Prevent intermediary caching of the API response.
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    console.error('❌ [Tokenized Stock Pools API] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch tokenized stock pools', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}


