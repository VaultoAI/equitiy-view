'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { gql } from '@apollo/client';
import { apolloClient } from '@/lib/graphql/client';
import { useTokenBalances } from './useTokenBalances';
import { TablePool, PoolTableSortState, PoolSortFields } from '@/lib/pools/types';
import { isTokenizedStock } from '@/lib/pools/tokenizedStocks';
import { calculate1DVolOverTvl, calculateApr } from '@/lib/pools/utils';
import { getTokenLogoUrl } from '@/lib/utils/tokenLogo';

const DEFAULT_QUERY_SIZE = 20;
const DEFAULT_TICK_SPACING = 60;

interface PoolResponse {
  pools: Array<{
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
  }>;
}

const TOP_V3_POOLS_QUERY = gql`
  query TopV3Pools($first: Int!, $tokenAddress: String!) {
    pools(
      first: $first
      where: {
        or: [
          { token0_: { id: $tokenAddress } }
          { token1_: { id: $tokenAddress } }
        ]
      }
      orderBy: totalValueLockedUSD
      orderDirection: desc
    ) {
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

export function useWalletPools(sortState: PoolTableSortState = {
  sortBy: PoolSortFields.TVL,
  sortDirection: 'desc',
}) {
  const { balanceList, loading: balancesLoading } = useTokenBalances();

  // Get unique token addresses from wallet balances
  const tokenAddresses = useMemo(() => {
    const addresses = new Set<string>();
    balanceList.forEach((balance) => {
      const address = balance.currencyInfo.currency.address;
      if (address) {
        addresses.add(address.toLowerCase());
      }
    });
    const addressArray = Array.from(addresses);
    console.log(`🔍 [Wallet Pools] Extracted ${addressArray.length} unique token addresses from wallet`);
    if (addressArray.length > 0) {
      console.log('📝 [Wallet Pools] Token addresses:', addressArray);
    }
    return addressArray;
  }, [balanceList]);

  // Fetch pools for all tokens in parallel
  const { data: allPoolsData, isLoading: poolsLoading, error: poolsError } = useQuery({
    queryKey: ['walletPools', tokenAddresses],
    queryFn: async () => {
      if (tokenAddresses.length === 0) {
        return [];
      }

      console.log(`🏊 [Wallet Pools] Fetching pools for ${tokenAddresses.length} tokens...`);

      // Fetch pools for all tokens in parallel
      const poolPromises = tokenAddresses.map(async (tokenAddress) => {
        try {
          const { data: response, errors } = await apolloClient.query<PoolResponse>({
            query: TOP_V3_POOLS_QUERY,
            variables: {
              first: DEFAULT_QUERY_SIZE,
              tokenAddress: tokenAddress.toLowerCase(),
            },
            errorPolicy: 'all',
          });

          if (errors && errors.length > 0) {
            console.error(`❌ [Wallet Pools] GraphQL errors for token ${tokenAddress}:`, errors);
          }

          const poolCount = response?.pools?.length || 0;
          if (poolCount > 0) {
            console.log(`✅ [Wallet Pools] Found ${poolCount} pools for token ${tokenAddress}`);
          }

          // Convert to TablePool format and get the highest TVL pool
          const pools: TablePool[] = (response?.pools || []).map((pool) => {
            const tvl = parseFloat(pool.totalValueLockedUSD || '0');
            
            // Calculate 24h and 30d volumes and fees from poolDayData
            // poolDayData is ordered by date descending (most recent first)
            const dayData = pool.poolDayData || [];
            
            // 24h volume: most recent day's volume (first item in array)
            const volume24h = dayData.length > 0 
              ? parseFloat(dayData[0].volumeUSD || '0')
              : 0;
            
            // 24h fees: most recent day's fees (first item in array)
            const fees24h = dayData.length > 0
              ? parseFloat(dayData[0].feesUSD || '0')
              : 0;
            
            // Log for debugging
            if (dayData.length > 0) {
              console.log(`📊 [Wallet Pool ${pool.id}] 24h data from API:`, {
                date: dayData[0].date,
                volumeUSD: dayData[0].volumeUSD,
                feesUSD: dayData[0].feesUSD,
                parsedVolume24h: volume24h,
                parsedFees24h: fees24h,
              });
            }
            
            // 30d volume: sum of last 30 days (or all available days if less than 30)
            const volume30d = dayData.reduce((sum, day) => {
              return sum + parseFloat(day.volumeUSD || '0');
            }, 0);
            
            // 30d fees: sum of last 30 days (or all available days if less than 30)
            const fees30d = dayData.reduce((sum, day) => {
              return sum + parseFloat(day.feesUSD || '0');
            }, 0);

            const token0Address = pool.token0.id.split('-')[0];
            const token1Address = pool.token1.id.split('-')[0];

            return {
              hash: pool.id,
              token0: {
                id: pool.token0.id,
                name: pool.token0.name,
                symbol: pool.token0.symbol,
                decimals: pool.token0.decimals,
                address: token0Address,
                chain: 'ETHEREUM',
                logoURI: getTokenLogoUrl(token0Address, 1),
              },
              token1: {
                id: pool.token1.id,
                name: pool.token1.name,
                symbol: pool.token1.symbol,
                decimals: pool.token1.decimals,
                address: token1Address,
                chain: 'ETHEREUM',
                logoURI: getTokenLogoUrl(token1Address, 1),
              },
              tvl,
              volume24h,
              volume30d,
              fees24h,
              fees30d,
              volOverTvl: undefined, // Not used anymore
              apr: calculateApr({
                fees30d,
                tvl,
              }),
              feeTier: {
                feeAmount: pool.feeTier,
                tickSpacing: DEFAULT_TICK_SPACING,
                isDynamic: false,
              },
              protocolVersion: 'V3',
            } as TablePool;
          });

          // Return the pool with the highest TVL for this token
          return pools.length > 0 ? pools[0] : null;
        } catch (err) {
          console.error(`❌ [Wallet Pools] Error fetching pools for token ${tokenAddress}:`, err);
          return null;
        }
      });

      const pools = await Promise.all(poolPromises);
      const validPools = pools.filter((pool): pool is TablePool => pool !== null);
      
      console.log(`✅ [Wallet Pools] Successfully fetched pools for ${validPools.length} out of ${tokenAddresses.length} tokens`);
      
      return validPools;
    },
    enabled: tokenAddresses.length > 0,
    staleTime: 24 * 60 * 60 * 1000, // Cache for 24 hours (aligns with token cache)
  });

  const allPools = allPoolsData || [];
  const loading = balancesLoading || poolsLoading;
  const error = poolsError;

  // Pools are already filtered to one per token (highest TVL), so we can use them directly
  const filteredPools = allPools;

  // Sort the filtered pools, prioritizing tokenized stock pools
  const sortedPools = useMemo(() => {
    // Helper function to check if a pool contains a tokenized stock
    const poolContainsTokenizedStock = (pool: TablePool): boolean => {
      return isTokenizedStock(pool.token0.address) || isTokenizedStock(pool.token1.address);
    };

    // Helper function to sort pools by the current sort criteria
    const sortPoolsByCriteria = (pools: TablePool[]): TablePool[] => {
      return [...pools].sort((a, b) => {
        switch (sortState.sortBy) {
          case PoolSortFields.TVL:
            return sortState.sortDirection === 'desc' ? b.tvl - a.tvl : a.tvl - b.tvl;
          case PoolSortFields.Apr:
            return sortState.sortDirection === 'desc'
              ? (b.apr.greaterThan(a.apr) ? 1 : -1)
              : (a.apr.greaterThan(b.apr) ? 1 : -1);
          case PoolSortFields.FeeTier:
            const feeTierA = a.feeTier?.feeAmount ?? 0;
            const feeTierB = b.feeTier?.feeAmount ?? 0;
            return sortState.sortDirection === 'desc'
              ? feeTierB - feeTierA
              : feeTierA - feeTierB;
          case PoolSortFields.Fees24h:
            const fees24hA = a.fees24h ?? 0;
            const fees24hB = b.fees24h ?? 0;
            return sortState.sortDirection === 'desc'
              ? fees24hB - fees24hA
              : fees24hA - fees24hB;
          case PoolSortFields.Volume24h:
            return sortState.sortDirection === 'desc'
              ? b.volume24h - a.volume24h
              : a.volume24h - b.volume24h;
          case PoolSortFields.Volume30D:
            return sortState.sortDirection === 'desc'
              ? b.volume30d - a.volume30d
              : a.volume30d - b.volume30d;
          default:
            return sortState.sortDirection === 'desc' ? b.tvl - a.tvl : a.tvl - b.tvl;
        }
      });
    };

    // Split pools into tokenized stock pools and regular pools
    const tokenizedStockPools: TablePool[] = [];
    const regularPools: TablePool[] = [];

    filteredPools.forEach((pool) => {
      if (poolContainsTokenizedStock(pool)) {
        tokenizedStockPools.push(pool);
      } else {
        regularPools.push(pool);
      }
    });

    // Sort each group separately
    const sortedTokenizedStockPools = sortPoolsByCriteria(tokenizedStockPools);
    const sortedRegularPools = sortPoolsByCriteria(regularPools);

    // Concatenate with tokenized stock pools first
    const sorted = [...sortedTokenizedStockPools, ...sortedRegularPools];
    
    if (sorted.length > 0) {
      console.log(`📊 [Wallet Pools] Displaying ${sorted.length} pools sorted by ${sortState.sortBy} (${sortState.sortDirection})`);
      console.log(`📈 [Wallet Pools] Tokenized stock pools: ${sortedTokenizedStockPools.length}, Regular pools: ${sortedRegularPools.length}`);
      console.log('🏊 [Wallet Pools] Pool list:');
      sorted.slice(0, 5).forEach((pool, index) => {
        const isTokenized = poolContainsTokenizedStock(pool);
        console.log(`  ${index + 1}. ${pool.token0.symbol}/${pool.token1.symbol}${isTokenized ? ' (Tokenized Stock)' : ''}`);
        console.log(`     TVL: $${pool.tvl.toLocaleString()}`);
        console.log(`     APR: ${pool.apr.toSignificant(2)}%`);
        console.log(`     Volume 24h: $${pool.volume24h.toLocaleString()}`);
        console.log(`     Volume 30d: $${pool.volume30d.toLocaleString()}`);
      });
      if (sorted.length > 5) {
        console.log(`  ... and ${sorted.length - 5} more pools`);
      }
    }
    
    return sorted;
  }, [filteredPools, sortState]);

  return {
    pools: sortedPools,
    loading,
    error,
  };
}

