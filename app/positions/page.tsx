'use client';

import { WalletConnect } from '@/components/WalletConnect';
import { useAccount } from 'wagmi';

export default function PositionsPage() {
  const { isConnected } = useAccount();

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">My Positions</h1>
          <WalletConnect />
        </div>

        {!isConnected ? (
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Connect your wallet to view your positions
            </p>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400">
              Position management coming soon
            </p>
          </div>
        )}
      </div>
    </div>
  );
}


