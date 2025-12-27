'use client';

import { PoolData } from '@/lib/pools/types';
import { PoolDescription } from '../PoolDescription';

interface PoolDetailsHeaderProps {
  poolData: PoolData;
  loading?: boolean;
}

export function PoolDetailsHeader({ poolData, loading }: PoolDetailsHeaderProps) {
  if (loading || !poolData) {
    return (
      <div className="mb-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-300 dark:bg-gray-700 rounded w-48 mb-2"></div>
          <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-32"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <PoolDescription token0={poolData.token0} token1={poolData.token1} alwaysShowBoth={true} />
      <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
        {poolData.protocolVersion} • Fee: {poolData.feeTier ? `${poolData.feeTier.feeAmount / 10000}%` : 'N/A'}
      </div>
    </div>
  );
}


