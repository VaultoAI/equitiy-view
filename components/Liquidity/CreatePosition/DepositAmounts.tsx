'use client';

import { useRef, useEffect, useMemo } from 'react';
import { Token } from '@/lib/pools/types';
import { useTokenBalances } from '@/hooks/useTokenBalances';
import { useTokenPrices } from '@/hooks/useTokenPrices';
import { TokenLogo } from '@/components/TokenLogo';

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
  
  // Track which input was last changed to prevent circular updates
  const lastChangedRef = useRef<'A' | 'B' | null>(null);
  const isSyncingRef = useRef(false);

  const balanceA = tokenA ? balanceMap[tokenA.address.toLowerCase()]?.balance || 0 : 0;
  const balanceB = tokenB ? balanceMap[tokenB.address.toLowerCase()]?.balance || 0 : 0;

  // Memoize token addresses array to prevent unnecessary refetches
  // Only recompute when tokenA or tokenB actually changes
  const tokenAddresses = useMemo(() => {
    const addresses: string[] = [];
    if (tokenA?.address) {
      addresses.push(tokenA.address);
    }
    if (tokenB?.address) {
      addresses.push(tokenB.address);
    }
    return addresses;
  }, [tokenA?.address, tokenB?.address]);

  const { prices, loading: pricesLoading } = useTokenPrices({
    tokenAddresses,
    enabled: !!tokenA && !!tokenB,
  });

  const priceA = tokenA ? prices.get(tokenA.address.toLowerCase()) ?? null : null;
  const priceB = tokenB ? prices.get(tokenB.address.toLowerCase()) ?? null : null;

  // Synchronize amounts when one changes
  useEffect(() => {
    if (isSyncingRef.current) return;
    if (!tokenA || !tokenB || !priceA || !priceB) return;
    if (pricesLoading) return;
    if (!lastChangedRef.current) return; // Don't sync if no input has been changed yet

    const numAmountA = parseFloat(amountA);
    const numAmountB = parseFloat(amountB);

    // Skip if the changed amount is empty or invalid
    if (lastChangedRef.current === 'A' && (isNaN(numAmountA) || numAmountA <= 0)) {
      // If amountA is cleared, also clear amountB
      if (amountA === '' || amountA === '0') {
        if (amountB !== '') {
          isSyncingRef.current = true;
          onAmountBChange('');
          setTimeout(() => {
            isSyncingRef.current = false;
          }, 0);
        }
      }
      return;
    }

    if (lastChangedRef.current === 'B' && (isNaN(numAmountB) || numAmountB <= 0)) {
      // If amountB is cleared, also clear amountA
      if (amountB === '' || amountB === '0') {
        if (amountA !== '') {
          isSyncingRef.current = true;
          onAmountAChange('');
          setTimeout(() => {
            isSyncingRef.current = false;
          }, 0);
        }
      }
      return;
    }

    isSyncingRef.current = true;

    try {
      if (lastChangedRef.current === 'A' && !isNaN(numAmountA) && numAmountA > 0) {
        // Calculate amountB based on amountA
        const usdValueA = numAmountA * priceA;
        const calculatedAmountB = usdValueA / priceB;
        
        // Only update if the calculated value is significantly different (avoid infinite loops)
        const currentAmountB = isNaN(numAmountB) ? 0 : numAmountB;
        if (Math.abs(calculatedAmountB - currentAmountB) > 0.000001) {
          onAmountBChange(calculatedAmountB.toFixed(6));
        }
      } else if (lastChangedRef.current === 'B' && !isNaN(numAmountB) && numAmountB > 0) {
        // Calculate amountA based on amountB
        const usdValueB = numAmountB * priceB;
        const calculatedAmountA = usdValueB / priceA;
        
        // Only update if the calculated value is significantly different (avoid infinite loops)
        const currentAmountA = isNaN(numAmountA) ? 0 : numAmountA;
        if (Math.abs(calculatedAmountA - currentAmountA) > 0.000001) {
          onAmountAChange(calculatedAmountA.toFixed(6));
        }
      }
    } finally {
      // Reset sync flag after a short delay to allow state updates to propagate
      setTimeout(() => {
        isSyncingRef.current = false;
      }, 0);
    }
  }, [amountA, amountB, priceA, priceB, tokenA, tokenB, pricesLoading, onAmountAChange, onAmountBChange]);

  const handleAmountAChange = (value: string) => {
    lastChangedRef.current = 'A';
    onAmountAChange(value);
  };

  const handleAmountBChange = (value: string) => {
    lastChangedRef.current = 'B';
    onAmountBChange(value);
  };

  const handleMaxA = () => {
    lastChangedRef.current = 'A';
    onAmountAChange(balanceA.toString());
  };

  const handleMaxB = () => {
    lastChangedRef.current = 'B';
    onAmountBChange(balanceB.toString());
  };

  return (
    <div>
      <div className="flex flex-col md:flex-row gap-4">
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 p-4 flex-1">
          <div className="mb-4">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-3">
                {tokenA && <TokenLogo token={tokenA} size={40} />}
                <div>
                  <div className="font-medium text-lg">{tokenA?.name || tokenA?.symbol || 'Token A'}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                    <span>{tokenA?.symbol || ''}</span>
                    {tokenA && (
                      <span className="text-xs text-gray-500 dark:text-gray-500">
                        {tokenA.address.slice(0, 6)}...{tokenA.address.slice(-4)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  Balance: {balanceA.toFixed(4)}
                </div>
                {priceA && (
                  <div className="text-xs text-gray-500 dark:text-gray-500">
                    ${priceA.toFixed(2)} USD
                  </div>
                )}
              </div>
            </div>
          </div>
        <div className="flex gap-2">
          <input
            type="number"
            value={amountA}
            onChange={(e) => handleAmountAChange(e.target.value)}
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
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 p-4 flex-1">
        <div className="mb-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-3">
              {tokenB && <TokenLogo token={tokenB} size={40} />}
              <div>
                <div className="font-medium text-lg">{tokenB?.name || tokenB?.symbol || 'Token B'}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                  <span>{tokenB?.symbol || ''}</span>
                  {tokenB && (
                    <span className="text-xs text-gray-500 dark:text-gray-500">
                      {tokenB.address.slice(0, 6)}...{tokenB.address.slice(-4)}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-600 dark:text-gray-400">
                Balance: {balanceB.toFixed(4)}
              </div>
              {priceB && (
                <div className="text-xs text-gray-500 dark:text-gray-500">
                  ${priceB.toFixed(2)} USD
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <input
            type="number"
            value={amountB}
            onChange={(e) => handleAmountBChange(e.target.value)}
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
      {pricesLoading && (
        <div className="flex justify-center mt-2">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-24"></div>
          </div>
        </div>
      )}
      {(!priceA || !priceB) && !pricesLoading && tokenA && tokenB && (
        <div className="text-xs text-yellow-600 dark:text-yellow-400 text-center mt-2">
          Unable to fetch prices. Amounts may not be synchronized.
        </div>
      )}
    </div>
  );
}


