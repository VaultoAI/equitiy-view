'use client';

import { useState, useMemo } from 'react';
import { TablePool, PoolSortFields, PoolTableSortState } from '@/lib/pools/types';
import { PoolTableRow } from './PoolTableRow';
import { formatCurrency, formatPercent } from '@/lib/utils/formatting';
import { sortPools } from '@/lib/pools/utils';
import { APRTooltip } from './APRTooltip';

/** Set to true to show the Fees 24h column (sortable, with diff, and in totals row). */
const SHOW_FEES_24H_COLUMN = false;

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
        volume24h: 0,
        fees30d: 0,
        volume30d: 0,
        apr: 0
      };
    }

    let totalTvl = 0;
    let totalFees24h = 0;
    let totalVolume24h = 0;
    let totalFees30d = 0;
    let totalVolume30d = 0;
    let weightedAprSum = 0;
    
    sortedPools.forEach(pool => {
      totalTvl += pool.tvl || 0;
      totalFees24h += pool.fees24h || 0;
      totalVolume24h += pool.volume24h || 0;
      totalFees30d += pool.fees30d || 0;
      totalVolume30d += pool.volume30d || 0;
      weightedAprSum += (pool.apr || 0) * (pool.tvl || 0);
    });
    
    const avgApr = totalTvl > 0 ? weightedAprSum / totalTvl : 0;
    
    return {
      tvl: totalTvl,
      fees24h: totalFees24h,
      volume24h: totalVolume24h,
      fees30d: totalFees30d,
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
            <tr className="bg-gray-100 dark:bg-gray-800">
              <th className="sticky left-0 z-10 bg-gray-100 dark:bg-gray-800 px-4 py-4 text-left text-base font-semibold rounded-tl-lg">Pool</th>
              <th className="px-4 py-4 text-left text-base font-semibold">
                <SortButton field={PoolSortFields.TVL}>TVL</SortButton>
              </th>
              {SHOW_FEES_24H_COLUMN && (
                <th className="px-4 py-4 text-left text-base font-semibold">
                  <SortButton field={PoolSortFields.Fees24h}>Fees 24h</SortButton>
                </th>
              )}
              <th className="px-4 py-4 text-left text-base font-semibold">
                <SortButton field={PoolSortFields.Volume24h}>Volume 24h</SortButton>
              </th>
              <th className="px-4 py-4 text-left text-base font-semibold">
                <SortButton field={PoolSortFields.Fees30d}>Fees 30d</SortButton>
              </th>
              <th className="px-4 py-4 text-left text-base font-semibold">
                <SortButton field={PoolSortFields.Volume30D}>Volume 30d</SortButton>
              </th>
              <th className="px-4 py-4 text-left text-base font-semibold rounded-tr-lg">
                <SortButton field={PoolSortFields.Apr}>APR</SortButton>
              </th>
            </tr>
          </thead>
          <tbody>
            {[...Array(5)].map((_, index) => (
              <tr key={index} className={index % 2 === 1 ? 'bg-gray-50 dark:bg-gray-900' : ''}>
                <td className={`sticky left-0 z-10 px-4 py-4 ${index % 2 === 1 ? 'bg-gray-50 dark:bg-gray-900' : 'bg-white dark:bg-gray-950'}`}>
                  <div className="animate-pulse">
                    <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded w-32"></div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="animate-pulse">
                    <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-20"></div>
                  </div>
                </td>
                {SHOW_FEES_24H_COLUMN && (
                  <td className="px-4 py-4">
                    <div className="animate-pulse">
                      <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-16"></div>
                    </div>
                  </td>
                )}
                <td className="px-4 py-4">
                  <div className="animate-pulse">
                    <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-20"></div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="animate-pulse">
                    <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-20"></div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="animate-pulse">
                    <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-12"></div>
                  </div>
                </td>
                <td className="px-4 py-4">
                  <div className="animate-pulse">
                    <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded w-16"></div>
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
    const isSubgraphUnavailable =
      /subgraph|indexing|indexer|bad indexers/i.test(error.message);
    return (
      <div className="flex flex-col justify-center items-center py-12 px-4">
        {isSubgraphUnavailable ? (
          <>
            <div
              className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 max-w-xl text-center"
              role="alert"
            >
              <p className="font-medium text-amber-800 dark:text-amber-200">
                Ethereum tokenized stock pools cannot be loaded
              </p>
              <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
                The Uniswap V3 subgraph (The Graph) is currently unavailable or has not been indexed. This is an external dependency—not an issue with Vaulto. Pools will appear once the subgraph is available again.
              </p>
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                <a
                  href="https://status.thegraph.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:no-underline"
                >
                  Check The Graph status
                </a>
              </p>
            </div>
            {error.message && (
              <p className="mt-3 text-xs text-gray-500 dark:text-gray-400 max-w-xl truncate" title={error.message}>
                {error.message}
              </p>
            )}
          </>
        ) : (
          <div className="text-red-500 dark:text-red-400">Error loading pools: {error.message}</div>
        )}
      </div>
    );
  }

  if (pools.length === 0) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="text-gray-500 dark:text-gray-400">No pools found</div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-100 dark:bg-gray-800">
            <th className="sticky left-0 z-10 bg-gray-100 dark:bg-gray-800 px-4 py-4 text-left text-base font-semibold rounded-tl-lg">Pool</th>
            <th className="px-4 py-4 text-left text-base font-semibold">
              <SortButton field={PoolSortFields.TVL}>TVL</SortButton>
            </th>
            {SHOW_FEES_24H_COLUMN && (
              <th className="px-4 py-4 text-left text-base font-semibold">
                <SortButton field={PoolSortFields.Fees24h}>Fees 24h</SortButton>
              </th>
            )}
            <th className="px-4 py-4 text-left text-base font-semibold">
              <SortButton field={PoolSortFields.Volume24h}>Volume 24h</SortButton>
            </th>
            <th className="px-4 py-4 text-left text-base font-semibold">
              <SortButton field={PoolSortFields.Fees30d}>Fees 30d</SortButton>
            </th>
            <th className="px-4 py-4 text-left text-base font-semibold">
              <SortButton field={PoolSortFields.Volume30D}>Volume 30d</SortButton>
            </th>
            <th className="px-4 py-4 text-left text-base font-semibold rounded-tr-lg">
              <SortButton field={PoolSortFields.Apr}>APR</SortButton>
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedPools.map((pool, index) => (
            <PoolTableRow key={pool.hash} pool={pool} showFees24hColumn={SHOW_FEES_24H_COLUMN} isAlternateRow={index % 2 === 1} />
          ))}
          {sortedPools.length > 0 && (
            <tr className="bg-gray-100 dark:bg-gray-800 font-semibold">
              <td className="sticky left-0 z-10 bg-gray-100 dark:bg-gray-800 group-hover:bg-gray-100 dark:group-hover:bg-gray-800 px-4 py-4 text-base">
                Total
              </td>
              <td className="px-4 py-4 text-base">{formatCurrency(totals.tvl)}</td>
              {SHOW_FEES_24H_COLUMN && (
                <td className="px-4 py-4 text-base">{formatCurrency(totals.fees24h)}</td>
              )}
              <td className="px-4 py-4 text-base">{formatCurrency(totals.volume24h)}</td>
              <td className="px-4 py-4 text-base">{formatCurrency(totals.fees30d)}</td>
              <td className="px-4 py-4 text-base">{formatCurrency(totals.volume30d)}</td>
              <td className="px-4 py-4 text-base">
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


