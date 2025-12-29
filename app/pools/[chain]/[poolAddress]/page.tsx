'use client';

import { useParams } from 'next/navigation';
import { usePoolData } from '@/hooks/usePoolData';
import { PoolDetailsHeader } from '@/components/Pools/PoolDetails/PoolDetailsHeader';
import { PoolDetailsStats } from '@/components/Pools/PoolDetails/PoolDetailsStats';
import { PoolDetailsStatsButtons } from '@/components/Pools/PoolDetails/PoolDetailsStatsButtons';
import { TVLChart } from '@/components/Pools/PoolDetails/TVLChart';
import { WalletConnect } from '@/components/WalletConnect';
import { MobileNavBar } from '@/components/Navigation/VerticalNav';
import { CreateLiquidityProvider } from '@/contexts/CreateLiquidityContext';
import { AddLiquidityForm } from '@/components/Liquidity/CreatePosition/AddLiquidityForm';
import { VaultoLogo } from '@/components/VaultoLogo';

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
      <div className="min-h-screen p-4 md:p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header with logo and nav */}
          <div className="flex justify-between items-center mb-6 md:mb-8">
            <div className="flex items-center gap-3">
              <VaultoLogo 
                width={150} 
                height={50}
                className="h-8 md:h-12 w-auto"
              />
              <span className="text-base md:text-lg font-medium">Pool</span>
            </div>
            {/* Mobile nav bar (includes wallet connect) */}
            <MobileNavBar />
            {/* Desktop: show wallet connect */}
            <div className="hidden md:flex md:items-center md:gap-4">
              <WalletConnect />
            </div>
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
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header with logo and nav */}
        <div className="flex justify-between items-center mb-6 md:mb-8">
          <div className="flex items-center gap-3">
            <VaultoLogo 
              width={150} 
              height={50}
              className="h-8 md:h-12 w-auto"
            />
            <span className="text-base md:text-lg font-medium">Pool</span>
          </div>
          {/* Mobile nav bar (includes wallet connect) */}
          <MobileNavBar />
          {/* Desktop: show wallet connect */}
          <div className="hidden md:flex md:items-center md:gap-4">
            <WalletConnect />
          </div>
        </div>

        {loading ? (
          <div className="space-y-6">
            <div className="animate-pulse">
              <div className="h-8 bg-gray-300 dark:bg-gray-700 rounded w-48 mb-2"></div>
              <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-32"></div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[...Array(5)].map((_, index) => (
                <div key={index} className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                  <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-16 mb-2"></div>
                  <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded w-24"></div>
                </div>
              ))}
            </div>
            <div className="bg-gray-50 dark:bg-gray-900 p-3 md:p-6 rounded-lg">
              <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-32 mb-4"></div>
              <div className="h-64 bg-gray-300 dark:bg-gray-700 rounded"></div>
            </div>
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
            <div className="hidden md:block">
              <AddLiquidityForm
                token0={poolData.token0}
                token1={poolData.token1}
                feeTier={poolData.feeTier?.feeAmount}
              />
            </div>
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

