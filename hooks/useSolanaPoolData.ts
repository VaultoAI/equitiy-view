'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PoolData, Token, TVLDataPoint } from '@/lib/pools/types';
import { calculateApr } from '@/lib/pools/utils';
import { getSolanaTokenLogoUrl, getSolanaTokenName } from '@/lib/utils/solanaTokenLogo';

const METEORA_API_BASE_URL = 'https://dlmm-api.meteora.ag';

// Common Solana token addresses
const SOLANA_COMMON_TOKENS: Record<string, { symbol: string; name: string; decimals: number }> = {
  'So11111111111111111111111111111111111111112': { symbol: 'SOL', name: 'Solana', decimals: 9 },
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': { symbol: 'USDC', name: 'USD Coin', decimals: 6 },
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': { symbol: 'USDT', name: 'Tether', decimals: 6 },
};

interface MeteoraPoolResponse {
  address: string;
  name: string;
  mint_x: string;
  mint_y: string;
  reserve_x_amount: number;
  reserve_y_amount: number;
  liquidity: string;
  trade_volume_24h: number;
  fees_24h: number;
  apr: number;
  base_fee_percentage: string;
  bin_step: number;
  current_price: number;
}

/**
 * Parses token symbol and name from pool name and mint address
 */
function parseTokenInfo(mintAddress: string, poolName: string): { symbol: string; name: string; decimals: number } {
  // Check if it's a tracked prestock token
  const trackedName = getSolanaTokenName(mintAddress);
  if (trackedName) {
    return { symbol: trackedName, name: trackedName, decimals: 9 };
  }

  // Check if it's a common token
  if (mintAddress in SOLANA_COMMON_TOKENS) {
    return SOLANA_COMMON_TOKENS[mintAddress];
  }

  // Try to parse from pool name
  const parts = poolName.split('/');
  if (parts.length >= 2) {
    const symbol = parts[0]?.trim() || 'UNKNOWN';
    return { symbol, name: symbol, decimals: 9 };
  }

  return { symbol: 'UNKNOWN', name: 'Unknown Token', decimals: 9 };
}

/**
 * Converts fee percentage string to basis points
 */
function feePercentageToBasisPoints(feePercentage: string): number {
  try {
    const fee = parseFloat(feePercentage);
    if (isNaN(fee)) return 0;
    return Math.round(fee * 100);
  } catch {
    return 0;
  }
}

export function useSolanaPoolData(poolAddress: string) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['solanaPoolData', poolAddress],
    queryFn: async () => {
      if (!poolAddress || poolAddress.trim() === '') {
        return null;
      }

      console.log(`🏊 [Solana Pool Data] Fetching pool data for address: ${poolAddress}`);

      try {
        // Use the specific pair endpoint for better efficiency
        const response = await fetch(`${METEORA_API_BASE_URL}/pair/${poolAddress}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          // If 404, pool not found
          if (response.status === 404) {
            console.log(`⚠️ [Solana Pool Data] Pool not found: ${poolAddress}`);
            return null;
          }
          throw new Error(`Meteora API error: ${response.status} ${response.statusText}`);
        }

        const pool: MeteoraPoolResponse = await response.json();

        if (!pool || !pool.address) {
          console.log(`⚠️ [Solana Pool Data] Invalid pool data for address: ${poolAddress}`);
          return null;
        }

        console.log(`✅ [Solana Pool Data] Found pool: ${pool.name || pool.address}`);
        return pool;
      } catch (err) {
        console.error('❌ [Solana Pool Data] Error fetching pool data:', err);
        throw err;
      }
    },
    enabled: !!poolAddress && poolAddress.trim() !== '',
    staleTime: 30000, // Cache for 30 seconds
  });

  // Memoize poolData
  const poolData = useMemo<PoolData | undefined>(() => {
    if (!data) {
      return undefined;
    }

    const pool = data;
    const tvlUSD = parseFloat(pool.liquidity || '0');

    // Parse token information
    const token0Info = parseTokenInfo(pool.mint_x, pool.name);
    const token1Info = parseTokenInfo(pool.mint_y, pool.name);

    // Get logo URLs
    const token0LogoUrl = getSolanaTokenLogoUrl(pool.mint_x) || '';
    const token1LogoUrl = getSolanaTokenLogoUrl(pool.mint_y) || '';

    // Volume and fees (24h and 30d - estimate 30d by multiplying 24h by 30)
    const volumeUSD24H = pool.trade_volume_24h || 0;
    const feesUSD24H = pool.fees_24h || 0;
    const volumeUSD30D = volumeUSD24H * 30;
    const feesUSD30D = feesUSD24H * 30;

    // Convert fee percentage to basis points
    const feeAmount = feePercentageToBasisPoints(pool.base_fee_percentage || '0');

    const token0: Token = {
      id: pool.mint_x,
      name: token0Info.name,
      symbol: token0Info.symbol,
      decimals: token0Info.decimals,
      address: pool.mint_x,
      chain: 'SOLANA',
      logoURI: token0LogoUrl,
    };

    const token1: Token = {
      id: pool.mint_y,
      name: token1Info.name,
      symbol: token1Info.symbol,
      decimals: token1Info.decimals,
      address: pool.mint_y,
      chain: 'SOLANA',
      logoURI: token1LogoUrl,
    };

    // Create a basic TVL history (single point with current TVL)
    // Note: Meteora API doesn't provide historical TVL data in the same format
    // We'll create a single data point for now
    const tvlHistory: TVLDataPoint[] = tvlUSD > 0
      ? [
          {
            date: Math.floor(Date.now() / 1000),
            tvlUSD,
          },
        ]
      : [];

    return {
      idOrAddress: pool.address,
      protocolVersion: 'V3',
      token0,
      token1,
      tvlUSD,
      volumeUSD24H,
      feesUSD24H,
      volumeUSD30D,
      feesUSD30D,
      feeTier: {
        feeAmount,
        tickSpacing: 60,
        isDynamic: true, // DLMM uses dynamic fees
      },
      txCount: 0, // Meteora API doesn't provide txCount
      tvlHistory,
    };
  }, [data]);

  return {
    loading: isLoading,
    error,
    data: poolData,
  };
}

