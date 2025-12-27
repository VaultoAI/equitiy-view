'use client';

import { Token } from '@/lib/pools/types';
import { TokenLogo } from '@/components/TokenLogo';

interface PoolDescriptionProps {
  token0: Token;
  token1: Token;
  alwaysShowBoth?: boolean; // Force showing both tokens even on mobile
}

export function PoolDescription({ token0, token1, alwaysShowBoth = false }: PoolDescriptionProps) {
  // Check if USDC is present - show only tokenized stock on mobile, both on desktop (unless alwaysShowBoth is true)
  const isToken0USDC = token0.symbol === 'USDC' || token0.symbol === 'USD Coin';
  const isToken1USDC = token1.symbol === 'USDC' || token1.symbol === 'USD Coin';
  
  // Determine which token is the non-USDC token (tokenized stock)
  const displayToken = isToken0USDC ? token1 : (isToken1USDC ? token0 : null);
  const usdcToken = isToken0USDC ? token0 : (isToken1USDC ? token1 : null);
  
  // If neither is USDC, show both tokens as before
  if (!isToken0USDC && !isToken1USDC) {
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
  
  // If alwaysShowBoth is true, always show full pair regardless of screen size
  if (alwaysShowBoth && displayToken && usdcToken) {
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
  
  // Show tokenized stock on mobile, full pair on desktop
  if (displayToken && usdcToken) {
    return (
      <div className="flex items-center gap-2">
        {/* Mobile: show only tokenized stock */}
        <div className="md:hidden flex items-center gap-2">
          <div className="relative">
            <TokenLogo token={displayToken} size={24} />
          </div>
          <span className="font-medium">
            {displayToken.symbol}
          </span>
        </div>
        
        {/* Desktop: show both tokens */}
        <div className="hidden md:flex items-center gap-2">
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
      </div>
    );
  }
  
  // Fallback (shouldn't happen, but handle edge case)
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


