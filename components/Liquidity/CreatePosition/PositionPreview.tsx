'use client';

import { Token } from '@/lib/pools/types';
import { formatCurrency } from '@/lib/utils/formatting';

interface PositionPreviewProps {
  tokenA: Token | null;
  tokenB: Token | null;
  amountA: string;
  amountB: string;
  feeTier?: number;
  estimatedUSD?: number;
}

export function PositionPreview({
  tokenA,
  tokenB,
  amountA,
  amountB,
  feeTier,
  estimatedUSD,
}: PositionPreviewProps) {
  if (!tokenA || !tokenB || !amountA || !amountB) {
    return null;
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg mb-4">
      <h3 className="font-semibold mb-3">Position Preview</h3>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Token A:</span>
          <span className="font-medium">
            {amountA} {tokenA.symbol}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Token B:</span>
          <span className="font-medium">
            {amountB} {tokenB.symbol}
          </span>
        </div>
        {feeTier && (
          <div className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">Fee Tier:</span>
            <span className="font-medium">{feeTier / 10000}%</span>
          </div>
        )}
        {estimatedUSD && (
          <div className="flex justify-between pt-2 border-t">
            <span className="text-gray-600 dark:text-gray-400">Estimated Value:</span>
            <span className="font-semibold">{formatCurrency(estimatedUSD)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

