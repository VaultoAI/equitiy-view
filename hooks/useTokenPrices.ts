'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchTokenPrice, fetchTokenPrices } from '@/lib/utils/priceApi';
import { useAccount } from 'wagmi';

interface UseTokenPricesOptions {
  tokenAddresses: string[];
  chainId?: number;
  enabled?: boolean;
}

/**
 * Hook to fetch token prices
 * @param tokenAddresses - Array of token contract addresses
 * @param chainId - Chain ID (defaults to connected chain)
 * @param enabled - Whether to enable the query
 * @returns Map of token address (lowercase) to USD price, loading state, and error
 */
export function useTokenPrices({
  tokenAddresses,
  chainId,
  enabled = true,
}: UseTokenPricesOptions) {
  const { chainId: connectedChainId } = useAccount();
  const effectiveChainId = chainId || connectedChainId || 1;

  // Normalize and memoize token addresses to prevent unnecessary refetches
  // Since tokenAddresses from parent is memoized, we can safely use it as dependency
  const normalizedAddressArray = useMemo(() => {
    if (!tokenAddresses || tokenAddresses.length === 0) {
      return [];
    }
    const unique = new Set<string>();
    tokenAddresses.forEach(addr => {
      if (addr && typeof addr === 'string' && addr.length > 0) {
        unique.add(addr.toLowerCase());
      }
    });
    return Array.from(unique).sort(); // Sort for consistent query key
  }, [tokenAddresses]);

  // Create a stable string key for the query
  const queryKey = normalizedAddressArray.join(',');

  const { data, isLoading, error } = useQuery({
    queryKey: ['tokenPrices', queryKey, effectiveChainId],
    queryFn: async () => {
      if (normalizedAddressArray.length === 0) {
        return new Map<string, number>();
      }
      return await fetchTokenPrices(normalizedAddressArray, effectiveChainId);
    },
    enabled: enabled && normalizedAddressArray.length > 0,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
  });

  return {
    prices: data || new Map<string, number>(),
    loading: isLoading,
    error,
  };
}

/**
 * Hook to fetch a single token price
 * @param tokenAddress - Token contract address
 * @param chainId - Chain ID (defaults to connected chain)
 * @param enabled - Whether to enable the query
 * @returns USD price, loading state, and error
 */
export function useTokenPrice(
  tokenAddress: string | null | undefined,
  chainId?: number,
  enabled: boolean = true
) {
  const { chainId: connectedChainId } = useAccount();
  const effectiveChainId = chainId || connectedChainId || 1;

  const { data, isLoading, error } = useQuery({
    queryKey: ['tokenPrice', tokenAddress, effectiveChainId],
    queryFn: async () => {
      if (!tokenAddress) return null;
      return await fetchTokenPrice(tokenAddress, effectiveChainId);
    },
    enabled: enabled && !!tokenAddress,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    price: data ?? null,
    loading: isLoading,
    error,
  };
}

