'use client';

import { useState, useEffect } from 'react';
import { WalletConnect } from '@/components/WalletConnect';
import { PoolTable } from '@/components/Pools/PoolTable';
import { WalletBalance } from '@/components/WalletDashboard/WalletBalance';
import { useWalletPools } from '@/hooks/useWalletPools';
import { PoolSortFields, PoolTableSortState } from '@/lib/pools/types';
import { useAccount } from 'wagmi';
import { PageHeader } from '@/components/PageHeader';

export default function WalletPage() {
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
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <PageHeader pageLabel="Wallet" />

        {!isConnected ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
            <div className="max-w-md w-full text-center space-y-4">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Connect Your Wallet
                </h2>
                <p className="text-gray-600 dark:text-gray-400 text-lg">
                  Connect your wallet to view and
                  <br />
                  manage your liquidity pools
                </p>
              </div>
              <div className="flex justify-center pt-2">
                <WalletConnect />
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Wallet Dashboard */}
            <div className="mb-8 md:mb-12">
              <WalletBalance />
            </div>
            
            {/* Pool Table */}
            <PoolTable pools={pools} loading={loading} error={error} />
          </>
        )}
      </div>
    </div>
  );
}
