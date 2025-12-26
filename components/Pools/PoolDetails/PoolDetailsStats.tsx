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
    return <div className="animate-pulse">Loading stats...</div>;
  }

  const apr = calculateApr({
    volume24h: poolData.volumeUSD24H,
    tvl: poolData.tvlUSD,
    feeTier: poolData.feeTier?.feeAmount,
  });

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">TVL</div>
        <div className="text-lg font-semibold">{formatCurrency(poolData.tvlUSD || 0)}</div>
      </div>
      <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">24h Volume</div>
        <div className="text-lg font-semibold">{formatCurrency(poolData.volumeUSD24H || 0)}</div>
      </div>
      <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">APR</div>
        <div className="text-lg font-semibold">{formatPercent(apr.toSignificant(2))}</div>
      </div>
      <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Transactions</div>
        <div className="text-lg font-semibold">{poolData.txCount?.toLocaleString() || '0'}</div>
      </div>
    </div>
  );
}

