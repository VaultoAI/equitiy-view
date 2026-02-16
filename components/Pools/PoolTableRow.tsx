'use client';

import Link from 'next/link';
import { TablePool } from '@/lib/pools/types';
import { PoolDescription } from './PoolDescription';
import { formatCurrency, formatPercent } from '@/lib/utils/formatting';
import { APRTooltip } from './APRTooltip';

interface PoolTableRowProps {
  pool: TablePool;
  chainId?: number;
  /** When false, the Fees 24h cell is not rendered (kept for easy restore). */
  showFees24hColumn?: boolean;
  /** When true, row uses alternate background for zebra striping. */
  isAlternateRow?: boolean;
}

export function PoolTableRow({ pool, chainId = 1, showFees24hColumn = true, isAlternateRow = false }: PoolTableRowProps) {
  // Determine chain from token0 or token1
  const chain = pool.token0?.chain || pool.token1?.chain || 'ETHEREUM';
  const isSolana = chain === 'SOLANA';
  const chainName = isSolana ? 'solana' : 'ethereum';
  const poolLink = `/pools/${chainName}/${pool.hash}`;

  const rowBg = isAlternateRow ? 'bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800' : 'hover:bg-gray-50 dark:hover:bg-gray-800';
  const stickyBg = isAlternateRow ? 'bg-gray-50 dark:bg-gray-900 group-hover:bg-gray-100 dark:group-hover:bg-gray-800' : 'bg-white dark:bg-gray-950 group-hover:bg-gray-50 dark:group-hover:bg-gray-800';

  return (
    <tr className={`${rowBg} group ${isSolana ? '' : 'cursor-pointer'}`}>
      <td className={`sticky left-0 z-10 ${stickyBg} px-4 py-4 text-sm md:text-base`}>
        {isSolana ? (
          <PoolDescription token0={pool.token0} token1={pool.token1} />
        ) : (
          <Link href={poolLink}>
            <PoolDescription token0={pool.token0} token1={pool.token1} />
          </Link>
        )}
      </td>
      <td className="px-4 py-4 text-sm md:text-base font-medium">
        {formatCurrency(pool.tvl)}
      </td>
      {showFees24hColumn && (
        <td className="px-4 py-4 text-sm md:text-base">
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
      )}
      <td className="px-4 py-4 text-sm md:text-base">{formatCurrency(pool.volume24h || 0)}</td>
      <td className="px-4 py-4 text-sm md:text-base">{formatCurrency(pool.fees30d || 0)}</td>
      <td className="px-4 py-4 text-sm md:text-base">{formatCurrency(pool.volume30d)}</td>
      <td className="px-4 py-4 text-sm md:text-base">
        {pool.tvl < 100 ? (
          <APRTooltip apr="NA" showLowTvlWarning={true} />
        ) : (
          <APRTooltip apr={formatPercent(pool.apr)} />
        )}
      </td>
    </tr>
  );
}


