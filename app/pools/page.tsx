'use client';

import { useState, useEffect } from 'react';
import { WalletConnect } from '@/components/WalletConnect';
import { PoolTable } from '@/components/Pools/PoolTable';
import { useWalletPools } from '@/hooks/useWalletPools';
import { PoolSortFields, PoolTableSortState } from '@/lib/pools/types';
import { useAccount } from 'wagmi';

export default function PoolsPage() {
  const { isConnected, address } = useAccount();
  const [sortState] = useState<PoolTableSortState>({
    sortBy: PoolSortFields.TVL,
    sortDirection: 'desc',
  });

  const { pools, loading, error } = useWalletPools(sortState);

  // Log when pools are ready to display
  useEffect(() => {
    if (!loading && pools.length > 0) {
      console.log(`🎉 [Pools Page] Ready to display ${pools.length} pools for wallet ${address}`);
    } else if (!loading && pools.length === 0 && isConnected) {
      console.log('⚠️ [Pools Page] No pools found for wallet tokens');
    }
  }, [loading, pools.length, address, isConnected]);

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">My Pools</h1>
          <WalletConnect />
        </div>

        {!isConnected ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
            <div className="max-w-md w-full text-center space-y-4">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Connect Your Wallet
                </h2>
                <p className="text-gray-600 dark:text-gray-400 text-lg">
                  Connect your wallet to view and manage your liquidity pools
                </p>
              </div>
            </div>
          </div>
        ) : (
          <PoolTable pools={pools} loading={loading} error={error} />
        )}
      </div>
    </div>
  );
}

