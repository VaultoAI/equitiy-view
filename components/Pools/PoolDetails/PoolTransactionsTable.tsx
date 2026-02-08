'use client';

import { useMemo, useState } from 'react';
import { usePoolTransactions } from '@/hooks/usePoolTransactions';
import { PoolTransaction, PoolData, Token } from '@/lib/pools/types';
import { formatCurrency } from '@/lib/utils/formatting';
import { isTokenizedStock } from '@/lib/pools/tokenizedStocks';
import { TokenLogo } from '@/components/TokenLogo';

interface PoolTransactionsTableProps {
  poolAddress: string;
  poolData?: PoolData;
  /** Filter value: exact Type column label or 'all'. Lifted from parent so it persists across remounts. */
  typeFilter?: 'all' | string;
  onTypeFilterChange?: (value: 'all' | string) => void;
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function formatTokenAmount(amount: string, decimals: number): string {
  const num = parseFloat(amount);
  if (isNaN(num) || num === 0) return '0';
  
  // Round to 2 significant figures
  function toSignificantFigures(value: number, sigFigs: number): number {
    if (value === 0) return 0;
    const magnitude = Math.floor(Math.log10(Math.abs(value)));
    const factor = Math.pow(10, sigFigs - 1 - magnitude);
    return Math.round(value * factor) / factor;
  }
  
  const rounded = toSignificantFigures(num, 2);
  
  // Format the rounded number without scientific notation
  if (rounded < 1) {
    // For numbers less than 1, find how many decimal places we need
    // to show 2 significant figures
    if (rounded === 0) return '0';
    
    // Count leading zeros after decimal point
    const absRounded = Math.abs(rounded);
    let decimalPlaces = 0;
    let temp = absRounded;
    while (temp < 1 && temp > 0) {
      temp *= 10;
      decimalPlaces++;
    }
    // Show enough decimals to display 2 significant figures
    const totalDecimals = Math.min(decimalPlaces + 1, 18);
    return rounded.toFixed(totalDecimals).replace(/\.?0+$/, '') || '0';
  }
  
  // For numbers >= 1, use abbreviated format if large
  if (rounded >= 1e9) {
    return `${toSignificantFigures(rounded / 1e9, 2)}B`;
  }
  if (rounded >= 1e6) {
    return `${toSignificantFigures(rounded / 1e6, 2)}M`;
  }
  if (rounded >= 1e3) {
    return `${toSignificantFigures(rounded / 1e3, 2)}K`;
  }
  
  // For numbers between 1 and 1000, show as integer or with minimal decimals
  if (rounded >= 100) {
    return Math.round(rounded).toString();
  }
  if (rounded >= 10) {
    return rounded.toFixed(1).replace(/\.?0+$/, '') || '0';
  }
  
  // For numbers between 1 and 10, show 1 decimal place
  return rounded.toFixed(1).replace(/\.?0+$/, '') || '0';
}

const ZERO_AMOUNT_EPSILON = 1e-10;

function isCollectTransaction(tx: PoolTransaction): boolean {
  const amount0Num = parseFloat(tx.amount0);
  const amount1Num = parseFloat(tx.amount1);
  return (
    tx.type === 'burn' &&
    Math.abs(amount0Num) < ZERO_AMOUNT_EPSILON &&
    Math.abs(amount1Num) < ZERO_AMOUNT_EPSILON
  );
}

function getTransactionTypeLabel(
  type: PoolTransaction['type'],
  tx: PoolTransaction,
  poolData?: PoolData,
  isMobile: boolean = false
): string {
  // Check if this is a collect transaction (burn with zero amounts)
  if (isCollectTransaction(tx)) {
    return isMobile ? 'Collect' : 'Collect Fees';
  }
  
  switch (type) {
    case 'swap':
      // Check if this is a tokenized stock pool and determine buy/sell
      if (poolData) {
        const token0Address = poolData.token0.address?.toLowerCase();
        const token1Address = poolData.token1.address?.toLowerCase();
        const isToken0Stock = token0Address ? isTokenizedStock(token0Address) : false;
        const isToken1Stock = token1Address ? isTokenizedStock(token1Address) : false;
        
        if (isToken0Stock || isToken1Stock) {
          const amount0Num = parseFloat(tx.amount0);
          const amount1Num = parseFloat(tx.amount1);
          
          // In Uniswap V3, negative amount means token is being sent out (sold)
          // Positive amount means token is being received (bought)
          if (isToken0Stock) {
            // If amount0 is negative, stock (token0) is being sold
            // If amount0 is positive, stock (token0) is being bought
            if (amount0Num < 0) {
              return isMobile ? 'Sell' : 'Sell Stock';
            } else if (amount0Num > 0) {
              return isMobile ? 'Buy' : 'Buy Stock';
            }
          } else if (isToken1Stock) {
            // If amount1 is negative, stock (token1) is being sold
            // If amount1 is positive, stock (token1) is being bought
            if (amount1Num < 0) {
              return isMobile ? 'Sell' : 'Sell Stock';
            } else if (amount1Num > 0) {
              return isMobile ? 'Buy' : 'Buy Stock';
            }
          }
        }
      }
      return 'Swap';
    case 'mint':
      return isMobile ? 'Add' : 'Add Liquidity';
    case 'burn':
      return isMobile ? 'Remove' : 'Remove Liquidity';
    default:
      return type;
  }
}

function getTransactionTypeStyles(type: PoolTransaction['type'], label?: string, isCollect?: boolean): string {
  // Handle Collect transactions with blue styling
  if (isCollect || label === 'Collect' || label === 'Collect Fees') {
    return 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200';
  }
  
  // Handle Buy Stock, Buy, Sell Stock, and Sell with specific colors
  if (label === 'Buy Stock' || label === 'Buy') {
    return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200';
  }
  if (label === 'Sell Stock' || label === 'Sell') {
    return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200';
  }
  
  switch (type) {
    case 'swap':
      return 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200';
    case 'mint':
      return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200';
    case 'burn':
      return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200';
    default:
      return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200';
  }
}

function getEtherscanUrl(txHash: string): string {
  return `https://etherscan.io/tx/${txHash}`;
}

/** Filter = exact string shown in Type column, or 'all'. No mapping, no keys. */
const PILL_ORDER = ['Collect Fees', 'Buy Stock', 'Sell Stock', 'Add Liquidity', 'Remove Liquidity', 'Swap'];

/** Short labels for filter pills on mobile (match Type column mobile labels). */
const PILL_LABEL_MOBILE: Record<string, string> = {
  'Collect Fees': 'Collect',
  'Buy Stock': 'Buy',
  'Sell Stock': 'Sell',
  'Add Liquidity': 'Add',
  'Remove Liquidity': 'Remove',
  'Swap': 'Swap',
};

function getFilterPillStyles(label: string, selected: boolean): string {
  if (!selected) return 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700';
  if (label === 'Collect Fees') return 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200';
  if (label === 'Buy Stock') return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200';
  if (label === 'Sell Stock') return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200';
  if (label === 'Add Liquidity') return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200';
  if (label === 'Remove Liquidity') return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200';
  if (label === 'Swap') return 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200';
  return 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
}

export function PoolTransactionsTable({
  poolAddress,
  poolData,
  typeFilter: typeFilterProp,
  onTypeFilterChange,
}: PoolTransactionsTableProps) {
  const { data: transactions, loading, error } = usePoolTransactions(poolAddress, 1000);
  const [internalFilter, setInternalFilter] = useState<'all' | string>('all');

  // Use lifted state from parent when provided so filter persists across remounts; else internal state
  const typeFilter = typeFilterProp ?? internalFilter;
  const setTypeFilter = onTypeFilterChange ?? setInternalFilter;

  // Same label as Type column: getTransactionTypeLabel(tx.type, tx, poolData, false). One label per tx.
  const getTypeColumnLabel = (tx: PoolTransaction) => getTransactionTypeLabel(tx.type, tx, poolData, false);

  const uniqueLabels = useMemo(() => {
    if (!transactions || transactions.length === 0) return [];
    return [...new Set(transactions.map((tx) => getTransactionTypeLabel(tx.type, tx, poolData, false)))].sort(
      (a, b) => PILL_ORDER.indexOf(a) - PILL_ORDER.indexOf(b)
    ).filter((label) => label !== 'Collect Fees');
  }, [transactions, poolData]);

  // Filter: include only rows whose Type column label exactly equals typeFilter. Each tx has exactly one label.
  // Dedupe by (transactionHash, type, timestamp) so the same event is not shown twice.
  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];
    const byLabel =
      typeFilter === 'all'
        ? transactions
        : transactions.filter(
            (tx) => getTransactionTypeLabel(tx.type, tx, poolData, false) === typeFilter
          );
    const seen = new Set<string>();
    return byLabel.filter((tx) => {
      const id = `${tx.transactionHash}-${tx.type}-${tx.timestamp}`;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [transactions, typeFilter, poolData]);

  // Calculate net buy and sell volumes from swap transactions
  const { netBuyVolume, netSellVolume } = (() => {
    if (!transactions || !poolData) {
      return { netBuyVolume: 0, netSellVolume: 0 };
    }

    let buyVolume = 0;
    let sellVolume = 0;

    transactions.forEach((tx) => {
      // Only process swap transactions
      if (tx.type !== 'swap') return;

      // Determine if this is a buy or sell
      const label = getTransactionTypeLabel(tx.type, tx, poolData, false);
      const amountUSD = parseFloat(tx.amountUSD);

      if (isNaN(amountUSD) || amountUSD <= 0) return;

      if (label === 'Buy Stock' || label === 'Buy') {
        buyVolume += amountUSD;
      } else if (label === 'Sell Stock' || label === 'Sell') {
        sellVolume += amountUSD;
      }
    });

    return { netBuyVolume: buyVolume, netSellVolume: sellVolume };
  })();

  if (loading) {
    return (
      <div className="bg-gray-50 dark:bg-gray-900 p-3 md:p-6 rounded-lg mb-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
          Transactions
        </h3>
        <div className="animate-pulse">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="text-center md:text-left py-2 md:py-3 px-1 md:px-4 text-xs md:text-sm font-medium text-gray-600 dark:text-gray-400">Value</th>
                  <th className="text-center md:text-left py-2 md:py-3 px-1 md:px-4 text-xs md:text-sm font-medium text-gray-600 dark:text-gray-400">Amounts</th>
                  <th className="text-center md:text-left py-2 md:py-3 px-1 md:px-4 text-xs md:text-sm font-medium text-gray-600 dark:text-gray-400">Type</th>
                  <th className="text-center md:text-left py-2 md:py-3 px-1 md:px-4 text-xs md:text-sm font-medium text-gray-600 dark:text-gray-400 hidden md:table-cell">Date</th>
                  <th className="text-center md:text-left py-2 md:py-3 px-1 md:px-4 text-xs md:text-sm font-medium text-gray-600 dark:text-gray-400">Transaction</th>
                </tr>
              </thead>
              <tbody>
                {[...Array(5)].map((_, index) => (
                  <tr key={index} className="border-b border-gray-200 dark:border-gray-700">
                    <td className="py-2 md:py-3 px-1 md:pl-6 md:pr-5 text-center md:text-left">
                      <div className="h-3 md:h-4 bg-gray-300 dark:bg-gray-700 rounded w-24 md:w-32 mx-auto md:mx-0"></div>
                    </td>
                    <td className="py-2 md:py-3 px-1 md:px-5 text-center md:text-left">
                      <div className="h-5 md:h-6 bg-gray-300 dark:bg-gray-700 rounded w-16 md:w-20 mx-auto md:mx-0"></div>
                    </td>
                    <td className="py-2 md:py-3 px-1 md:px-5 text-center md:text-left">
                      <div className="h-3 md:h-4 bg-gray-300 dark:bg-gray-700 rounded w-20 md:w-24 mx-auto md:mx-0"></div>
                    </td>
                    <td className="py-2 md:py-3 px-1 md:px-5 text-center md:text-left">
                      <div className="h-3 md:h-4 bg-gray-300 dark:bg-gray-700 rounded w-24 md:w-32 mx-auto md:mx-0"></div>
                    </td>
                    <td className="py-2 md:py-3 px-1 md:pl-5 md:pr-6 text-center md:text-left">
                      <div className="h-3 md:h-4 bg-gray-300 dark:bg-gray-700 rounded w-12 md:w-16 mx-auto md:mx-0"></div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-50 dark:bg-gray-900 p-3 md:p-6 rounded-lg mb-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
          Transactions
        </h3>
        <div className="text-center py-8 text-red-500">
          Error loading transactions: {error.message}
        </div>
      </div>
    );
  }

  if (!transactions || transactions.length === 0) {
    return (
      <div className="bg-gray-50 dark:bg-gray-900 p-3 md:p-6 rounded-lg mb-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
          Transactions
        </h3>
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          No transactions found
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-900 p-3 md:p-6 rounded-lg mb-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-4 mb-4">
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Transactions
          </h3>
          <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
            <button
              type="button"
              onClick={() => setTypeFilter('all')}
              aria-pressed={typeFilter === 'all'}
              className={`inline-flex items-center px-2 md:px-3 py-1 md:py-1.5 rounded text-xs md:text-sm font-medium transition-colors ${
                typeFilter === 'all'
                  ? 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              All
            </button>
            {uniqueLabels.map((label) => {
              const isSelected = typeFilter === label;
              const displayLabel = PILL_LABEL_MOBILE[label] ?? label;
              return (
                <button
                  key={label}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setTypeFilter(label)}
                  className={`inline-flex items-center px-2 md:px-3 py-1 md:py-1.5 rounded text-xs md:text-sm font-medium transition-colors ${getFilterPillStyles(label, isSelected)}`}
                >
                  {displayLabel}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-2 md:gap-3">
          {netBuyVolume > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs md:text-sm text-gray-600 dark:text-gray-400">Net Buy:</span>
              <span className="inline-flex items-center px-2 md:px-3 py-1 md:py-1.5 rounded text-xs md:text-sm font-semibold bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                {formatCurrency(netBuyVolume)}
              </span>
            </div>
          )}
          {netSellVolume > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs md:text-sm text-gray-600 dark:text-gray-400">Net Sell:</span>
              <span className="inline-flex items-center px-2 md:px-3 py-1 md:py-1.5 rounded text-xs md:text-sm font-semibold bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200">
                {formatCurrency(netSellVolume)}
              </span>
            </div>
          )}
        </div>
      </div>
      {typeFilter !== 'all' && filteredTransactions.length === 0 && (
        <p className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm mb-2">
          No {typeFilter.toLowerCase()} transactions
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-center md:text-left py-2 md:py-3 px-1 md:pl-6 md:pr-5 text-xs md:text-sm font-medium text-gray-600 dark:text-gray-400">
                Value
              </th>
              <th className="text-center md:text-left py-2 md:py-3 px-1 md:px-5 text-xs md:text-sm font-medium text-gray-600 dark:text-gray-400">
                Amounts
              </th>
              <th className="text-center md:text-left py-2 md:py-3 px-1 md:px-5 text-xs md:text-sm font-medium text-gray-600 dark:text-gray-400">
                Type
              </th>
              <th className="text-center md:text-left py-2 md:py-3 px-1 md:px-5 text-xs md:text-sm font-medium text-gray-600 dark:text-gray-400 hidden md:table-cell">
                Date
              </th>
              <th className="text-center md:text-left py-2 md:py-3 px-1 md:pl-5 md:pr-6 text-xs md:text-sm font-medium text-gray-600 dark:text-gray-400">
                Transaction
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredTransactions.map((tx) => {
              const amount0Num = parseFloat(tx.amount0);
              const amount1Num = parseFloat(tx.amount1);
              const amount0Formatted = formatTokenAmount(tx.amount0, tx.token0Decimals);
              const amount1Formatted = formatTokenAmount(tx.amount1, tx.token1Decimals);
              const amountUSDNum = parseFloat(tx.amountUSD);

              return (
                <tr
                  key={`${tx.type}-${tx.transactionHash}-${tx.timestamp}`}
                  className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <td className="py-2 md:py-3 px-1 md:pl-6 md:pr-5 text-center md:text-left text-xs md:text-base font-bold text-gray-900 dark:text-gray-100">
                    {amountUSDNum > 0 ? formatCurrency(amountUSDNum) : '—'}
                  </td>
                  <td className="py-2 md:py-3 px-1 md:px-5 text-center md:text-left text-xs md:text-sm text-gray-900 dark:text-gray-100">
                    {(() => {
                      const isCollect = isCollectTransaction(tx);
                      return (
                        <div className="flex flex-col md:flex-col gap-0.5 md:gap-1 items-center md:items-start">
                          {amount0Num !== 0 && (
                            <div className="flex items-center gap-0.5 md:gap-2 min-w-0 justify-center md:justify-start">
                              {poolData && (
                                <TokenLogo 
                                  token={poolData.token0} 
                                  size={14}
                                  className="flex-shrink-0 md:w-5 md:h-5"
                                />
                              )}
                              <span className="truncate whitespace-nowrap text-xs">
                                {amount0Formatted} {tx.token0Symbol}
                              </span>
                            </div>
                          )}
                          {amount1Num !== 0 && (
                            <div className="flex items-center gap-0.5 md:gap-2 min-w-0 justify-center md:justify-start">
                              {poolData && (
                                <TokenLogo 
                                  token={poolData.token1} 
                                  size={14}
                                  className="flex-shrink-0 md:w-5 md:h-5"
                                />
                              )}
                              <span className="truncate whitespace-nowrap text-xs">
                                {amount1Formatted} {tx.token1Symbol}
                              </span>
                            </div>
                          )}
                          {amount0Num === 0 && amount1Num === 0 && !isCollect && (
                            <span className="text-gray-400 dark:text-gray-500 text-xs">—</span>
                          )}
                          {isCollect && (
                            <span className="text-gray-500 dark:text-gray-400 text-xs italic">
                              Click View to see details on Etherscan
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="py-2 md:py-3 px-1 md:px-5 text-center md:text-left">
                    {(() => {
                      const isCollect = isCollectTransaction(tx);
                      const labelMobile = getTransactionTypeLabel(tx.type, tx, poolData, true);
                      const labelDesktop = getTransactionTypeLabel(tx.type, tx, poolData, false);
                      return (
                        <span
                          className={`inline-flex items-center justify-center md:justify-start px-1 md:px-3 py-0.5 md:py-1.5 rounded text-xs md:text-sm font-medium whitespace-nowrap ${getTransactionTypeStyles(tx.type, labelDesktop, isCollect)}`}
                        >
                          <span className="md:hidden">{labelMobile}</span>
                          <span className="hidden md:inline">{labelDesktop}</span>
                        </span>
                      );
                    })()}
                  </td>
                  <td className="py-2 md:py-3 px-1 md:px-5 text-center md:text-left text-xs md:text-sm text-gray-900 dark:text-gray-100 hidden md:table-cell">
                    {formatDate(tx.timestamp)}
                  </td>
                  <td className="py-2 md:py-3 px-1 md:pl-5 md:pr-6 text-center md:text-left">
                    <a
                      href={getEtherscanUrl(tx.transactionHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center px-1 md:px-3 py-0.5 md:py-1.5 rounded bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      View
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
