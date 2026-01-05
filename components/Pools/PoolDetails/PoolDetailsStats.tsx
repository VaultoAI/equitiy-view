'use client';

import { PoolData } from '@/lib/pools/types';
import { formatCurrency, formatPercent } from '@/lib/utils/formatting';
import { calculateApr } from '@/lib/pools/utils';

interface PoolDetailsStatsProps {
  poolData: PoolData;
  loading?: boolean;
}

export function PoolDetailsStats({ poolData, loading }: PoolDetailsStatsProps) {
  if (loading || !poolData) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {/* Mobile shows 4 stats (2x2); the 5th card is desktop-only */}
        {[...Array(4)].map((_, index) => (
          <div key={index} className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-16 mb-2"></div>
              <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded w-24"></div>
            </div>
          </div>
        ))}
        <div className="hidden md:block bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-16 mb-2"></div>
            <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded w-24"></div>
          </div>
        </div>
      </div>
    );
  }

  const apr = calculateApr({
    fees30d: poolData.feesUSD30D,
    tvl: poolData.tvlUSD,
  });

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
      <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">TVL</div>
        <div className="text-lg font-semibold">{formatCurrency(poolData.tvlUSD || 0)}</div>
      </div>
      <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Volume 30d</div>
        <div className="text-lg font-semibold">{formatCurrency(poolData.volumeUSD30D || 0)}</div>
      </div>
      <div className="hidden md:block bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Fees 30d</div>
        <div className="text-lg font-semibold">{formatCurrency(poolData.feesUSD30D || 0)}</div>
      </div>
      <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">APR</div>
        <div className="text-lg font-semibold">{formatPercent(apr)}</div>
      </div>
      <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Transactions</div>
        <div className="text-lg font-semibold">{poolData.txCount?.toLocaleString() || '0'}</div>
      </div>
    </div>
  );
}


