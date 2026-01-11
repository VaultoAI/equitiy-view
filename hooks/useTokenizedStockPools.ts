'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { gql } from '@apollo/client';
import { apolloClient } from '@/lib/graphql/client';
import { TablePool, PoolTableSortState, PoolSortFields } from '@/lib/pools/types';
import { calculateApr } from '@/lib/pools/utils';
import { sortPools } from '@/lib/pools/sorting';
import { getTokenLogoUrl } from '@/lib/utils/tokenLogo';

const DEFAULT_QUERY_SIZE = 20;
const DEFAULT_TICK_SPACING = 60;

// USDC identification constants
const USDC_ETHEREUM_ADDRESS = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const USDC_SYMBOL = 'USDC';
const USDC_NAME = 'USD Coin';

/**
 * Checks if a token is USDC by comparing address, symbol, or name
 */
function isUSDC(token: { address: string; symbol: string; name: string }): boolean {
  const address = token.address.toLowerCase();
  const symbol = token.symbol.toUpperCase();
  const name = token.name;
  
  return (
    address === USDC_ETHEREUM_ADDRESS.toLowerCase() ||
    symbol === USDC_SYMBOL ||
    name === USDC_NAME
  );
}

/**
 * Checks if a token is XAUT
 */
function isXAUT(token: { symbol: string }): boolean {
  const symbol = token.symbol.toUpperCase();
  return symbol === 'XAUT';
}

// Tokenized stock addresses that have pools (chainId: 1 only)
// Only includes tokens that actually have liquidity pools
const TOKENIZED_STOCK_ADDRESSES = [
  '0xf3e4872e6a4cf365888d93b6146a2baa7348f1a4', // SLVon - USDC/SLVon
  '0x3632dea96a953c11dac2f00b4a05a32cd1063fae', // CRCLon - CRCLon/USDC
  '0x2d1f7226bd1f780af6b9a49dcc0ae00e8df4bdee', // NVDAon - NVDAon/USDC
  '0xf6b1117ec07684d3958cad8beb1b302bfd21103f', // TSLAon - USDC/TSLAon
  '0xfedc5f4a6c38211c1338aa411018dfaf26612c08', // SPYon - USDC/SPYon
  '0x0e397938c1aa0680954093495b70a9f5e2249aba', // QQQon - QQQon/USDC
  '0xba47214edd2bb43099611b208f75e4b42fdcfedc', // GOOGLon - USDC/GOOGLon
  '0x41765f0fcddc276309195166c7a62ae522fa09ef', // BABAon - BABAon/USDC
  '0x992651bfeb9a0dcc4457610e284ba66d86489d4d', // TLTon - TLTon/USDC
  '0x14c3abf95cb9c93a8b82c1cdcb76d72cb87b2d4c', // AAPLon - AAPLon/USDC
  '0xf042cfa86cf1d598a75bdb55c3507a1f39f9493b', // COINon - USDC/COINon
  '0x998f02a9e343ef6e3e6f28700d5a20f839fd74e6', // HOODon - HOODon/USDC
  '0xb812837b81a3a6b81d7cd74cfb19a7f2784555e5', // MSFTon - USDC/MSFTon
  '0xcabd955322dfbf94c084929ac5e9eca3feb5556f', // MSTRon - USDC/MSTRon
  '0xd8e26fcc879b30cb0a0b543925a2b3500f074d81', // NKEon - USDC/NKEon
  '0xbc843b147db4c7e00721d76037b8b92e13afe13f', // SPGIon - USDC/SPGIon
].map(addr => addr.toLowerCase());

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

export function useTokenizedStockPools(sortState: PoolTableSortState = {
  sortBy: PoolSortFields.TVL,
  sortDirection: 'desc',
}) {
  // Fetch pools for all tokenized stock tokens in parallel
  const { data: allPoolsData, isLoading: poolsLoading, error: poolsError } = useQuery({
    queryKey: ['tokenizedStockPools', TOKENIZED_STOCK_ADDRESSES],
    queryFn: async () => {
      if (TOKENIZED_STOCK_ADDRESSES.length === 0) {
        return [];
      }

      console.log(`🏊 [Tokenized Stock Pools] Fetching pools for ${TOKENIZED_STOCK_ADDRESSES.length} tokenized stocks...`);

      // Fetch pools for all tokens in parallel
      const poolPromises = TOKENIZED_STOCK_ADDRESSES.map(async (tokenAddress) => {
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
            console.error(`❌ [Tokenized Stock Pools] GraphQL errors for token ${tokenAddress}:`, errors);
          }

          const poolCount = response?.pools?.length || 0;
          if (poolCount > 0) {
            console.log(`✅ [Tokenized Stock Pools] Found ${poolCount} pools for token ${tokenAddress}`);
          }

          // Convert to TablePool format and get the highest TVL pool
          const pools: TablePool[] = (response?.pools || [])
            .map((pool) => {
              const tvl = parseFloat(pool.totalValueLockedUSD || '0');
              
              // Calculate 24h and 30d volumes and fees from poolDayData
              const dayData = pool.poolDayData || [];
              
              // 24h volume: most recent day's volume (first item in array)
              const volume24h = dayData.length > 0 
                ? parseFloat(dayData[0].volumeUSD || '0')
                : 0;
              
              // 24h fees: most recent day's fees (first item in array)
              const fees24h = dayData.length > 0
                ? parseFloat(dayData[0].feesUSD || '0')
                : 0;
              
              // 30d volume: sum of last 30 days
              const volume30d = dayData.reduce((sum, day) => {
                return sum + parseFloat(day.volumeUSD || '0');
              }, 0);
              
              // 30d fees: sum of last 30 days
              const fees30d = dayData.reduce((sum, day) => {
                return sum + parseFloat(day.feesUSD || '0');
              }, 0);

              // Calculate 24h fees difference (current day - previous day)
              let fees24HDiff: number | undefined;
              if (dayData.length >= 2) {
                const previousFees = parseFloat(dayData[1].feesUSD || '0');
                const diff = fees24h - previousFees;
                // Only set if the difference is a valid number
                if (!isNaN(diff) && isFinite(diff)) {
                  fees24HDiff = diff;
                }
              }

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
                volOverTvl: undefined,
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
                fees24HDiff,
              } as TablePool;
            })
            // Filter to only include pools with TVL > 0, that involve USDC, and exclude XAUT pools
            .filter((pool) => {
              const hasUSDC = isUSDC(pool.token0) || isUSDC(pool.token1);
              const hasXAUT = isXAUT(pool.token0) || isXAUT(pool.token1);
              return pool.tvl > 0 && hasUSDC && !hasXAUT;
            });

          // Return the pool with the highest TVL for this token, or null if no valid pools
          return pools.length > 0 ? pools[0] : null;
        } catch (err) {
          console.error(`❌ [Tokenized Stock Pools] Error fetching pools for token ${tokenAddress}:`, err);
          return null;
        }
      });

      const pools = await Promise.all(poolPromises);
      const validPools = pools.filter((pool): pool is TablePool => pool !== null);
      
      console.log(`✅ [Tokenized Stock Pools] Successfully fetched pools for ${validPools.length} out of ${TOKENIZED_STOCK_ADDRESSES.length} tokenized stocks`);
      
      return validPools;
    },
    enabled: TOKENIZED_STOCK_ADDRESSES.length > 0,
    staleTime: 60 * 60 * 1000, // Cache for 1 hour
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
