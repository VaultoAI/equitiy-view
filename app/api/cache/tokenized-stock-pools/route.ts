import { NextRequest, NextResponse } from 'next/server';
import { fetchTokenizedStockPools } from '@/lib/cache/poolFetchers';
import { TablePool } from '@/lib/pools/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Always fetch fresh data - no caching
    console.log(`🔄 [Tokenized Stock Pools API] Fetching fresh data...`);
    const pools = await fetchTokenizedStockPools();
    console.log(`✅ [Tokenized Stock Pools API] Fetched ${pools.length} pools`);
    
    return NextResponse.json(
      { pools },
      {
        headers: {
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


