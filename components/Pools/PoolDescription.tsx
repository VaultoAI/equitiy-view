'use client';

import { Token } from '@/lib/pools/types';
import { TokenLogo } from '@/components/TokenLogo';

interface PoolDescriptionProps {
  token0: Token;
  token1: Token;
}

export function PoolDescription({ token0, token1 }: PoolDescriptionProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        <div className="relative">
          <TokenLogo token={token0} size={24} />
        </div>
        <div className="relative -ml-2">
          <TokenLogo token={token1} size={24} />
        </div>
      </div>
      <span className="font-medium">
        {token0.symbol}/{token1.symbol}
      </span>
    </div>
  );
}


