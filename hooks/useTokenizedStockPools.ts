'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TablePool, PoolTableSortState, PoolSortFields } from '@/lib/pools/types';
import { sortPools } from '@/lib/pools/sorting';

export function useTokenizedStockPools(sortState: PoolTableSortState = {
  sortBy: PoolSortFields.TVL,
  sortDirection: 'desc',
}) {
  // Fetch pools from cached API route
  const { data: allPoolsData, isLoading: poolsLoading, error: poolsError } = useQuery({
    queryKey: ['tokenizedStockPools'],
    queryFn: async () => {
      console.log(`🏊 [Tokenized Stock Pools] Fetching pools from cached API...`);

      const response = await fetch('/api/cache/tokenized-stock-pools', {
        method: 'GET',
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
    staleTime: 60 * 60 * 1000, // Cache for 1 hour (matches server cache TTL)
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

