'use client';

import { useMemo } from 'react';
import { useAccount, useBalance } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import { formatCurrency } from '@/lib/utils/formatting';

export function WalletBalance() {
  const { address, isConnected } = useAccount();
  
  // Fetch native ETH balance using wagmi
  const { data: balance, isLoading: balanceLoading, error: balanceError } = useBalance({
    address: address,
    query: {
      enabled: isConnected && !!address,
    },
  });

  // Fetch ETH price from CoinGecko
  const { data: priceData, isLoading: priceLoading, error: priceError } = useQuery({
    queryKey: ['ethPrice', 'coingecko'],
    queryFn: async () => {
      const response = await fetch('/api/coingecko?coinId=ethereum');
      if (!response.ok) {
        throw new Error('Failed to fetch ETH price');
      }
      const data = await response.json();
      return data.price as number;
    },
    enabled: isConnected && !!address,
    staleTime: 60 * 1000, // Cache for 1 minute
    refetchInterval: 60 * 1000, // Refetch every minute
  });

  const ethBalanceUSD = useMemo(() => {
    const balanceValue = parseFloat(balance?.formatted || '0');
    const ethPrice = priceData || 0;
    return balanceValue * ethPrice;
  }, [balance?.formatted, priceData]);

  const loading = balanceLoading || priceLoading;
  const hasError = balanceError || priceError;

  if (loading) {
    return (
      <div className="mb-6 md:mb-8">
        <div className="animate-pulse">
          <div className="h-12 md:h-16 bg-gray-300 dark:bg-gray-700 rounded w-48 md:w-64 mb-2"></div>
        </div>
      </div>
    );
  }

  if (hasError) {
    console.error('❌ [Wallet Balance] Error:', balanceError || priceError);
  }

  const displayBalance = ethBalanceUSD > 0 ? formatCurrency(ethBalanceUSD) : 'N/A';

  return (
    <div className="mb-6 md:mb-8">
      <div className="text-gray-600 dark:text-gray-400 text-sm md:text-base mb-1 md:mb-2">
        ETH Balance
      </div>
      <div className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-3">
        {displayBalance}
      </div>
    </div>
  );
}

