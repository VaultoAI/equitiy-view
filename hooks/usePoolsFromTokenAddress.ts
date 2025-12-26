'use client';

import { useQuery } from '@tanstack/react-query';
import { gql } from '@apollo/client';
import { apolloClient } from '@/lib/graphql/client';
import { TablePool } from '@/lib/pools/types';
import { calculate1DVolOverTvl, calculateApr, sortPools } from '@/lib/pools/utils';
import { PoolTableSortState, PoolSortFields } from '@/lib/pools/types';
import { getTokenLogoUrl } from '@/lib/utils/tokenLogo';

const DEFAULT_QUERY_SIZE = 20;
const V2_DEFAULT_FEE_TIER = 3000;
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

export function usePoolsFromTokenAddress({
  tokenAddress,
  sortState,
  chainId = 1,
  isNative = false,
}: {
  tokenAddress: string;
  sortState: PoolTableSortState;
  chainId?: number;
  isNative?: boolean;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['poolsFromToken', tokenAddress, chainId],
    queryFn: async () => {
      if (!tokenAddress) {
        console.log('🔍 [Pools From Token] No token address provided');
        return { pools: [] };
      }

      const normalizedTokenAddress = tokenAddress.toLowerCase();
      console.log(`🔍 [Pools From Token] Fetching pools for token: ${normalizedTokenAddress}`);

      try {
        const { data: response, errors } = await apolloClient.query<PoolResponse>({
          query: TOP_V3_POOLS_QUERY,
          variables: {
            first: DEFAULT_QUERY_SIZE,
            tokenAddress: normalizedTokenAddress,
          },
          errorPolicy: 'all',
        });

        if (errors && errors.length > 0) {
          console.error('❌ [Pools From Token] GraphQL errors:', errors);
          errors.forEach((error) => {
            console.error(`  - ${error.message}`, error.extensions);
          });
        }

        const poolCount = response?.pools?.length || 0;
        console.log(`✅ [Pools From Token] Found ${poolCount} pools for token ${normalizedTokenAddress}`);
        
        if (poolCount > 0) {
          console.log('📋 [Pools From Token] Pool details:');
          response.pools.slice(0, 3).forEach((pool, index) => {
            console.log(`  ${index + 1}. ${pool.token0.symbol}/${pool.token1.symbol}`);
            console.log(`     Pool ID: ${pool.id}`);
            console.log(`     Token0: ${pool.token0.id} (${pool.token0.symbol})`);
            console.log(`     Token1: ${pool.token1.id} (${pool.token1.symbol})`);
            console.log(`     Fee Tier: ${pool.feeTier}`);
            console.log(`     TVL: $${parseFloat(pool.totalValueLockedUSD || '0').toLocaleString()}`);
          });
          if (poolCount > 3) {
            console.log(`  ... and ${poolCount - 3} more pools`);
          }
        } else {
          console.warn(`⚠️ [Pools From Token] No pools found for token ${normalizedTokenAddress}`);
          console.log(`   This could mean:`);
          console.log(`   - The token has no liquidity pools`);
          console.log(`   - The token address might be incorrect`);
          console.log(`   - The subgraph might not have indexed this token yet`);
        }

        return response || { pools: [] };
      } catch (err) {
        console.error('❌ [Pools From Token] Error fetching pools:', err);
        if (err instanceof Error) {
          console.error('   Error message:', err.message);
          console.error('   Error stack:', err.stack);
        }
        return { pools: [] };
      }
    },
    enabled: !!tokenAddress,
    staleTime: 60000,
  });

  const pools: TablePool[] =
    data?.pools?.map((pool) => {
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
        console.log(`📊 [Pool ${pool.id}] 24h data from API:`, {
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
          logoURI: getTokenLogoUrl(token0Address, chainId),
        },
        token1: {
          id: pool.token1.id,
          name: pool.token1.name,
          symbol: pool.token1.symbol,
          decimals: pool.token1.decimals,
          address: token1Address,
          chain: 'ETHEREUM',
          logoURI: getTokenLogoUrl(token1Address, chainId),
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
    }) ?? [];

  const sortedPools = sortPools(pools, sortState);

  return {
    loading: isLoading,
    error,
    pools: sortedPools,
  };
}

