'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TablePool, PoolTableSortState, PoolSortFields } from '@/lib/pools/types';
import { sortPools } from '@/lib/pools/sorting';

export function useTokenizedStockPools(sortState: PoolTableSortState = {
  sortBy: PoolSortFields.TVL,
  sortDirection: 'desc',
}) {
  // Fetch pools from API route - always fetch fresh data
  const { data: allPoolsData, isLoading: poolsLoading, error: poolsError } = useQuery({
    queryKey: ['tokenizedStockPools'],
    queryFn: async () => {
      console.log(`🏊 [Tokenized Stock Pools] Fetching pools from API...`);

      const response = await fetch('/api/cache/tokenized-stock-pools', {
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
      
      console.log(`✅ [Tokenized Stock Pools] Fetched fresh data (${pools.length} pools)`);
      
      return pools;
    },
    staleTime: 0, // Always consider data stale - fetch fresh on every mount
    gcTime: 0, // Don't cache in memory
    refetchOnMount: 'always', // Always refetch when component mounts
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

