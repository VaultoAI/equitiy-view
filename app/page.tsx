'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { PoolTable } from '@/components/Pools/PoolTable';
import { TopPoolsChartsSection } from '@/components/Pools/TopPoolsChartsSection';
import { useTokenizedStockPools } from '@/hooks/useTokenizedStockPools';
import { PoolSortFields, PoolTableSortState } from '@/lib/pools/types';
import { PageHeader } from '@/components/PageHeader';

export default function Home() {
  const { isConnected } = useAccount();
  const [sortState] = useState<PoolTableSortState>({
    sortBy: PoolSortFields.TVL,
    sortDirection: 'desc',
  });

  const { pools, loading, error } = useTokenizedStockPools(sortState);

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <PageHeader pageLabel="Public Equities" />

        {/* Top 2 pools by TVL - charts (hidden on mobile) */}
        <div className="hidden md:block">
          {(loading || pools.length > 0) && (
            <TopPoolsChartsSection pools={pools} loading={loading} />
          )}
        </div>

        {/* Pool Table - Always shown */}
        <PoolTable pools={pools} loading={loading} error={error} />
      </div>
    </div>
  );
}
