'use client';

import { PoolData } from '@/lib/pools/types';

interface PoolDetailsStatsButtonsProps {
  poolData: PoolData;
  loading?: boolean;
}

export function PoolDetailsStatsButtons({ poolData, loading }: PoolDetailsStatsButtonsProps) {
  // Add Liquidity button removed - form is now directly on the pool detail page
  if (loading || !poolData) {
    return null;
  }

  return null;
}

