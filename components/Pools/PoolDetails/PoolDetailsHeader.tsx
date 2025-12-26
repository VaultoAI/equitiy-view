'use client';

import { PoolData } from '@/lib/pools/types';
import { PoolDescription } from '../PoolDescription';

interface PoolDetailsHeaderProps {
  poolData: PoolData;
  loading?: boolean;
}

export function PoolDetailsHeader({ poolData, loading }: PoolDetailsHeaderProps) {
  if (loading || !poolData) {
    return <div className="animate-pulse">Loading...</div>;
  }

  return (
    <div className="mb-6">
      <PoolDescription token0={poolData.token0} token1={poolData.token1} />
      <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
        {poolData.protocolVersion} • Fee: {poolData.feeTier ? `${poolData.feeTier.feeAmount / 10000}%` : 'N/A'}
      </div>
    </div>
  );
}

