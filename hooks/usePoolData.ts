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

  // Extract date range from poolDayData for historical stock price fetch
  const dateRange = useMemo(() => {
    const dayData = data?.pool?.poolDayData || [];
    if (dayData.length === 0) return null;
    
    // poolDayData is ordered by date descending (most recent first)
    // Find oldest and newest dates
    const dates = dayData.map(day => day.date);
    const oldestDate = Math.min(...dates);
    const newestDate = Math.max(...dates);
    
    return { startDate: oldestDate, endDate: newestDate };
  }, [data?.pool?.poolDayData]);

  // Fetch historical stock prices for the date range if this is a tokenized stock pool
  const { data: stockPriceHistoryData, error: stockPriceHistoryError } = useQuery({
    queryKey: ['stockPriceHistory', stockTicker, dateRange?.startDate, dateRange?.endDate],
    queryFn: async () => {
      if (!stockTicker || !dateRange) return null;

      try {
        const response = await fetch(
          `/api/stock-price-history?ticker=${stockTicker}&startDate=${dateRange.startDate}&endDate=${dateRange.endDate}`
        );
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.warn(`⚠️ [Pool Data] Failed to fetch stock price history for ${stockTicker}: ${response.status} ${response.statusText}`, errorData);
          return null;
        }

        const data = await response.json();
        
        if (!data.prices || !Array.isArray(data.prices) || data.prices.length === 0) {
          console.warn(`⚠️ [Pool Data] Invalid price history data for ${stockTicker}:`, data);
          return null;
        }
        
        // Create a map of date (normalized to start of day) -> price for quick lookup
        const priceMap = new Map<number, number>();
        data.prices.forEach((item: { date: number; price: number }) => {
          // Normalize date to start of day for matching
          const normalizedDate = Math.floor(item.date / 86400) * 86400; // Round to start of day
          priceMap.set(normalizedDate, item.price);
        });
        
        return priceMap;
      } catch (err) {
        console.error(`❌ [Pool Data] Error fetching stock price history for ${stockTicker}:`, err);
        return null;
      }
    },
    enabled: !!stockTicker && isTokenizedStockPool && !!dateRange,
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

    // Calculate 24h fees difference (current day - previous day)
    let feesUSD24HDiff: number | undefined;
    if (dayData.length >= 2) {
      const previousFees = parseFloat(dayData[1].feesUSD || '0');
      const diff = feesUSD24H - previousFees;
      // Only set if the difference is a valid number
      if (!isNaN(diff) && isFinite(diff)) {
        feesUSD24HDiff = diff;
      }
      
      // Log for debugging
      console.log(`📊 [Pool Details ${pool.id}] 24h fees change:`, {
        currentFees: feesUSD24H,
        previousFees,
        diff: feesUSD24HDiff,
        dayDataLength: dayData.length,
      });
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

    // Get current pool price for fallback if historical prices aren't available
    const currentToken0Price = pool.token0Price ? parseFloat(pool.token0Price) : null;
    
    // Extract TVL time-series data (reverse to get chronological order: oldest to newest)
    const tvlHistory: TVLDataPoint[] = [...dayData]
      .reverse() // Reverse to get chronological order (oldest to newest)
      .map((day) => {
        let price = 0;
        
        // For tokenized stocks, use actual stock prices from yahoo-finance2
        if (isTokenizedStockPool && stockPriceHistoryData) {
          // Normalize date to start of day for matching
          const normalizedDate = Math.floor(day.date / 86400) * 86400;
          const stockPrice = stockPriceHistoryData.get(normalizedDate);
          
          if (stockPrice !== undefined && stockPrice !== null && stockPrice > 0) {
            price = stockPrice;
          } else {
            // If no exact match, try to find closest date (for weekends/holidays)
            // Find the closest date in the price map
            let closestPrice: number | null = null;
            let minDiff = Infinity;
            
            stockPriceHistoryData.forEach((p, date) => {
              const diff = Math.abs(date - normalizedDate);
              if (diff < minDiff && date <= normalizedDate) {
                minDiff = diff;
                closestPrice = p;
              }
            });
            
            if (closestPrice !== null && closestPrice > 0) {
              price = closestPrice;
            } else {
              // Fallback to poolDayData.close if stock price not available
              if (day.close) {
                price = parseFloat(day.close);
              } else if (currentToken0Price !== null) {
                price = currentToken0Price;
              }
            }
          }
        } else {
          // For non-tokenized stocks, use poolDayData.close prices (existing behavior)
          if (day.close) {
            price = parseFloat(day.close);
          } else if (currentToken0Price !== null) {
            price = currentToken0Price;
          }
        }
        
        return {
          date: day.date,
          tvlUSD: parseFloat(day.tvlUSD || '0'),
          volumeUSD: parseFloat(day.volumeUSD || '0'),
          price: price,
        };
      })
      .filter((point) => point.tvlUSD > 0); // Filter out zero TVL values
    
    // Log if stock price history fetch failed
    if (isTokenizedStockPool && stockPriceHistoryError) {
      console.warn(`⚠️ [Pool Data] Stock price history fetch failed for ${stockTicker}, using poolDayData.close prices`);
    }

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
    stockPriceHistoryData,
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

