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
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="block text-sm font-medium">{tokenA?.symbol || 'Token A'}</label>
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
            className="flex-1 px-4 py-3 border rounded-lg"
          />
          <button
            onClick={handleMaxA}
            className="px-4 py-3 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            MAX
          </button>
        </div>
      </div>
      <div>
        <div className="flex justify-between items-center mb-2">
          <label className="block text-sm font-medium">{tokenB?.symbol || 'Token B'}</label>
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
            className="flex-1 px-4 py-3 border rounded-lg"
          />
          <button
            onClick={handleMaxB}
            className="px-4 py-3 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
          >
            MAX
          </button>
        </div>
      </div>
    </div>
  );
}

