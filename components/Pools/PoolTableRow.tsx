'use client';

import Link from 'next/link';
import { TablePool } from '@/lib/pools/types';
import { PoolDescription } from './PoolDescription';
import { formatCurrency, formatPercent, formatPercentChange } from '@/lib/utils/formatting';
import { APRTooltip } from './APRTooltip';

interface PoolTableRowProps {
  pool: TablePool;
  chainId?: number;
}

export function PoolTableRow({ pool, chainId = 1 }: PoolTableRowProps) {
  // Determine chain from token0 or token1
  const chain = pool.token0?.chain || pool.token1?.chain || 'ETHEREUM';
  const isSolana = chain === 'SOLANA';
  const chainName = isSolana ? 'solana' : 'ethereum';
  const poolLink = `/pools/${chainName}/${pool.hash}`;

  return (
    <tr className={`border-b border-gray-700 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 group ${isSolana ? '' : 'cursor-pointer'}`}>
      <td className="sticky left-0 z-10 bg-white dark:bg-gray-950 group-hover:bg-gray-50 dark:group-hover:bg-gray-800 px-4 py-3">
        {isSolana ? (
          <PoolDescription token0={pool.token0} token1={pool.token1} />
        ) : (
          <Link href={poolLink}>
            <PoolDescription token0={pool.token0} token1={pool.token1} />
          </Link>
        )}
      </td>
      <td className="px-4 py-3 text-sm font-medium">
        <div className="flex items-baseline gap-2">
          <span>{formatCurrency(pool.tvl)}</span>
          {pool.tvl24HChange !== undefined && (
            <span
              className={`text-xs ${
                pool.tvl24HChange >= 0
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              {formatPercentChange(pool.tvl24HChange)}
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-sm">
        <div className="flex items-baseline gap-2">
          <span>{formatCurrency(pool.fees24h || 0)}</span>
          {pool.fees24HDiff !== undefined && (
            <span
              className={`text-xs ${
                pool.fees24HDiff >= 0
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              {pool.fees24HDiff >= 0 ? '+' : ''}
              {formatCurrency(pool.fees24HDiff)}
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-sm">{formatCurrency(pool.fees30d || 0)}</td>
      <td className="px-4 py-3 text-sm">{formatCurrency(pool.volume24h)}</td>
      <td className="px-4 py-3 text-sm">{formatCurrency(pool.volume30d)}</td>
      <td className="px-4 py-3 text-sm">
        {pool.tvl < 100 ? (
          <APRTooltip apr="NA" showLowTvlWarning={true} />
        ) : (
          <APRTooltip apr={formatPercent(pool.apr)} />
        )}
      </td>
    </tr>
  );
}


