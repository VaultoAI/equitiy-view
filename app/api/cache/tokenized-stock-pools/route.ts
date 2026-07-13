import { NextRequest, NextResponse } from 'next/server';
import { fetchTokenizedStockPools, fetchBscTokenizedStockPools } from '@/lib/cache/poolFetchers';
import { TablePool } from '@/lib/pools/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Always fetch fresh data - no caching.
    // Ethereum (Uniswap subgraph) is authoritative and keeps its existing error
    // semantics; BSC (Dexscreener) is additive and best-effort, so a BSC failure
    // never breaks the page.
    console.log(`🔄 [Tokenized Stock Pools API] Fetching fresh data...`);
    const [ethPools, bscPools] = await Promise.all([
      fetchTokenizedStockPools(),
      fetchBscTokenizedStockPools().catch((err) => {
        console.warn('⚠️ [Tokenized Stock Pools API] BSC fetch failed, returning Ethereum pools only:', err);
        return [] as TablePool[];
      }),
    ]);
    const pools = [...ethPools, ...bscPools];
    console.log(`✅ [Tokenized Stock Pools API] Fetched ${pools.length} pools (${ethPools.length} ETH + ${bscPools.length} BSC)`);
    
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
    const status = (error as Error & { statusCode?: number })?.statusCode ?? 500;
    return NextResponse.json(
      { 
        error: 'Failed to fetch tokenized stock pools', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { 
        status,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }
}


