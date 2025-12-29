'use client';

import { useState, useMemo } from 'react';
import { TablePool, PoolSortFields, PoolTableSortState } from '@/lib/pools/types';
import { PoolTableRow } from './PoolTableRow';
import { formatCurrency, formatPercent } from '@/lib/utils/formatting';
import { sortPools } from '@/lib/pools/utils';
import { APRTooltip } from './APRTooltip';
interface PoolTableProps {
  pools: TablePool[];
  loading: boolean;
  error?: Error | null;
}

export function PoolTable({ pools, loading, error }: PoolTableProps) {
  const [sortState, setSortState] = useState<PoolTableSortState>({
    sortBy: PoolSortFields.TVL,
    sortDirection: 'desc',
  });

  const handleSort = (field: PoolSortFields) => {
    setSortState((prev) => ({
      sortBy: field,
      sortDirection:
        prev.sortBy === field && prev.sortDirection === 'desc' ? 'asc' : 'desc',
    }));
  };

  // Calculate sorted pools and totals - must be before conditional returns
  const sortedPools = useMemo(() => {
    if (pools.length === 0) return [];
    return sortPools(pools, sortState);
  }, [pools, sortState]);

  const totals = useMemo(() => {
    if (sortedPools.length === 0) {
      return {
        tvl: 0,
        fees24h: 0,
        fees30d: 0,
        volume24h: 0,
        volume30d: 0,
        apr: 0
      };
    }

    let totalTvl = 0;
    let totalFees24h = 0;
    let totalFees30d = 0;
    let totalVolume24h = 0;
    let totalVolume30d = 0;
    let weightedAprSum = 0;
    
    sortedPools.forEach(pool => {
      totalTvl += pool.tvl || 0;
      totalFees24h += pool.fees24h || 0;
      totalFees30d += pool.fees30d || 0;
      totalVolume24h += pool.volume24h || 0;
      totalVolume30d += pool.volume30d || 0;
      weightedAprSum += (pool.apr || 0) * (pool.tvl || 0);
    });
    
    const avgApr = totalTvl > 0 ? weightedAprSum / totalTvl : 0;
    
    return {
      tvl: totalTvl,
      fees24h: totalFees24h,
      fees30d: totalFees30d,
      volume24h: totalVolume24h,
      volume30d: totalVolume30d,
      apr: avgApr
    };
  }, [sortedPools]);

  const SortButton = ({ field, children }: { field: PoolSortFields; children: React.ReactNode }) => {
    const isActive = sortState.sortBy === field;
    const direction = isActive ? sortState.sortDirection : undefined;

    return (
      <button
        onClick={() => handleSort(field)}
        className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400"
      >
        {children}
        {isActive && (
          <span className="text-xs">{direction === 'desc' ? '↓' : '↑'}</span>
        )}
      </button>
    );
  };

  if (loading) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900">
              <th className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-900 px-4 py-3 text-left text-sm font-semibold">Pool</th>
              <th className="px-4 py-3 text-left text-sm font-semibold">
                <SortButton field={PoolSortFields.TVL}>TVL</SortButton>
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold">
                <SortButton field={PoolSortFields.Fees24h}>Fees 24h</SortButton>
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold">
                <SortButton field={PoolSortFields.Fees30d}>Fees 30d</SortButton>
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold">
                <SortButton field={PoolSortFields.Volume24h}>Volume 24h</SortButton>
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold">
                <SortButton field={PoolSortFields.Volume30D}>Volume 30d</SortButton>
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold">
                <SortButton field={PoolSortFields.Apr}>APR</SortButton>
              </th>
            </tr>
          </thead>
          <tbody>
            {[...Array(5)].map((_, index) => (
              <tr key={index} className="border-b border-gray-700 dark:border-gray-600">
                <td className="sticky left-0 z-10 bg-white dark:bg-gray-950 px-4 py-3">
                  <div className="animate-pulse">
                    <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded w-32"></div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="animate-pulse">
                    <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-20"></div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="animate-pulse">
                    <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-16"></div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="animate-pulse">
                    <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-20"></div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="animate-pulse">
                    <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-16"></div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="animate-pulse">
                    <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-20"></div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="animate-pulse">
                    <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-12"></div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-red-500">Error loading pools: {error.message}</div>
      </div>
    );
  }

  if (pools.length === 0) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-gray-500">No pools found for your wallet tokens</div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-900">
            <th className="sticky left-0 z-10 bg-gray-50 dark:bg-gray-900 px-4 py-3 text-left text-sm font-semibold">Pool</th>
            <th className="px-4 py-3 text-left text-sm font-semibold">
              <SortButton field={PoolSortFields.TVL}>TVL</SortButton>
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold">
              <SortButton field={PoolSortFields.Fees24h}>Fees 24h</SortButton>
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold">
              <SortButton field={PoolSortFields.Fees30d}>Fees 30d</SortButton>
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold">
              <SortButton field={PoolSortFields.Volume24h}>Volume 24h</SortButton>
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold">
              <SortButton field={PoolSortFields.Volume30D}>Volume 30d</SortButton>
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold">
              <SortButton field={PoolSortFields.Apr}>APR</SortButton>
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedPools.map((pool) => (
            <PoolTableRow key={pool.hash} pool={pool} />
          ))}
          {sortedPools.length > 0 && (
            <tr className="bg-gray-100 dark:bg-gray-800 font-semibold border-t-2 border-gray-300 dark:border-gray-600">
              <td className="sticky left-0 z-10 bg-gray-100 dark:bg-gray-800 group-hover:bg-gray-100 dark:group-hover:bg-gray-800 px-4 py-3 text-sm">
                Total
              </td>
              <td className="px-4 py-3 text-sm">{formatCurrency(totals.tvl)}</td>
              <td className="px-4 py-3 text-sm">{formatCurrency(totals.fees24h)}</td>
              <td className="px-4 py-3 text-sm">{formatCurrency(totals.fees30d)}</td>
              <td className="px-4 py-3 text-sm">{formatCurrency(totals.volume24h)}</td>
              <td className="px-4 py-3 text-sm">{formatCurrency(totals.volume30d)}</td>
              <td className="px-4 py-3 text-sm">
                {totals.tvl < 100 ? (
                  <APRTooltip apr="NA" showLowTvlWarning={true} />
                ) : (
                  <APRTooltip apr={formatPercent(totals.apr)} />
                )}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}


