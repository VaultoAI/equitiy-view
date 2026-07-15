import { NextRequest, NextResponse } from 'next/server';
import { fetchTokenizedStockPools, fetchBscTokenizedStockPools } from '@/lib/cache/poolFetchers';
import {
  getCachedDataIgnoringValidity,
  getCacheAge,
  setCachedData,
} from '@/lib/cache/serverCache';
import { TablePool } from '@/lib/pools/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CACHE_KEY = 'tokenized-stock-pools';
// Serve cached data without refetching within this window. Beyond it, the
// cached copy is served immediately while a fresh copy is fetched in the
// background (stale-while-revalidate), so page loads stay instant and the
// expensive Uniswap subgraph query runs at most once per window.
const FRESH_TTL_MS = 30_000;

// Dedupe concurrent background refreshes across requests on a warm instance.
let revalidating = false;

/**
 * Fetches the full pool set: Ethereum (Uniswap subgraph, authoritative) plus
 * BSC (vendored GeckoTerminal snapshot, additive/best-effort). A BSC failure
 * never breaks the page.
 */
async function buildPools(): Promise<TablePool[]> {
  const [ethPools, bscPools] = await Promise.all([
    fetchTokenizedStockPools(),
    fetchBscTokenizedStockPools().catch((err) => {
      console.warn('⚠️ [Tokenized Stock Pools API] BSC fetch failed, returning Ethereum pools only:', err);
      return [] as TablePool[];
    }),
  ]);
  const pools = [...ethPools, ...bscPools];
  console.log(`✅ [Tokenized Stock Pools API] Built ${pools.length} pools (${ethPools.length} ETH + ${bscPools.length} BSC)`);
  return pools;
}

/** Refresh the cache in the background; never throws, keeps last-good on error. */
function revalidateInBackground(): void {
  if (revalidating) return;
  revalidating = true;
  buildPools()
    .then((pools) => setCachedData(CACHE_KEY, pools))
    .catch((err) => console.warn('⚠️ [Tokenized Stock Pools API] Background revalidate failed, keeping last-good:', err))
    .finally(() => {
      revalidating = false;
    });
}

function jsonPools(pools: TablePool[], cacheState: 'HIT' | 'STALE' | 'MISS') {
  return NextResponse.json(
    { pools },
    {
      headers: {
        'Cache-Control': 'no-store',
        'X-Cache': cacheState,
      },
    }
  );
}

export async function GET(_request: NextRequest) {
  const cached = getCachedDataIgnoringValidity<TablePool[]>(CACHE_KEY);
  const age = getCacheAge(CACHE_KEY);

  // Fresh cache → serve instantly, no network.
  if (cached && age !== null && age < FRESH_TTL_MS) {
    return jsonPools(cached, 'HIT');
  }

  // Stale cache → serve immediately, refresh in background (stale-while-revalidate).
  if (cached) {
    revalidateInBackground();
    return jsonPools(cached, 'STALE');
  }

  // Cold: no cached data yet — must fetch and wait.
  try {
    console.log('🔄 [Tokenized Stock Pools API] Cold cache, fetching fresh data...');
    const pools = await buildPools();
    setCachedData(CACHE_KEY, pools);
    return jsonPools(pools, 'MISS');
  } catch (error) {
    console.error('❌ [Tokenized Stock Pools API] Error:', error);
    const status = (error as Error & { statusCode?: number })?.statusCode ?? 500;
    return NextResponse.json(
      {
        error: 'Failed to fetch tokenized stock pools',
        details: error instanceof Error ? error.message : 'Unknown error',
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
