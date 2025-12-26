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

function PoolDetailsContent() {
  const params = useParams();
  const poolAddress = params.poolAddress as string;

  const { data: poolData, loading, error } = usePoolData(poolAddress);

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Pool Details</h1>
          <WalletConnect />
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="text-gray-500">Loading pool data...</div>
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

