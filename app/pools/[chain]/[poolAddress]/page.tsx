'use client';

import { useParams } from 'next/navigation';
import { usePoolData } from '@/hooks/usePoolData';
import { PoolDetailsHeader } from '@/components/Pools/PoolDetails/PoolDetailsHeader';
import { PoolDetailsStats } from '@/components/Pools/PoolDetails/PoolDetailsStats';
import { PoolDetailsStatsButtons } from '@/components/Pools/PoolDetails/PoolDetailsStatsButtons';
import { TVLChart } from '@/components/Pools/PoolDetails/TVLChart';
import { WalletConnect } from '@/components/WalletConnect';
import { CreateLiquidityProvider } from '@/contexts/CreateLiquidityContext';
import { AddLiquidityForm } from '@/components/Liquidity/CreatePosition/AddLiquidityForm';
import { LoadingSpinner } from '@/components/LoadingSpinner';

function PoolDetailsContent() {
  const params = useParams();
  const chain = params.chain as string;
  const poolAddress = params.poolAddress as string;

  const isSolana = chain?.toLowerCase() === 'solana';
  
  // Call hook unconditionally (required by React Hooks rules)
  // Pass empty string for Solana to prevent unnecessary fetching
  const ethereumPoolQuery = usePoolData(isSolana ? '' : poolAddress);
  
  const poolData = ethereumPoolQuery.data;
  const loading = ethereumPoolQuery.loading;
  const error = ethereumPoolQuery.error;
  
  // Disable access to Solana pool details
  if (isSolana) {
    return (
      <div className="min-h-screen p-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold">Pool Details</h1>
            <WalletConnect />
          </div>
          <div className="text-center py-12">
            <div className="text-red-500 text-lg font-semibold mb-2">
              Pool details are not available for Solana pools
            </div>
            <div className="text-gray-500">
              Please use the Solana pools list page to view pool information.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Pool Details</h1>
          <WalletConnect />
        </div>

        {loading ? (
          <div className="text-center py-12">
            <LoadingSpinner size="lg" text="Loading pool data..." />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <div className="text-red-500">Error loading pool: {error.message}</div>
          </div>
        ) : !poolData ? (
          <div className="text-center py-12">
            <div className="text-gray-500">Pool not found</div>
          </div>
        ) : (
          <div>
            <PoolDetailsHeader poolData={poolData} loading={loading} />
            <PoolDetailsStats poolData={poolData} loading={loading} />
            <PoolDetailsStatsButtons poolData={poolData} loading={loading} />
            <TVLChart poolData={poolData} loading={loading} />
            <AddLiquidityForm
              token0={poolData.token0}
              token1={poolData.token1}
              feeTier={poolData.feeTier?.feeAmount}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default function PoolDetailsPage() {
  return (
    <CreateLiquidityProvider>
      <PoolDetailsContent />
    </CreateLiquidityProvider>
  );
}

