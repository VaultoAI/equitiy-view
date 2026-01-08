'use client';

import { usePoolTransactions } from '@/hooks/usePoolTransactions';
import { PoolTransaction, PoolData, Token } from '@/lib/pools/types';
import { formatCurrency } from '@/lib/utils/formatting';
import { isTokenizedStock } from '@/lib/pools/tokenizedStocks';
import { TokenLogo } from '@/components/TokenLogo';

interface PoolTransactionsTableProps {
  poolAddress: string;
  poolData?: PoolData;
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

function isCollectTransaction(tx: PoolTransaction): boolean {
  const amount0Num = parseFloat(tx.amount0);
  const amount1Num = parseFloat(tx.amount1);
  return tx.type === 'burn' && amount0Num === 0 && amount1Num === 0;
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

export function PoolTransactionsTable({ poolAddress, poolData }: PoolTransactionsTableProps) {
  const { data: transactions, loading, error } = usePoolTransactions(poolAddress, 100);

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
      <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
        Transactions
      </h3>
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
            {transactions.map((tx) => {
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
