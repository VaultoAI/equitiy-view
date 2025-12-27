'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TablePool, PoolTableSortState, PoolSortFields } from '@/lib/pools/types';
import { calculateApr } from '@/lib/pools/utils';
import { sortPools } from '@/lib/pools/utils';
import { getSolanaTokenLogoUrl, getSolanaTokenName, getTrackedSolanaTokenMints, isTrackedSolanaToken } from '@/lib/utils/solanaTokenLogo';

const METEORA_API_URL = '/api/meteora';

// Common Solana token addresses
const SOLANA_COMMON_TOKENS: Record<string, { symbol: string; name: string; decimals: number }> = {
  'So11111111111111111111111111111111111111112': { symbol: 'SOL', name: 'Solana', decimals: 9 },
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': { symbol: 'USDC', name: 'USD Coin', decimals: 6 },
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': { symbol: 'USDT', name: 'Tether', decimals: 6 },
};

// Tracked Solana token addresses
const TRACKED_SOLANA_TOKEN_MINTS = getTrackedSolanaTokenMints();

interface MeteoraPoolResponse {
  address: string;
  name: string;
  mint_x: string;
  mint_y: string;
  liquidity: string;
  trade_volume_24h: number;
  fees_24h: number;
  base_fee_percentage: string;
}

/**
 * Parses token symbol and name from pool name (e.g., "ANDURIL/USDC" -> ["ANDURIL", "USDC"])
 */
function parseTokenInfoFromPoolName(poolName: string, mintAddress: string): { symbol: string; name: string; decimals: number } {
  // Check if it's a tracked token
  const trackedName = getSolanaTokenName(mintAddress);
  if (trackedName) {
    // For tracked tokens, use known name and symbol
    // Default decimals to 9 for Solana tokens (can be updated if we have specific data)
    return { symbol: trackedName, name: trackedName, decimals: 9 };
  }

  // Check if it's a common token
  if (mintAddress in SOLANA_COMMON_TOKENS) {
    return SOLANA_COMMON_TOKENS[mintAddress];
  }

  // Try to parse from pool name (format: "TOKEN1/TOKEN2")
  const parts = poolName.split('/');
  if (parts.length >= 2) {
    // Determine which token this is based on position
    // This is approximate - we'll use the first part for mint_x, second for mint_y typically
    const symbol = parts[0]?.trim() || 'UNKNOWN';
    return { symbol, name: symbol, decimals: 9 };
  }

  // Fallback
  return { symbol: 'UNKNOWN', name: 'Unknown Token', decimals: 9 };
}

/**
 * Determines which token is which from pool name and mint addresses
 */
function determineTokens(
  pool: MeteoraPoolResponse
): { token0: { symbol: string; name: string; decimals: number; mint: string }; token1: { symbol: string; name: string; decimals: number; mint: string } } {
  // Get token info for mint_x
  const token0Name = getSolanaTokenName(pool.mint_x);
  const token0Info = token0Name
    ? { symbol: token0Name, name: token0Name, decimals: 9 }
    : pool.mint_x in SOLANA_COMMON_TOKENS
    ? SOLANA_COMMON_TOKENS[pool.mint_x]
    : parseTokenInfoFromPoolName(pool.name || '', pool.mint_x);

  // Get token info for mint_y
  const token1Name = getSolanaTokenName(pool.mint_y);
  const token1Info = token1Name
    ? { symbol: token1Name, name: token1Name, decimals: 9 }
    : pool.mint_y in SOLANA_COMMON_TOKENS
    ? SOLANA_COMMON_TOKENS[pool.mint_y]
    : parseTokenInfoFromPoolName(pool.name || '', pool.mint_y);

  // If we still don't have good info, try parsing from pool name
  if (token0Info.symbol === 'UNKNOWN' || token1Info.symbol === 'UNKNOWN') {
    const poolName = pool.name || '';
    const parts = poolName.split('/');
    if (parts.length >= 2) {
      if (token0Info.symbol === 'UNKNOWN') {
        token0Info.symbol = parts[0]?.trim() || 'TOKEN0';
        token0Info.name = token0Info.symbol;
      }
      if (token1Info.symbol === 'UNKNOWN') {
        token1Info.symbol = parts[1]?.trim() || 'TOKEN1';
        token1Info.name = token1Info.symbol;
      }
    }
  }

  return {
    token0: {
      ...token0Info,
      mint: pool.mint_x,
    },
    token1: {
      ...token1Info,
      mint: pool.mint_y,
    },
  };
}

/**
 * Converts fee percentage string to basis points
 */
function feePercentageToBasisPoints(feePercentage: string): number {
  try {
    const fee = parseFloat(feePercentage);
    if (isNaN(fee)) return 0;
    // Convert percentage (e.g., 0.01 for 0.01%) to basis points (e.g., 1)
    return Math.round(fee * 100);
  } catch {
    return 0;
  }
}

export function useSolanaPools(sortState: PoolTableSortState = {
  sortBy: PoolSortFields.TVL,
  sortDirection: 'desc',
}) {
  const { data: allPoolsData, isLoading: poolsLoading, error: poolsError } = useQuery({
    queryKey: ['solanaPools', TRACKED_SOLANA_TOKEN_MINTS],
    queryFn: async () => {
      if (TRACKED_SOLANA_TOKEN_MINTS.length === 0) {
        return [];
      }

      console.log(`🏊 [Solana Pools] Fetching pools from Meteora API for ${TRACKED_SOLANA_TOKEN_MINTS.length} tracked tokens...`);

      try {
        const response = await fetch(METEORA_API_URL, {
          method: 'GET',
        });

        if (!response.ok) {
          throw new Error(`Meteora API error: ${response.status} ${response.statusText}`);
        }

        const pools: MeteoraPoolResponse[] = await response.json();

        // Note: Server-side filtering already done - pools are pre-filtered for tracked tokens
        console.log(`📊 [Solana Pools] Received ${pools.length} pre-filtered pools from API`);

        // Convert to TablePool format and group by tracked token
        const poolsByToken = new Map<string, TablePool>();

        pools.forEach((pool) => {
          try {
            const tvl = parseFloat(pool.liquidity || '0');
            
            // TVL filtering already done server-side, but double-check for safety
            if (tvl <= 0) {
              return;
            }

            // Determine which tracked token this pool is for
            const trackedTokenMint = TRACKED_SOLANA_TOKEN_MINTS.find(
              (mint) => pool.mint_x.toLowerCase() === mint.toLowerCase() || pool.mint_y.toLowerCase() === mint.toLowerCase()
            );

            if (!trackedTokenMint) {
              return;
            }

            const { token0: token0Info, token1: token1Info } = determineTokens(pool);

            // Get logo URLs
            const token0LogoUrl = getSolanaTokenLogoUrl(pool.mint_x) || '';
            const token1LogoUrl = getSolanaTokenLogoUrl(pool.mint_y) || '';

            // Volume and fees
            const volume24h = pool.trade_volume_24h || 0;
            const fees24h = pool.fees_24h || 0;
            
            // Estimate 30d data (multiply 24h by 30, this is approximate)
            const volume30d = volume24h * 30;
            const fees30d = fees24h * 30;

            // Calculate APR using the same method as pool details page (always calculate from fees30d and tvl)
            const apr = calculateApr({ fees30d, tvl });

            // Convert fee percentage to basis points
            const feeAmount = feePercentageToBasisPoints(pool.base_fee_percentage || '0');

            const tablePool: TablePool = {
              hash: pool.address,
              token0: {
                id: pool.mint_x,
                name: token0Info.name,
                symbol: token0Info.symbol,
                decimals: token0Info.decimals,
                address: pool.mint_x,
                chain: 'SOLANA',
                logoURI: token0LogoUrl,
              },
              token1: {
                id: pool.mint_y,
                name: token1Info.name,
                symbol: token1Info.symbol,
                decimals: token1Info.decimals,
                address: pool.mint_y,
                chain: 'SOLANA',
                logoURI: token1LogoUrl,
              },
              tvl,
              volume24h,
              volume30d,
              fees24h,
              fees30d,
              volOverTvl: undefined,
              apr,
              feeTier: {
                feeAmount,
                tickSpacing: 60, // Default tick spacing for DLMM
                isDynamic: true, // DLMM uses dynamic fees
              },
              protocolVersion: 'V3',
            };

            // Keep only the highest TVL pool for each tracked token
            const existingPool = poolsByToken.get(trackedTokenMint);
            if (!existingPool || tablePool.tvl > existingPool.tvl) {
              poolsByToken.set(trackedTokenMint, tablePool);
            }
          } catch (err) {
            console.error(`❌ [Solana Pools] Error processing pool ${pool.address}:`, err);
          }
        });

        // Convert map values to array
        const tablePools: TablePool[] = Array.from(poolsByToken.values());

        console.log(`✅ [Solana Pools] Successfully processed ${tablePools.length} pools`);

        return tablePools;
      } catch (err) {
        console.error('❌ [Solana Pools] Error fetching pools from Meteora API:', err);
        throw err;
      }
    },
    enabled: TRACKED_SOLANA_TOKEN_MINTS.length > 0,
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
