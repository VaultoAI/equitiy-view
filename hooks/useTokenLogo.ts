'use client';

import { useQuery } from '@tanstack/react-query';
import { getTokenLogoUrl, verifyLogoExists } from '@/lib/utils/tokenLogo';

interface UseTokenLogoOptions {
  tokenAddress: string | null | undefined;
  chainId?: number;
  enabled?: boolean;
}

/**
 * React hook for fetching and caching token logos
 * @param tokenAddress - Token contract address
 * @param chainId - Chain ID (default: 1 for Ethereum mainnet)
 * @param enabled - Whether to enable the query
 * @returns Object with logoUrl, isLoading, and error
 */
export function useTokenLogo({
  tokenAddress,
  chainId = 1,
  enabled = true,
}: UseTokenLogoOptions) {
  const { data: logoUrl, isLoading, error } = useQuery({
    queryKey: ['tokenLogo', tokenAddress?.toLowerCase(), chainId],
    queryFn: async () => {
      if (!tokenAddress) {
        return null;
      }

      // Get the TrustWallet URL
      const url = getTokenLogoUrl(tokenAddress, chainId);
      
      if (!url) {
        return null;
      }

      // Verify the logo exists
      const exists = await verifyLogoExists(url);
      return exists ? url : null;
    },
    enabled: enabled && !!tokenAddress,
    staleTime: 24 * 60 * 60 * 1000, // Cache for 24 hours
    gcTime: 7 * 24 * 60 * 60 * 1000, // Keep in cache for 7 days
    retry: 1, // Only retry once on failure
  });

  return {
    logoUrl: logoUrl || null,
    isLoading,
    error: error || null,
  };
}

