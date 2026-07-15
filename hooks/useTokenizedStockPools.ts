'use client';

import { useMemo } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { TablePool, PoolTableSortState, PoolSortFields } from '@/lib/pools/types';
import { sortPools } from '@/lib/pools/sorting';

export function useTokenizedStockPools(sortState: PoolTableSortState = {
  sortBy: PoolSortFields.TVL,
  sortDirection: 'desc',
}) {
  // Fetch pools from API route. The server serves a stale-while-revalidate
  // cache, so keep results in memory here too: show cached pools instantly on
  // remount/navigation while a background refetch updates them.
  const { data: allPoolsData, isLoading: poolsLoading, error: poolsError } = useQuery({
    queryKey: ['tokenizedStockPools'],
    queryFn: async () => {
      console.log(`🏊 [Tokenized Stock Pools] Fetching pools from API...`);

      const response = await fetch('/api/cache/tokenized-stock-pools', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({})) as { error?: string; details?: string };
        const message = response.status === 503 && (data.details || data.error)
          ? (data.details || data.error)
          : `Failed to fetch tokenized stock pools: ${response.statusText}`;
        throw new Error(message);
      }

      const data = await response.json();
      const pools: TablePool[] = data.pools || [];

      console.log(`✅ [Tokenized Stock Pools] Fetched fresh data (${pools.length} pools)`);

      return pools;
    },
    staleTime: 30_000, // Treat data as fresh for 30s (matches server cache window)
    gcTime: 5 * 60_000, // Keep in memory 5min so remounts render instantly
    placeholderData: keepPreviousData, // Show prior pools during background refetch (no blank spinner)
  });

  const allPools = allPoolsData || [];
  const loading = poolsLoading;
  const error = poolsError;

  // Sort the pools using the existing sortPools utility
  const sortedPools = useMemo(() => {
    return sortPools(allPools, sortState);
  }, [allPools, sortState]);

  return {
    pools: sortedPools,
    loading,
    error,
  };
}
