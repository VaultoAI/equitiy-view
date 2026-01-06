'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TablePool, PoolTableSortState, PoolSortFields } from '@/lib/pools/types';
import { sortPools } from '@/lib/pools/sorting';

export function useTokenizedStockPools(sortState: PoolTableSortState = {
  sortBy: PoolSortFields.TVL,
  sortDirection: 'desc',
}) {
  // Fetch pools from API route, forcing fresh data for ETH page loads.
  const { data: allPoolsData, isLoading: poolsLoading, error: poolsError } = useQuery({
    queryKey: ['tokenizedStockPools'],
    queryFn: async () => {
      console.log(`🏊 [Tokenized Stock Pools] Fetching pools from cached API...`);

      // Cache-bust URL + explicit no-store to avoid any intermediary/browser caching.
      const url = `/api/cache/tokenized-stock-pools?fresh=1&t=${Date.now()}`;
      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch tokenized stock pools: ${response.statusText}`);
      }

      const data = await response.json();
      const pools: TablePool[] = data.pools || [];
      
      if (data.cached) {
        console.log(`✅ [Tokenized Stock Pools] Using cached data (${pools.length} pools)`);
      } else {
        console.log(`✅ [Tokenized Stock Pools] Fetched fresh data (${pools.length} pools)`);
      }
      
      return pools;
    },
    // Always refetch when the page/hook mounts so users don't see stale pools.
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
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

