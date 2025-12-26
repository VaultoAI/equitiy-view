import { Token, CurrencyAmount, Percent } from '@uniswap/sdk-core';
import { Pool, Position, nearestUsableTick, TICK_SPACINGS, FeeAmount } from '@uniswap/v3-sdk';
import { Token as PoolToken } from '@/lib/pools/types';

export interface CreatePositionParams {
  tokenA: PoolToken;
  tokenB: PoolToken;
  amountA: string;
  amountB: string;
  feeTier?: number;
  tickLower?: number;
  tickUpper?: number;
}

export function createPoolToken(token: PoolToken, chainId: number): Token {
  return new Token(
    chainId,
    token.address,
    token.decimals,
    token.symbol,
    token.name
  );
}

export function getFeeAmount(feeTier?: number): FeeAmount {
  if (!feeTier) return FeeAmount.LOW;
  
  // Map common fee tiers to FeeAmount enum
  if (feeTier === 500) return FeeAmount.LOWEST;
  if (feeTier === 3000) return FeeAmount.LOW;
  if (feeTier === 10000) return FeeAmount.MEDIUM;
  return FeeAmount.HIGH;
}

export function calculateTicks(
  currentPrice: number,
  lowerPrice?: number,
  upperPrice?: number
): { tickLower: number; tickUpper: number } {
  const feeAmount = FeeAmount.LOW;
  const tickSpacing = TICK_SPACINGS[feeAmount];
  
  // If no price range specified, use full range
  if (!lowerPrice && !upperPrice) {
    return {
      tickLower: nearestUsableTick(-887272, tickSpacing),
      tickUpper: nearestUsableTick(887272, tickSpacing),
    };
  }

  // Calculate ticks from prices
  // This is simplified - in production you'd use proper price to tick conversion
  const tickLower = lowerPrice
    ? nearestUsableTick(Math.floor(Math.log(lowerPrice / currentPrice) * 1e18), tickSpacing)
    : nearestUsableTick(-887272, tickSpacing);
  
  const tickUpper = upperPrice && upperPrice !== Infinity
    ? nearestUsableTick(Math.floor(Math.log(upperPrice / currentPrice) * 1e18), tickSpacing)
    : nearestUsableTick(887272, tickSpacing);

  return { tickLower, tickUpper };
}

