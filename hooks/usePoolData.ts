'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { gql } from '@apollo/client';
import { apolloClient } from '@/lib/graphql/client';
import { PoolData, Token, TVLDataPoint } from '@/lib/pools/types';
import { getTokenLogoUrl } from '@/lib/utils/tokenLogo';

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
      tvlUSD: string;
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
        tvlUSD
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

  // Memoize poolData - must be called before any early returns to follow Rules of Hooks
  const poolData = useMemo<PoolData | undefined>(() => {
    if (!data?.pool) {
      return undefined;
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

    // Extract TVL time-series data (reverse to get chronological order: oldest to newest)
    const tvlHistory: TVLDataPoint[] = [...dayData]
      .reverse() // Reverse to get chronological order (oldest to newest)
      .map((day) => ({
        date: day.date,
        tvlUSD: parseFloat(day.tvlUSD || '0'),
      }))
      .filter((point) => point.tvlUSD > 0); // Filter out zero values

    // Memoize token objects to prevent new references on every render
    const token0Address = pool.token0.id.split('-')[0];
    const token1Address = pool.token1.id.split('-')[0];

    const token0: Token = {
      id: pool.token0.id,
      name: pool.token0.name,
      symbol: pool.token0.symbol,
      decimals: pool.token0.decimals,
      address: token0Address,
      chain: 'ETHEREUM',
      logoURI: getTokenLogoUrl(token0Address, 1),
    };

    const token1: Token = {
      id: pool.token1.id,
      name: pool.token1.name,
      symbol: pool.token1.symbol,
      decimals: pool.token1.decimals,
      address: token1Address,
      chain: 'ETHEREUM',
      logoURI: getTokenLogoUrl(token1Address, 1),
    };

    return {
      idOrAddress: pool.id,
      protocolVersion: 'V3',
      token0,
      token1,
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
      tvlHistory,
    };
  }, [
    data?.pool?.id,
    data?.pool?.token0?.id,
    data?.pool?.token0?.name,
    data?.pool?.token0?.symbol,
    data?.pool?.token0?.decimals,
    data?.pool?.token1?.id,
    data?.pool?.token1?.name,
    data?.pool?.token1?.symbol,
    data?.pool?.token1?.decimals,
    data?.pool?.feeTier,
    data?.pool?.totalValueLockedUSD,
    data?.pool?.txCount,
    data?.pool?.poolDayData,
  ]);

  if (!poolData) {
    return {
      loading: isLoading,
      error,
      data: undefined,
    };
  }

  return {
    loading: isLoading,
    error,
    data: poolData,
  };
}

