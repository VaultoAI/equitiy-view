'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface CacheRefreshButtonProps {
  className?: string;
  onRefreshComplete?: (success: boolean) => void;
}

export function CacheRefreshButton({ className = '', onRefreshComplete }: CacheRefreshButtonProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date | null>(null);
  const queryClient = useQueryClient();

  const handleRefresh = async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    try {
      console.log('🔄 [Cache Refresh Button] Starting cache refresh...');
      
      // Call the refresh endpoint
      const response = await fetch('/api/cache/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to refresh cache: ${response.statusText}`);
      }

      const result = await response.json();
      const allSuccess = result.tokenizedStockPools?.success && result.solanaPools?.success;

      if (!allSuccess) {
        console.warn('⚠️ [Cache Refresh Button] Partial refresh success:', result);
      }

      // Invalidate all pool-related React Query caches comprehensively
      console.log('🔄 [Cache Refresh Button] Invalidating all pool-related queries...');
      
      // Invalidate main pool list queries (exact match)
      await queryClient.invalidateQueries({ queryKey: ['tokenizedStockPools'] });
      await queryClient.invalidateQueries({ queryKey: ['solanaPools'] });
      
      // Invalidate pool detail queries (prefix match - catches all pool detail queries)
      await queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && key.length > 0 && key[0] === 'poolData';
        }
      });
      
      // Invalidate Solana pool detail queries (prefix match)
      await queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && key.length > 0 && key[0] === 'solanaPoolData';
        }
      });
      
      // Invalidate wallet pool queries (prefix match)
      await queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && key.length > 0 && key[0] === 'walletPools';
        }
      });
      
      // Invalidate token-based pool queries (prefix match)
      await queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && key.length > 0 && key[0] === 'poolsFromToken';
        }
      });
      
      // Invalidate stock price history queries (prefix match - related to pool data)
      await queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && key.length > 0 && key[0] === 'stockPriceHistory';
        }
      });
      
      console.log('✅ [Cache Refresh Button] All pool-related queries invalidated');

      setLastRefreshTime(new Date());
      console.log('✅ [Cache Refresh Button] Cache refreshed successfully');

      if (onRefreshComplete) {
        onRefreshComplete(allSuccess);
      }
    } catch (error) {
      console.error('❌ [Cache Refresh Button] Error refreshing cache:', error);
      if (onRefreshComplete) {
        onRefreshComplete(false);
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <button
      onClick={handleRefresh}
      disabled={isRefreshing}
      className={`
        h-10 flex items-center gap-2 px-3 rounded-lg
        bg-gray-100 dark:bg-gray-800
        hover:bg-gray-200 dark:hover:bg-gray-700
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-colors text-base font-medium
        text-gray-700 dark:text-gray-300
        ${className}
      `}
      title={isRefreshing ? 'Refreshing cache...' : 'Refresh pool data'}
    >
      <svg
        className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
        />
      </svg>
      <span className="hidden sm:inline">
        {isRefreshing ? 'Refreshing...' : 'Refresh'}
      </span>
    </button>
  );
}

/**
 * Mobile-optimized refresh button component
 * Smaller size and icon-only for mobile screens
 */
export function MobileCacheRefreshButton({ className = '', onRefreshComplete }: CacheRefreshButtonProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();

  const handleRefresh = async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    try {
      console.log('🔄 [Mobile Cache Refresh] Starting cache refresh...');
      
      // Call the refresh endpoint
      const response = await fetch('/api/cache/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to refresh cache: ${response.statusText}`);
      }

      const result = await response.json();
      const allSuccess = result.tokenizedStockPools?.success && result.solanaPools?.success;

      if (!allSuccess) {
        console.warn('⚠️ [Mobile Cache Refresh] Partial refresh success:', result);
      }

      // Invalidate all pool-related React Query caches comprehensively
      console.log('🔄 [Mobile Cache Refresh] Invalidating all pool-related queries...');
      
      // Invalidate main pool list queries (exact match)
      await queryClient.invalidateQueries({ queryKey: ['tokenizedStockPools'] });
      await queryClient.invalidateQueries({ queryKey: ['solanaPools'] });
      
      // Invalidate pool detail queries (prefix match)
      await queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && key.length > 0 && key[0] === 'poolData';
        }
      });
      
      // Invalidate Solana pool detail queries (prefix match)
      await queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && key.length > 0 && key[0] === 'solanaPoolData';
        }
      });
      
      // Invalidate wallet pool queries (prefix match)
      await queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && key.length > 0 && key[0] === 'walletPools';
        }
      });
      
      // Invalidate token-based pool queries (prefix match)
      await queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && key.length > 0 && key[0] === 'poolsFromToken';
        }
      });
      
      // Invalidate stock price history queries (prefix match)
      await queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey;
          return Array.isArray(key) && key.length > 0 && key[0] === 'stockPriceHistory';
        }
      });
      
      console.log('✅ [Mobile Cache Refresh] All pool-related queries invalidated');
      console.log('✅ [Mobile Cache Refresh] Cache refreshed successfully');

      if (onRefreshComplete) {
        onRefreshComplete(allSuccess);
      }
    } catch (error) {
      console.error('❌ [Mobile Cache Refresh] Error refreshing cache:', error);
      if (onRefreshComplete) {
        onRefreshComplete(false);
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <button
      onClick={handleRefresh}
      disabled={isRefreshing}
      className={`
        w-full h-full flex items-center justify-center rounded-full
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-colors
        ${className || 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'}
      `}
      title={isRefreshing ? 'Refreshing cache...' : 'Refresh pool data'}
    >
      <svg
        className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
        />
      </svg>
    </button>
  );
}
