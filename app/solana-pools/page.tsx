'use client';

import { useState } from 'react';
import Image from 'next/image';
import { WalletConnect } from '@/components/WalletConnect';
import { MobileNavBar } from '@/components/Navigation/VerticalNav';
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
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header with logo and nav */}
        <div className="flex justify-between items-center mb-6 md:mb-8">
          <div className="flex items-center gap-3">
            <Image 
              src="/vaulto.png" 
              alt="Vaulto" 
              width={150} 
              height={50}
              className="h-8 md:h-12 w-auto"
            />
            <span className="text-base md:text-lg font-medium">Private</span>
          </div>
          {/* Mobile nav bar (includes wallet connect) */}
          <MobileNavBar />
          {/* Desktop wallet connect - hidden on mobile (shown in nav) */}
          <div className="hidden md:block">
            <WalletConnect />
          </div>
        </div>
        
        <PoolTable pools={pools} loading={loading} error={error} />
      </div>
    </div>
  );
}

