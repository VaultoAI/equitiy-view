'use client';

import { useState } from 'react';
import { PoolTable } from '@/components/Pools/PoolTable';
import { useSolanaPools } from '@/hooks/useSolanaPools';
import { PoolSortFields, PoolTableSortState } from '@/lib/pools/types';
import { PageHeader } from '@/components/PageHeader';

export default function SolPage() {
  const [sortState] = useState<PoolTableSortState>({
    sortBy: PoolSortFields.TVL,
    sortDirection: 'desc',
  });

  const { pools, loading, error } = useSolanaPools(sortState);

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <PageHeader pageLabel="Private Equities" />
        
        <PoolTable pools={pools} loading={loading} error={error} />
      </div>
    </div>
  );
}


