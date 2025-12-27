'use client';

import { useState } from 'react';
import Image from 'next/image';
import { WalletConnect } from '@/components/WalletConnect';
import { PoolTable } from '@/components/Pools/PoolTable';
import { useSolanaPools } from '@/hooks/useSolanaPools';
import { PoolSortFields, PoolTableSortState } from '@/lib/pools/types';

export default function SolanaPoolsPage() {
  const [sortState] = useState<PoolTableSortState>({
    sortBy: PoolSortFields.TVL,
    sortDirection: 'desc',
  });

  const { pools, loading, error } = useSolanaPools(sortState);

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3">
            <Image 
              src="/vaulto.png" 
              alt="Vaulto" 
              width={150} 
              height={50}
              className="h-12 w-auto"
            />
            <span className="text-lg font-medium">Private</span>
          </div>
          <WalletConnect />
        </div>
        
        <PoolTable pools={pools} loading={loading} error={error} />
      </div>
    </div>
  );
}

