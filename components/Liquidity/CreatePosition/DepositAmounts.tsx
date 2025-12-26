'use client';

import { Token } from '@/lib/pools/types';
import { useTokenBalances } from '@/hooks/useTokenBalances';

interface DepositAmountsProps {
  tokenA: Token | null;
  tokenB: Token | null;
  amountA: string;
  amountB: string;
  onAmountAChange: (amount: string) => void;
  onAmountBChange: (amount: string) => void;
}

export function DepositAmounts({
  tokenA,
  tokenB,
  amountA,
  amountB,
  onAmountAChange,
  onAmountBChange,
}: DepositAmountsProps) {
  const { balanceMap } = useTokenBalances();

  const balanceA = tokenA ? balanceMap[tokenA.address.toLowerCase()]?.balance || 0 : 0;
  const balanceB = tokenB ? balanceMap[tokenB.address.toLowerCase()]?.balance || 0 : 0;

  const handleMaxA = () => {
    onAmountAChange(balanceA.toString());
  };

  const handleMaxB = () => {
    onAmountBChange(balanceB.toString());
  };

  return (
    <div className="space-y-4">
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 p-4">
        <div className="mb-4">
          <div className="font-medium text-lg mb-1">{tokenA?.symbol || 'Token A'}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">{tokenA?.name || ''}</div>
          <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            {tokenA ? `${tokenA.address.slice(0, 6)}...${tokenA.address.slice(-4)}` : ''}
          </div>
        </div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-gray-600 dark:text-gray-400">
            Balance: {balanceA.toFixed(4)}
          </span>
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            value={amountA}
            onChange={(e) => onAmountAChange(e.target.value)}
            placeholder="0.0"
            className="flex-1 px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
          <button
            onClick={handleMaxA}
            className="px-4 py-3 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors"
          >
            MAX
          </button>
        </div>
      </div>
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 p-4">
        <div className="mb-4">
          <div className="font-medium text-lg mb-1">{tokenB?.symbol || 'Token B'}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">{tokenB?.name || ''}</div>
          <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            {tokenB ? `${tokenB.address.slice(0, 6)}...${tokenB.address.slice(-4)}` : ''}
          </div>
        </div>
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-gray-600 dark:text-gray-400">
            Balance: {balanceB.toFixed(4)}
          </span>
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            value={amountB}
            onChange={(e) => onAmountBChange(e.target.value)}
            placeholder="0.0"
            className="flex-1 px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
          <button
            onClick={handleMaxB}
            className="px-4 py-3 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors"
          >
            MAX
          </button>
        </div>
      </div>
    </div>
  );
}


