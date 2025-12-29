'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { gql } from '@apollo/client';
import { apolloClient } from '@/lib/graphql/client';
import { PoolData, Token, TVLDataPoint } from '@/lib/pools/types';
import { getTokenLogoUrl } from '@/lib/utils/tokenLogo';
import { isTokenizedStock } from '@/lib/pools/tokenizedStocks';
import { getStockTicker } from '@/lib/utils/stockTicker';

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
      open?: string;
      high?: string;
      low?: string;
      close?: string;
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
        open
        high
        low
        close
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

  // Extract token info to check if it's a tokenized stock
  const token0Address = data?.pool ? data.pool.token0.id.split('-')[0] : null;
  const token1Address = data?.pool ? data.pool.token1.id.split('-')[0] : null;
  const token0Symbol = data?.pool?.token0.symbol || '';
  const token1Symbol = data?.pool?.token1.symbol || '';

  // Check if either token is a tokenized stock
  const isToken0Stock = token0Address ? isTokenizedStock(token0Address) : false;
  const isToken1Stock = token1Address ? isTokenizedStock(token1Address) : false;
  const isTokenizedStockPool = isToken0Stock || isToken1Stock;

  // Determine which token is the stock and get its ticker
  const stockToken = isToken0Stock 
    ? { symbol: token0Symbol, address: token0Address }
    : isToken1Stock 
    ? { symbol: token1Symbol, address: token1Address }
    : null;

  const stockTicker = stockToken ? getStockTicker(stockToken.symbol, stockToken.address || undefined) : null;

  // Fetch actual stock price for today if this is a tokenized stock pool
  const { data: stockPriceData, error: stockPriceError } = useQuery({
    queryKey: ['stockPrice', stockTicker],
    queryFn: async () => {
      if (!stockTicker) return null;

      try {
        const today = new Date().toISOString().split('T')[0];
        const response = await fetch(`/api/stock-price?ticker=${stockTicker}&date=${today}`);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.warn(`⚠️ [Pool Data] Failed to fetch stock price for ${stockTicker}: ${response.status} ${response.statusText}`, errorData);
          return null;
        }

        const data = await response.json();
        
        if (!data.price || typeof data.price !== 'number' || data.price <= 0) {
          console.warn(`⚠️ [Pool Data] Invalid price data for ${stockTicker}:`, data);
          return null;
        }
        
        return data.price as number;
      } catch (err) {
        console.error(`❌ [Pool Data] Error fetching stock price for ${stockTicker}:`, err);
        return null;
      }
    },
    enabled: !!stockTicker && isTokenizedStockPool,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2, // Retry up to 2 times on failure
    retryDelay: 1000, // Wait 1 second between retries
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

    // Get current pool price for fallback if historical prices aren't available
    const currentToken0Price = pool.token0Price ? parseFloat(pool.token0Price) : null;
    
    // Calculate scaling factor for tokenized stocks
    let scalingFactor: number | null = null;
    if (isTokenizedStockPool && stockPriceData !== null && stockPriceData !== undefined && stockPriceData > 0 && dayData.length > 0) {
      // Get the most recent GraphQL price (first item in dayData since it's ordered desc)
      const mostRecentGraphQLPrice = dayData[0].close 
        ? parseFloat(dayData[0].close) 
        : currentToken0Price;
      
      // Validate both prices are valid numbers and positive
      if (mostRecentGraphQLPrice && mostRecentGraphQLPrice > 0 && stockPriceData > 0) {
        scalingFactor = stockPriceData / mostRecentGraphQLPrice;
        
        // Validate scaling factor is reasonable (between 0.1 and 1000 to avoid extreme values)
        if (scalingFactor >= 0.1 && scalingFactor <= 1000) {
          console.log(`📈 [Pool Data] Stock price scaling for ${stockTicker}:`, {
            actualPrice: stockPriceData,
            graphQLPrice: mostRecentGraphQLPrice,
            scalingFactor: scalingFactor.toFixed(4),
          });
        } else {
          console.warn(`⚠️ [Pool Data] Unusual scaling factor for ${stockTicker}: ${scalingFactor.toFixed(4)}. Skipping scaling.`);
          scalingFactor = null;
        }
      } else {
        console.warn(`⚠️ [Pool Data] Invalid prices for scaling ${stockTicker}:`, {
          stockPrice: stockPriceData,
          graphQLPrice: mostRecentGraphQLPrice,
        });
      }
    } else if (isTokenizedStockPool && stockPriceError) {
      console.warn(`⚠️ [Pool Data] Stock price fetch failed for ${stockTicker}, using unscaled prices`);
    }
    
    // Extract TVL time-series data (reverse to get chronological order: oldest to newest)
    const tvlHistory: TVLDataPoint[] = [...dayData]
      .reverse() // Reverse to get chronological order (oldest to newest)
      .map((day) => {
        // Calculate price: use close price from poolDayData if available, otherwise use current pool price
        let price = 0;
        if (day.close) {
          // close is the price of token0 in terms of token1
          price = parseFloat(day.close);
        } else if (currentToken0Price !== null) {
          // Fallback to current pool price if historical close price not available
          price = currentToken0Price;
        }
        
        // Apply scaling factor for tokenized stocks
        if (scalingFactor !== null && scalingFactor > 0 && price > 0) {
          price = price * scalingFactor;
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
    stockPriceData,
    isTokenizedStockPool,
    stockTicker,
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

