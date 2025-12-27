'use client';

import { useState, useMemo } from 'react';
import { TablePool, PoolSortFields, PoolTableSortState } from '@/lib/pools/types';
import { PoolTableRow } from './PoolTableRow';
import { formatCurrency, formatPercent } from '@/lib/utils/formatting';
import { sortPools } from '@/lib/pools/utils';
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
          {sortPools(pools, sortState).map((pool) => (
            <PoolTableRow key={pool.hash} pool={pool} />
          ))}
        </tbody>
      </table>
    </div>
  );
}


