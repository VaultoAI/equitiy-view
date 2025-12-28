import { NextRequest, NextResponse } from 'next/server';
import { getCachedData, setCachedData } from '@/lib/cache/serverCache';
import { fetchSolanaPools } from '@/lib/cache/poolFetchers';
import { TablePool } from '@/lib/pools/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CACHE_KEY = 'solanaPools';

export async function GET(request: NextRequest) {
  try {
    // Check cache first
    const cachedData = getCachedData<TablePool[]>(CACHE_KEY);
    
    if (cachedData !== null) {
      console.log(`✅ [Solana Pools API] Returning cached data (${cachedData.length} pools)`);
      return NextResponse.json({ pools: cachedData, cached: true });
    }

    // Cache miss or expired, fetch fresh data
    console.log(`🔄 [Solana Pools API] Cache miss, fetching fresh data...`);
    const pools = await fetchSolanaPools();
    
    // Update cache
    setCachedData(CACHE_KEY, pools);
    console.log(`💾 [Solana Pools API] Cached ${pools.length} pools for 1 hour`);
    
    return NextResponse.json({ pools, cached: false });
  } catch (error) {
    console.error('❌ [Solana Pools API] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch Solana pools', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

