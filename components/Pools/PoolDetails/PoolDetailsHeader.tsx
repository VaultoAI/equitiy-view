'use client';

import { PoolData } from '@/lib/pools/types';
import { PoolDescription } from '../PoolDescription';

interface PoolDetailsHeaderProps {
  poolData: PoolData;
  loading?: boolean;
}

export function PoolDetailsHeader({ poolData, loading }: PoolDetailsHeaderProps) {
  if (loading || !poolData) {
    return (
      <div className="mb-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-300 dark:bg-gray-700 rounded w-48 mb-2"></div>
          <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-32"></div>
        </div>
      </div>
    );
  }

  const uniswapUrl = `https://app.uniswap.org/explore/pools/ethereum/${poolData.idOrAddress}`;

  return (
    <div className="mb-6">
      <PoolDescription token0={poolData.token0} token1={poolData.token1} alwaysShowBoth={true} />
      <div className="mt-2 flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
        <span>{poolData.protocolVersion} • Fee: {poolData.feeTier ? `${poolData.feeTier.feeAmount / 10000}%` : 'N/A'}</span>
        <a 
          href={uniswapUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
        >
          View on Uniswap
          <svg 
            className="w-3 h-3" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" 
            />
          </svg>
        </a>
      </div>
    </div>
  );
}


