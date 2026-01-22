'use client';

import { useParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Token } from '@uniswap/sdk-core';
import { usePoolData } from '@/hooks/usePoolData';
import { usePoolTransactions } from '@/hooks/usePoolTransactions';
import { usePoolTicks } from '@/hooks/usePoolTicks';
import { PoolDetailsHeader } from '@/components/Pools/PoolDetails/PoolDetailsHeader';
import { PoolDetailsStats } from '@/components/Pools/PoolDetails/PoolDetailsStats';
import { PoolDetailsStatsButtons } from '@/components/Pools/PoolDetails/PoolDetailsStatsButtons';
import { TVLChart } from '@/components/Pools/PoolDetails/TVLChart';
import { HorizontalLiquidityChart } from '@/components/Pools/PoolDetails/HorizontalLiquidityChart';
import { PoolTransactionsTable } from '@/components/Pools/PoolDetails/PoolTransactionsTable';
import { WalletConnect } from '@/components/WalletConnect';
import { MobileNavBar } from '@/components/Navigation/VerticalNav';
import { VaultoLogo } from '@/components/VaultoLogo';
import { CreateLiquidityProvider } from '@/contexts/CreateLiquidityContext';
import { computeActiveLiquidityBands } from '@/lib/uniswap/activeLiquidity';

function PoolDetailsContent() {
  const params = useParams();
  const chain = params.chain as string;
  const poolAddress = params.poolAddress as string;

  const isSolana = chain?.toLowerCase() === 'solana';
  
  // State for price domain and chart height from TVLChart
  const [priceDomain, setPriceDomain] = useState<[number, number] | undefined>(undefined);
  const [chartHeight, setChartHeight] = useState<number>(300);
  
  // Call hook unconditionally (required by React Hooks rules)
  // Pass empty string for Solana to prevent unnecessary fetching
  const ethereumPoolQuery = usePoolData(isSolana ? '' : poolAddress);
  
  // Fetch transactions to get the 24h count
  const { txCount24H } = usePoolTransactions(isSolana ? '' : poolAddress, 100);
  
  // Fetch tick data for liquidity chart
  const ticksQuery = usePoolTicks(isSolana ? '' : poolAddress);
  
  const poolData = ethereumPoolQuery.data;
  const loading = ethereumPoolQuery.loading;
  const error = ethereumPoolQuery.error;
  const ticksData = ticksQuery.data;
  const ticksLoading = ticksQuery.loading;

  // Calculate liquidity bands from tick data
  const liquidityBands = useMemo(() => {
    if (!poolData || !ticksData || !ticksData.ticks || ticksData.ticks.length === 0) {
      return [];
    }

    try {
      // Validate and parse decimals
      const token0Decimals = typeof poolData.token0.decimals === 'number' 
        ? poolData.token0.decimals 
        : parseInt(String(poolData.token0.decimals || '18'));
      const token1Decimals = typeof poolData.token1.decimals === 'number'
        ? poolData.token1.decimals
        : parseInt(String(poolData.token1.decimals || '18'));

      if (isNaN(token0Decimals) || isNaN(token1Decimals)) {
        console.error('Invalid token decimals:', { 
          token0Decimals: poolData.token0.decimals, 
          token1Decimals: poolData.token1.decimals 
        });
        return [];
      }

      // Create Token instances
      const token0 = new Token(
        1, // Ethereum mainnet
        poolData.token0.address,
        token0Decimals,
        poolData.token0.symbol,
        poolData.token0.name
      );

      const token1 = new Token(
        1,
        poolData.token1.address,
        token1Decimals,
        poolData.token1.symbol,
        poolData.token1.name
      );

      // Determine if USDC is token0
      const isUSDC0 = poolData.token0.symbol === 'USDC';

      // Get tick spacing from fee tier
      const tickSpacing = poolData.feeTier?.tickSpacing || 60;

      // Compute liquidity bands
      const bands = computeActiveLiquidityBands(
        ticksData.tick,
        ticksData.liquidity,
        tickSpacing,
        token0,
        token1,
        100, // numSurroundingTicks
        ticksData.ticks,
        isUSDC0
      );

      return bands;
    } catch (err) {
      console.error('Error computing liquidity bands:', err);
      return [];
    }
  }, [poolData, ticksData]);
  
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
              <span className="hidden md:inline text-base md:text-lg font-medium">Pool</span>
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
            <span className="hidden md:inline text-base md:text-lg font-medium">Pool</span>
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
              {/* Mobile shows 4 stats (2x2); the 5th card is desktop-only */}
              {[...Array(4)].map((_, index) => (
                <div key={index} className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                  <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-16 mb-2"></div>
                  <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded w-24"></div>
                </div>
              ))}
              <div className="hidden md:block bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-16 mb-2"></div>
                <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded w-24"></div>
              </div>
            </div>
            {/* Charts Grid Loading Skeleton */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              {/* TVL Chart Skeleton - Takes 2 columns */}
              <div className="xl:col-span-2 bg-gray-50 dark:bg-gray-900 px-2 py-3 md:p-6 rounded-lg">
                <div className="animate-pulse">
                  <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-32 mb-4"></div>
                  <div className="bg-gray-300 dark:bg-gray-700 rounded" style={{ height: '300px' }}></div>
                </div>
              </div>
              
              {/* Liquidity Distribution Chart Skeleton - Takes 1 column */}
              <div className="xl:col-span-1 bg-gray-50 dark:bg-gray-900 rounded-lg px-2 py-3 md:p-6">
                <div className="animate-pulse">
                  <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded w-48 mb-4"></div>
                  <div className="bg-gray-300 dark:bg-gray-700 rounded" style={{ height: '307px' }}></div>
                </div>
              </div>
            </div>
            
            {/* Transactions Table Skeleton */}
            <div className="bg-gray-50 dark:bg-gray-900 p-3 md:p-6 rounded-lg">
              <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-32 mb-4"></div>
              <div className="animate-pulse">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-center md:text-left py-2 md:py-3 px-1 md:px-4 text-xs md:text-sm font-medium text-gray-600 dark:text-gray-400">Value</th>
                        <th className="text-center md:text-left py-2 md:py-3 px-1 md:px-4 text-xs md:text-sm font-medium text-gray-600 dark:text-gray-400">Amounts</th>
                        <th className="text-center md:text-left py-2 md:py-3 px-1 md:px-4 text-xs md:text-sm font-medium text-gray-600 dark:text-gray-400">Type</th>
                        <th className="text-center md:text-left py-2 md:py-3 px-1 md:px-4 text-xs md:text-sm font-medium text-gray-600 dark:text-gray-400 hidden md:table-cell">Date</th>
                        <th className="text-center md:text-left py-2 md:py-3 px-1 md:px-4 text-xs md:text-sm font-medium text-gray-600 dark:text-gray-400">Transaction</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...Array(5)].map((_, index) => (
                        <tr key={index} className="border-b border-gray-200 dark:border-gray-700">
                          <td className="py-2 md:py-3 px-1 md:pl-6 md:pr-5 text-center md:text-left">
                            <div className="h-3 md:h-4 bg-gray-300 dark:bg-gray-700 rounded w-24 md:w-32 mx-auto md:mx-0"></div>
                          </td>
                          <td className="py-2 md:py-3 px-1 md:px-5 text-center md:text-left">
                            <div className="h-5 md:h-6 bg-gray-300 dark:bg-gray-700 rounded w-16 md:w-20 mx-auto md:mx-0"></div>
                          </td>
                          <td className="py-2 md:py-3 px-1 md:px-5 text-center md:text-left">
                            <div className="h-3 md:h-4 bg-gray-300 dark:bg-gray-700 rounded w-20 md:w-24 mx-auto md:mx-0"></div>
                          </td>
                          <td className="py-2 md:py-3 px-1 md:px-5 text-center md:text-left">
                            <div className="h-3 md:h-4 bg-gray-300 dark:bg-gray-700 rounded w-24 md:w-32 mx-auto md:mx-0"></div>
                          </td>
                          <td className="py-2 md:py-3 px-1 md:pl-5 md:pr-6 text-center md:text-left">
                            <div className="h-3 md:h-4 bg-gray-300 dark:bg-gray-700 rounded w-12 md:w-16 mx-auto md:mx-0"></div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
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
            <PoolDetailsStatsButtons poolData={poolData} loading={loading} />
            <PoolDetailsStats poolData={poolData} loading={loading} txCount24H={txCount24H} />
            
            {/* Charts Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
              {/* TVL, Volume & Price Chart - Takes 2 columns */}
              <div className="xl:col-span-2">
                <TVLChart 
                  poolData={poolData} 
                  loading={loading} 
                  onPriceDomainChange={setPriceDomain}
                  onChartHeightChange={setChartHeight}
                />
              </div>
              
              {/* Horizontal Liquidity Chart - Takes 1 column */}
              <div className="xl:col-span-1">
                <HorizontalLiquidityChart
                  bands={liquidityBands}
                  currentTick={ticksData?.tick || 0}
                  securitySymbol={poolData.token0.symbol === 'USDC' ? poolData.token1.symbol : poolData.token0.symbol}
                  usdcSymbol={poolData.token0.symbol === 'USDC' ? poolData.token0.symbol : poolData.token1.symbol}
                  isUSDC0={poolData.token0.symbol === 'USDC'}
                  tvlUSD={poolData.tvlUSD?.toString()}
                  priceDomain={priceDomain}
                  chartHeight={chartHeight}
                  loading={ticksLoading}
                />
              </div>
            </div>
            
            <PoolTransactionsTable poolAddress={poolAddress} poolData={poolData} />
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

