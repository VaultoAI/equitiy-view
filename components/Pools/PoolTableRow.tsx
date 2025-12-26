'use client';

import Link from 'next/link';
import { TablePool } from '@/lib/pools/types';
import { PoolDescription } from './PoolDescription';
import { formatCurrency, formatPercent } from '@/lib/utils/formatting';

interface PoolTableRowProps {
  pool: TablePool;
  chainId?: number;
}

export function PoolTableRow({ pool, chainId = 1 }: PoolTableRowProps) {
  const chainName = 'ethereum';
  const poolLink = `/pools/${chainName}/${pool.hash}`;

  return (
    <tr className="border-b hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer">
      <td className="px-4 py-3">
        <Link href={poolLink}>
          <PoolDescription token0={pool.token0} token1={pool.token1} />
        </Link>
      </td>
      <td className="px-4 py-3 text-sm font-medium">{formatCurrency(pool.tvl)}</td>
      <td className="px-4 py-3 text-sm">
        {pool.feeTier
          ? pool.feeTier.isDynamic
            ? 'Dynamic'
            : `${pool.feeTier.feeAmount / 10000}%`
          : '-'}
      </td>
      <td className="px-4 py-3 text-sm">{formatCurrency(pool.fees24h || 0)}</td>
      <td className="px-4 py-3 text-sm">{formatCurrency(pool.volume24h)}</td>
      <td className="px-4 py-3 text-sm">{formatCurrency(pool.volume30d)}</td>
      <td className="px-4 py-3 text-sm">{formatPercent(pool.apr)}</td>
    </tr>
  );
}


