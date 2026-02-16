'use client';

import { useState } from 'react';
import { PoolTable } from '@/components/Pools/PoolTable';
import { useTokenizedStockPools } from '@/hooks/useTokenizedStockPools';
import { PoolSortFields, PoolTableSortState } from '@/lib/pools/types';
import { PageHeader } from '@/components/PageHeader';

export default function EthPage() {
  const [sortState] = useState<PoolTableSortState>({
    sortBy: PoolSortFields.TVL,
    sortDirection: 'desc',
  });

  const { pools, loading, error } = useTokenizedStockPools(sortState);

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <PageHeader pageLabel="Ethereum" />
        
        <PoolTable pools={pools} loading={loading} error={error} />
      </div>
    </div>
  );
}
