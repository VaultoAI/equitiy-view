import { NextRequest, NextResponse } from 'next/server';
import { fetchSolanaPools } from '@/lib/cache/poolFetchers';
import { TablePool } from '@/lib/pools/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Always fetch fresh data - no caching
    console.log(`🔄 [Solana Pools API] Fetching fresh data...`);
    const pools = await fetchSolanaPools();
    console.log(`✅ [Solana Pools API] Fetched ${pools.length} pools`);
    
    return NextResponse.json(
      { pools },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  } catch (error) {
    console.error('❌ [Solana Pools API] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch Solana pools', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { 
        status: 500,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }
}

