'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { gql } from '@apollo/client';
import { apolloClient } from '@/lib/graphql/client';
import { PoolData, Token, TVLDataPoint } from '@/lib/pools/types';
import { getTokenLogoUrl } from '@/lib/utils/tokenLogo';
import { calculate24hMetrics } from '@/lib/pools/utils';

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
    token0Price?: string;
    token1Price?: string;
    poolDayData: Array<{
      date: number;
      volumeUSD: string;
      feesUSD: string;
      tvlUSD: string;
      token0Price?: string;
      token1Price?: string;
      open?: string;
      high?: string;
      low?: string;
      close?: string;
    }>;
    poolHourData?: Array<{
      periodStartUnix: number;
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
      token0Price
      token1Price
      poolDayData(
        orderBy: date
        orderDirection: desc
        first: 30
      ) {
        date
        volumeUSD
        feesUSD
        tvlUSD
        token0Price
        token1Price
        open
        high
        low
        close
      }
      poolHourData(
        orderBy: periodStartUnix
        orderDirection: desc
        first: 49
      ) {
        periodStartUnix
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
          fetchPolicy: 'network-only',
        });

        return response || { pool: null };
      } catch (err) {
        console.error('Error fetching pool data:', err);
        return { pool: null };
      }
    },
    enabled: !!poolIdOrAddress,
    staleTime: 0, // Always consider data stale - fetch fresh data
    gcTime: 0, // Don't cache in memory
    refetchOnMount: 'always', // Always refetch when component mounts
  });

  // No longer fetching external stock price data - using pool data instead

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
    
    // Calculate true rolling 24h volume and fees from hourly data if available
    let volumeUSD24H: number;
    let feesUSD24H: number;
    let feesUSD24HDiff: number | undefined;
    let calculationMethod: 'hourly' | 'daily';

    if (pool.poolHourData && pool.poolHourData.length > 0) {
      // Use hourly data for accurate rolling 24h calculation
      const metrics = calculate24hMetrics(pool.poolHourData);
      volumeUSD24H = metrics.volume24h;
      feesUSD24H = metrics.fees24h;
      feesUSD24HDiff = metrics.fees24hDiff;
      calculationMethod = 'hourly';
    } else {
      // Fallback to daily data (current day)
      volumeUSD24H = dayData.length > 0 
        ? parseFloat(dayData[0].volumeUSD || '0')
        : 0;
      feesUSD24H = dayData.length > 0
        ? parseFloat(dayData[0].feesUSD || '0')
        : 0;
      
      // Calculate fees diff using daily data as fallback
      if (dayData.length >= 2) {
        const previousFees = parseFloat(dayData[1].feesUSD || '0');
        const diff = feesUSD24H - previousFees;
        if (!isNaN(diff) && isFinite(diff)) {
          feesUSD24HDiff = diff;
        }
      }
      
      calculationMethod = 'daily';
    }
    
    // Log for debugging
    console.log(`📊 [Pool Details ${pool.id}] 24h data calculation:`, {
      method: calculationMethod,
      volumeUSD24H,
      feesUSD24H,
      feesUSD24HDiff,
      hourlyDataPoints: pool.poolHourData?.length || 0,
      dailyDataPoints: dayData.length,
    });
    
    // 30d volume: sum of last 30 days (or all available days if less than 30)
    const volumeUSD30D = dayData.reduce((sum, day) => {
      return sum + parseFloat(day.volumeUSD || '0');
    }, 0);
    
    // 30d fees: sum of last 30 days (or all available days if less than 30)
    const feesUSD30D = dayData.reduce((sum, day) => {
      return sum + parseFloat(day.feesUSD || '0');
    }, 0);

    // Calculate TVL 24h percentage change
    // Compare most recent day's TVL with previous day's TVL (24h ago)
    let tvlUSD24HChange: number | undefined;
    if (dayData.length >= 2) {
      const currentDayTvl = parseFloat(dayData[0].tvlUSD || '0');
      const previousDayTvl = parseFloat(dayData[1].tvlUSD || '0');
      if (previousDayTvl > 0 && currentDayTvl > 0) {
        const change = ((currentDayTvl - previousDayTvl) / previousDayTvl) * 100;
        // Only include if there's a meaningful change (|change| > 0.001%)
        // Lowered threshold to show more changes
        if (Math.abs(change) > 0.001 && !isNaN(change) && isFinite(change)) {
          tvlUSD24HChange = change;
        }
      }
    }

    
    // Log TVL change for debugging
    if (dayData.length >= 2) {
      const currentDayTvl = parseFloat(dayData[0].tvlUSD || '0');
      const previousDayTvl = parseFloat(dayData[1].tvlUSD || '0');
      console.log(`📊 [Pool Details ${pool.id}] 24h TVL change:`, {
        currentTvl: tvlUSD,
        currentDayTvl,
        previousDayTvl,
        change: tvlUSD24HChange,
        dayDataLength: dayData.length,
        dayData0Date: dayData[0]?.date,
        dayData1Date: dayData[1]?.date,
      });
    } else {
      console.log(`📊 [Pool Details ${pool.id}] Not enough day data for 24h changes:`, {
        dayDataLength: dayData.length,
      });
    }

    // Determine which token is USDC (or a stablecoin) to calculate price correctly
    // USDC addresses: 0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48 (Ethereum mainnet)
    const USDC_ADDRESS = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
    const USDT_ADDRESS = '0xdac17f958d2ee523a2206206994597c13d831ec7';
    const DAI_ADDRESS = '0x6b175474e89094c44da98b954eedeac495271d0f';
    
    const poolToken0Address = pool.token0.id.split('-')[0].toLowerCase();
    const poolToken1Address = pool.token1.id.split('-')[0].toLowerCase();
    
    const isToken0Stablecoin = [USDC_ADDRESS, USDT_ADDRESS, DAI_ADDRESS].includes(poolToken0Address);
    const isToken1Stablecoin = [USDC_ADDRESS, USDT_ADDRESS, DAI_ADDRESS].includes(poolToken1Address);
    
    // Extract TVL time-series data (reverse to get chronological order: oldest to newest)
    const tvlHistory: TVLDataPoint[] = [...dayData]
      .reverse() // Reverse to get chronological order (oldest to newest)
      .map((day) => {
        let price = 0;
        
        // Calculate price from pool data
        // token0Price = price of token0 in terms of token1
        // token1Price = price of token1 in terms of token0
        // We want the price of the non-stablecoin token in USD
        
        if (day.token0Price && day.token1Price) {
          const token0Price = parseFloat(day.token0Price);
          const token1Price = parseFloat(day.token1Price);
          
          if (isToken1Stablecoin && token1Price > 0) {
            // If token1 is USDC, use token1Price to get USDC per asset
            price = token1Price;
          } else if (isToken0Stablecoin && token0Price > 0) {
            // If token0 is USDC, use token0Price to get USDC per asset
            price = token0Price;
          } else if (token0Price > 0) {
            // Neither is a stablecoin, use token0Price as the price
            price = token0Price;
          }
        }
        
        // Fallback to close price if token prices not available
        if (price === 0 && day.close) {
          price = parseFloat(day.close);
        }
        
        return {
          date: day.date,
          tvlUSD: parseFloat(day.tvlUSD || '0'),
          volumeUSD: parseFloat(day.volumeUSD || '0'),
          price: price,
        };
      })
      .filter((point) => point.tvlUSD > 0); // Filter out zero TVL values

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
      tvlUSD24HChange,
      feesUSD24HDiff,
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
    data?.pool?.poolHourData,
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

