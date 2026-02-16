'use client';

import { TablePool } from '@/lib/pools/types';
import { usePoolData } from '@/hooks/usePoolData';
import { TVLChart } from '@/components/Pools/PoolDetails/TVLChart';
import { ChartSkeleton } from '@/components/Pools/ChartSkeleton';

interface TopPoolChartCardProps {
  poolHash: string;
}

function TopPoolChartCard({ poolHash }: TopPoolChartCardProps) {
  const { data: poolData, loading, error } = usePoolData(poolHash);

  if (loading) {
    return <ChartSkeleton />;
  }

  if (error || !poolData) {
    return (
      <div className="bg-gray-50 dark:bg-gray-900 p-3 md:p-6 rounded-lg flex flex-col items-center justify-center min-h-[340px] text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">Unable to load chart</p>
      </div>
    );
  }

  return <TVLChart poolData={poolData} loading={false} hideVolatility largeTitle simplePriceLabel />;
}

interface TopPoolsChartsSectionProps {
  pools: TablePool[];
  loading: boolean;
}

export function TopPoolsChartsSection({ pools, loading }: TopPoolsChartsSectionProps) {
  const top2 = pools.slice(0, 2);
  const showSkeletons = loading || top2.length === 0;

  return (
    <section className="mb-6 md:mb-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {showSkeletons
          ? [...Array(2)].map((_, i) => <ChartSkeleton key={i} />)
          : top2.map((pool) => (
              <TopPoolChartCard key={pool.hash} poolHash={pool.hash} />
            ))}
      </div>
    </section>
  );
}
