'use client';

import { PoolData } from '@/lib/pools/types';
import { formatCurrency, formatPercent, formatPercentChange } from '@/lib/utils/formatting';
import { calculateApr } from '@/lib/pools/utils';

interface PoolDetailsStatsProps {
  poolData: PoolData;
  loading?: boolean;
  txCount24H?: number;
}

export function PoolDetailsStats({ poolData, loading, txCount24H }: PoolDetailsStatsProps) {
  if (loading || !poolData) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        {/* Mobile shows 4 stats (2x2): TVL, Fees 24h, Volume 30d, APR */}
        {[...Array(4)].map((_, index) => (
          <div key={index} className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
            <div className="animate-pulse">
              <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-16 mb-2"></div>
              <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded w-24"></div>
            </div>
          </div>
        ))}
        {/* Transactions - desktop only (5th column) */}
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

  // Debug logging
  console.log('PoolDetailsStats - poolData:', {
    tvlUSD24HChange: poolData.tvlUSD24HChange,
    feesUSD24HDiff: poolData.feesUSD24HDiff,
    feesUSD24H: poolData.feesUSD24H,
  });

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
      <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">TVL</div>
        <div className="flex items-baseline gap-2">
          <div className="text-lg font-semibold">{formatCurrency(poolData.tvlUSD || 0)}</div>
          {poolData.tvlUSD24HChange !== undefined && (
            <span
              className={`text-xs ${
                poolData.tvlUSD24HChange >= 0
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              {formatPercentChange(poolData.tvlUSD24HChange)}
            </span>
          )}
        </div>
      </div>
      <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
        {/* Mobile: Show Fees 24h, Desktop: Show Fees 30d */}
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
          <span className="md:hidden">Fees 24h</span>
          <span className="hidden md:inline">Fees 30d</span>
        </div>
        <div className="flex items-baseline gap-2">
          <div className="text-lg font-semibold">
            <span className="md:hidden">{formatCurrency(poolData.feesUSD24H || 0)}</span>
            <span className="hidden md:inline">{formatCurrency(poolData.feesUSD30D || 0)}</span>
          </div>
          {/* Only show diff on mobile where 24h fees are displayed */}
          {poolData.feesUSD24HDiff !== undefined && (
            <span
              className={`text-xs md:hidden ${
                poolData.feesUSD24HDiff >= 0
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              {poolData.feesUSD24HDiff >= 0 ? '+' : ''}
              {formatCurrency(poolData.feesUSD24HDiff)}
            </span>
          )}
        </div>
      </div>
      <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
        {/* Mobile: Show Volume 30d, Desktop: Show Volume 24h */}
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
          <span className="md:hidden">Volume 30d</span>
          <span className="hidden md:inline">Volume 24h</span>
        </div>
        <div className="text-lg font-semibold">
          <span className="md:hidden">{formatCurrency(poolData.volumeUSD30D || 0)}</span>
          <span className="hidden md:inline">{formatCurrency(poolData.volumeUSD24H || 0)}</span>
        </div>
      </div>
      <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">APR</div>
        <div className="text-lg font-semibold">{formatPercent(apr)}</div>
      </div>
      <div className="hidden md:block bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Transactions</div>
        <div className="flex items-baseline gap-2">
          <div className="text-lg font-semibold">{poolData.txCount?.toLocaleString() || '0'}</div>
          {txCount24H !== undefined && txCount24H > 0 && (
            <span className="text-xs text-green-600 dark:text-green-400">
              +{txCount24H.toLocaleString()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}


