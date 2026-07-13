'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Token } from '@/lib/pools/types';
import { useTokenLogo } from '@/hooks/useTokenLogo';
import { getSolanaTokenLogoUrl } from '@/lib/utils/solanaTokenLogo';

interface TokenLogoProps {
  token: Token;
  size?: number;
  className?: string;
}

/**
 * Reusable component for displaying token logos with fallback handling
 */
export function TokenLogo({ token, size = 24, className = '' }: TokenLogoProps) {
  const isSolana = token.chain === 'SOLANA';
  const solanaLogoUrl = isSolana ? getSolanaTokenLogoUrl(token.address) : null;

  // EVM chains resolve logos from TrustWallet by chain id (BSC = 56, else Ethereum).
  const evmChainId = token.chain === 'BSC' ? 56 : 1;

  const { logoUrl: ethereumLogoUrl, isLoading } = useTokenLogo({
    tokenAddress: token.address,
    chainId: evmChainId,
    enabled: !!token.address && !isSolana,
  });

  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Use Solana logo URL if available, otherwise use Ethereum logo URL
  const logoUrl = isSolana ? solanaLogoUrl : ethereumLogoUrl;

  // Fallback to showing first letter of symbol if no logo or error
  const showFallback = !logoUrl || imageError || (isLoading && !isSolana);

  const handleImageError = () => {
    setImageError(true);
  };

  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  if (showFallback) {
    return (
      <div
        className={`rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-xs font-semibold ${className}`}
        style={{ width: size, height: size, minWidth: size, minHeight: size }}
      >
        {token.symbol?.[0]?.toUpperCase() || '?'}
      </div>
    );
  }

  return (
    <div
      className={`relative rounded-full overflow-hidden flex-shrink-0 ${className}`}
      style={{ width: size, height: size, minWidth: size, minHeight: size }}
    >
      {!imageLoaded && (
        <div className="absolute inset-0 bg-gray-300 dark:bg-gray-600 animate-pulse" />
      )}
      <Image
        src={logoUrl}
        alt={`${token.symbol} logo`}
        width={size}
        height={size}
        className={`rounded-full ${imageLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-200`}
        onError={handleImageError}
        onLoad={handleImageLoad}
        unoptimized // TrustWallet assets are already optimized
      />
    </div>
  );
}

