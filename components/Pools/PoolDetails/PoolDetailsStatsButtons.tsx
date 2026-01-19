'use client';

import { PoolData } from '@/lib/pools/types';

interface PoolDetailsStatsButtonsProps {
  poolData: PoolData;
  loading?: boolean;
}

export function PoolDetailsStatsButtons({ poolData, loading }: PoolDetailsStatsButtonsProps) {
  if (loading || !poolData) {
    return null;
  }

  // Swap button has been moved to PoolDetailsHeader
  return null;
}

