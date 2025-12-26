'use client';

import { Token } from '@/lib/pools/types';

interface PoolDescriptionProps {
  token0: Token;
  token1: Token;
}

export function PoolDescription({ token0, token1 }: PoolDescriptionProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        <div className="w-6 h-6 rounded-full bg-gray-300 flex items-center justify-center text-xs font-semibold">
          {token0.symbol[0]}
        </div>
        <div className="w-6 h-6 rounded-full bg-gray-400 flex items-center justify-center text-xs font-semibold -ml-2">
          {token1.symbol[0]}
        </div>
      </div>
      <span className="font-medium">
        {token0.symbol}/{token1.symbol}
      </span>
    </div>
  );
}

