'use client';

import { useQuery } from '@tanstack/react-query';
import { gql } from '@apollo/client';
import { apolloClient } from '@/lib/graphql/client';
import { PoolData, Token } from '@/lib/pools/types';

interface PoolDetailsResponse {
  pool: {
    id: string;
    token0: {
      id: string;
      symbol: string;
      name: string;
      decimals: number;
    };
    token1: {
      id: string;
      symbol: string;
      name: string;
      decimals: number;
    };
    feeTier: number;
    totalValueLockedUSD: string;
    txCount: string;
    poolDayData: Array<{
      date: number;
      volumeUSD: string;
      feesUSD: string;
    }>;
  };
}

const POOL_DETAILS_QUERY = gql`
  query PoolDetails($poolId: ID!) {
    pool(id: $poolId) {
      id
      token0 {
        id
        symbol
        name
        decimals
      }
      token1 {
        id
        symbol
        name
        decimals
      }
      feeTier
      totalValueLockedUSD
      txCount
      poolDayData(
        orderBy: date
        orderDirection: desc
        first: 30
      ) {
        date
        volumeUSD
        feesUSD
      }
    }
  }
`;

export function usePoolData(poolIdOrAddress: string) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['poolData', poolIdOrAddress],
    queryFn: async () => {
      if (!poolIdOrAddress) {
        return { pool: null };
      }

      try {
        const { data: response } = await apolloClient.query<PoolDetailsResponse>({
          query: POOL_DETAILS_QUERY,
          variables: {
            poolId: poolIdOrAddress,
          },
        });

        return response || { pool: null };
      } catch (err) {
        console.error('Error fetching pool data:', err);
        return { pool: null };
      }
    },
    enabled: !!poolIdOrAddress,
    staleTime: 30000,
  });

  if (!data?.pool) {
    return {
      loading: isLoading,
      error,
      data: undefined,
    };
  }

  const pool = data.pool;
  const tvlUSD = parseFloat(pool.totalValueLockedUSD || '0');
  
  // Calculate 24h and 30d volume and fees from poolDayData
  // poolDayData is ordered by date descending (most recent first)
  const dayData = pool.poolDayData || [];
  
  // 24h volume: most recent day's volume (first item in array)
  const volumeUSD24H = dayData.length > 0 
    ? parseFloat(dayData[0].volumeUSD || '0')
    : 0;
  
  // 24h fees: most recent day's fees (first item in array)
  const feesUSD24H = dayData.length > 0
    ? parseFloat(dayData[0].feesUSD || '0')
    : 0;
  
  // Log for debugging
  if (dayData.length > 0) {
    console.log(`📊 [Pool Details ${pool.id}] 24h data from API:`, {
      date: dayData[0].date,
      volumeUSD: dayData[0].volumeUSD,
      feesUSD: dayData[0].feesUSD,
      parsedVolume24H: volumeUSD24H,
      parsedFees24H: feesUSD24H,
    });
  }
  
  // 30d volume: sum of last 30 days (or all available days if less than 30)
  const volumeUSD30D = dayData.reduce((sum, day) => {
    return sum + parseFloat(day.volumeUSD || '0');
  }, 0);
  
  // 30d fees: sum of last 30 days (or all available days if less than 30)
  const feesUSD30D = dayData.reduce((sum, day) => {
    return sum + parseFloat(day.feesUSD || '0');
  }, 0);

  const poolData: PoolData = {
    idOrAddress: pool.id,
    protocolVersion: 'V3',
    token0: {
      id: pool.token0.id,
      name: pool.token0.name,
      symbol: pool.token0.symbol,
      decimals: pool.token0.decimals,
      address: pool.token0.id.split('-')[0],
      chain: 'ETHEREUM',
    },
    token1: {
      id: pool.token1.id,
      name: pool.token1.name,
      symbol: pool.token1.symbol,
      decimals: pool.token1.decimals,
      address: pool.token1.id.split('-')[0],
      chain: 'ETHEREUM',
    },
    tvlUSD,
    volumeUSD24H,
    feesUSD24H,
    volumeUSD30D,
    feesUSD30D,
    feeTier: {
      feeAmount: pool.feeTier,
      tickSpacing: 60,
      isDynamic: false,
    },
    txCount: parseInt(pool.txCount || '0'),
  };

  return {
    loading: isLoading,
    error,
    data: poolData,
  };
}

