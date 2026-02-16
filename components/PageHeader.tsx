'use client';

import { VaultoLogo } from '@/components/VaultoLogo';
import { CacheRefreshButton } from '@/components/CacheRefreshButton';
import { WalletConnect } from '@/components/WalletConnect';
import { HeaderNavLinks } from '@/components/Navigation/VerticalNav';

interface PageHeaderProps {
  pageLabel: string;
  showRefresh?: boolean;
}

export function PageHeader({ pageLabel, showRefresh = true }: PageHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 mb-6 md:mb-8">
      <div className="flex flex-col">
        <VaultoLogo
          width={150}
          height={50}
          className="h-8 md:h-12 w-auto"
        />
        <span className="hidden md:inline text-base md:text-lg font-medium -mt-1">{pageLabel}</span>
      </div>
      <div className="flex items-center gap-4 md:gap-6">
        <HeaderNavLinks />
        {showRefresh && (
          <div className="flex items-center gap-2">
            <CacheRefreshButton />
            <WalletConnect />
          </div>
        )}
        {!showRefresh && <WalletConnect />}
      </div>
    </div>
  );
}
