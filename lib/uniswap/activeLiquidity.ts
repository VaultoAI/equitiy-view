import JSBI from 'jsbi';
import { TickMath, tickToPrice, FeeAmount } from '@uniswap/v3-sdk';
import { Token } from '@uniswap/sdk-core';
import { PoolTick } from '@/lib/pools/types';

const Q96 = JSBI.exponentiate(JSBI.BigInt(2), JSBI.BigInt(96));

export interface LiquidityBand {
  tickLower: number;
  tickUpper: number;
  liquidityActive: JSBI;
  priceLowerUSD: number;
  priceUpperUSD: number;
  amount0: string;
  amount1: string;
  liquidityUSD: number;
}

export interface TickProcessed {
  tickIdx: number;
  liquidityActive: JSBI;
  liquidityNet: JSBI;
  price0: number;
  price1: number;
  isCurrent: boolean;
}

/**
 * Convert tick to price as a number
 */
export function tickToPriceNumber(
  token0: Token,
  token1: Token,
  tick: number
): number {
  const price = tickToPrice(token0, token1, tick);
  return parseFloat(price.toSignificant(18));
}

/**
 * Calculate locked amounts in a position using Uniswap V3 formulas
 */
export function computeLockedAmounts(
  tickLower: number,
  tickUpper: number,
  liquidity: JSBI,
  token0: Token,
  token1: Token
): { amount0: string; amount1: string } {
  const sqrtA = TickMath.getSqrtRatioAtTick(tickLower);
  const sqrtB = TickMath.getSqrtRatioAtTick(tickUpper);

  const sqrtDiff = JSBI.subtract(
    JSBI.BigInt(String(sqrtB)),
    JSBI.BigInt(String(sqrtA))
  );

  const sqrtProduct = JSBI.multiply(
    JSBI.BigInt(String(sqrtA)),
    JSBI.BigInt(String(sqrtB))
  );

  const amount0Numerator = JSBI.multiply(
    liquidity,
    JSBI.multiply(sqrtDiff, Q96)
  );
  const amount0Raw = JSBI.divide(amount0Numerator, sqrtProduct);
  const amount1Raw = JSBI.divide(JSBI.multiply(liquidity, sqrtDiff), Q96);

  const amount0Decimal =
    parseFloat(amount0Raw.toString()) /
    parseFloat(Q96.toString()) /
    Math.pow(10, token0.decimals);
  const amount1Decimal =
    parseFloat(amount1Raw.toString()) /
    parseFloat(Q96.toString()) /
    Math.pow(10, token1.decimals);

  return {
    amount0: Math.max(0, amount0Decimal).toFixed(6),
    amount1: Math.max(0, amount1Decimal).toFixed(6),
  };
}

/**
 * Convert price to USD per security token
 */
export function convertToSecurityPerUSDC(
  priceToken0PerToken1: number,
  isUSDC0: boolean
): number {
  return isUSDC0 ? 1 / priceToken0PerToken1 : priceToken0PerToken1;
}

/**
 * Process ticks to calculate active liquidity at each tick
 */
function processTicks(
  activeTickIdx: number,
  tickCurrent: number,
  poolLiquidity: JSBI,
  tickSpacing: number,
  token0: Token,
  token1: Token,
  numSurroundingTicks: number,
  tickIdxToTickDictionary: Record<string | number, PoolTick>
): TickProcessed[] {
  const processedTicks: TickProcessed[] = [];
  
  // Start from active tick and go down (below current price)
  let currentTickIdx = activeTickIdx;
  let liquidityActive = poolLiquidity;
  
  for (let i = 0; i < numSurroundingTicks; i++) {
    const tickData = tickIdxToTickDictionary[currentTickIdx];
    
    processedTicks.push({
      tickIdx: currentTickIdx,
      liquidityActive: JSBI.BigInt(liquidityActive.toString()),
      liquidityNet: tickData
        ? JSBI.BigInt(tickData.liquidityNet)
        : JSBI.BigInt(0),
      price0: tickToPriceNumber(token0, token1, currentTickIdx),
      price1: tickToPriceNumber(token1, token0, currentTickIdx),
      isCurrent: currentTickIdx <= tickCurrent && (currentTickIdx + tickSpacing) > tickCurrent,
    });
    
    // Update liquidity for next tick (going down)
    if (tickData) {
      liquidityActive = JSBI.subtract(
        liquidityActive,
        JSBI.BigInt(tickData.liquidityNet)
      );
    }
    
    currentTickIdx -= tickSpacing;
    
    if (currentTickIdx < TickMath.MIN_TICK) break;
  }
  
  // Reverse to get ascending order
  processedTicks.reverse();
  
  // Now go up from active tick (above current price)
  currentTickIdx = activeTickIdx + tickSpacing;
  liquidityActive = poolLiquidity;
  
  for (let i = 0; i < numSurroundingTicks; i++) {
    const tickData = tickIdxToTickDictionary[currentTickIdx];
    
    // Add liquidity from the tick we're crossing
    const prevTickData = tickIdxToTickDictionary[currentTickIdx - tickSpacing];
    if (prevTickData) {
      liquidityActive = JSBI.add(
        liquidityActive,
        JSBI.BigInt(prevTickData.liquidityNet)
      );
    }
    
    processedTicks.push({
      tickIdx: currentTickIdx,
      liquidityActive: JSBI.BigInt(liquidityActive.toString()),
      liquidityNet: tickData
        ? JSBI.BigInt(tickData.liquidityNet)
        : JSBI.BigInt(0),
      price0: tickToPriceNumber(token0, token1, currentTickIdx),
      price1: tickToPriceNumber(token1, token0, currentTickIdx),
      isCurrent: (currentTickIdx - tickSpacing) <= tickCurrent && currentTickIdx > tickCurrent,
    });
    
    currentTickIdx += tickSpacing;
    
    if (currentTickIdx > TickMath.MAX_TICK) break;
  }
  
  return processedTicks;
}

/**
 * Compute active liquidity bands for the pool
 */
export function computeActiveLiquidityBands(
  tickCurrent: number,
  poolLiquidity: string,
  tickSpacing: number,
  token0: Token,
  token1: Token,
  numSurroundingTicks: number,
  graphTicks: PoolTick[],
  isUSDC0: boolean
): LiquidityBand[] {
  // Build tick dictionary
  const tickIdxToTickDictionary: Record<string | number, PoolTick> = {};
  graphTicks.forEach((graphTick) => {
    tickIdxToTickDictionary[String(graphTick.tickIdx)] = graphTick;
    tickIdxToTickDictionary[Number(graphTick.tickIdx)] = graphTick;
  });

  // Calculate active tick
  let activeTickIdx = Math.floor(tickCurrent / tickSpacing) * tickSpacing;
  if (activeTickIdx <= TickMath.MIN_TICK) {
    activeTickIdx = TickMath.MIN_TICK + tickSpacing;
  }

  // Convert pool liquidity to JSBI
  const poolLiquidityJSBI = JSBI.BigInt(poolLiquidity);

  // Process ticks
  const processedTicks = processTicks(
    activeTickIdx,
    tickCurrent,
    poolLiquidityJSBI,
    tickSpacing,
    token0,
    token1,
    numSurroundingTicks,
    tickIdxToTickDictionary
  );

  // Convert to liquidity bands
  const bands: LiquidityBand[] = [];
  for (let i = 0; i < processedTicks.length - 1; i++) {
    const tickLower = processedTicks[i].tickIdx;
    const tickUpper = processedTicks[i + 1].tickIdx;
    const liquidityActive = processedTicks[i].liquidityActive;

    // Calculate prices
    const priceLower = tickToPriceNumber(token0, token1, tickLower);
    const priceUpper = tickToPriceNumber(token0, token1, tickUpper);
    const priceLowerUSD = convertToSecurityPerUSDC(priceLower, isUSDC0);
    const priceUpperUSD = convertToSecurityPerUSDC(priceUpper, isUSDC0);

    // Calculate amounts
    const { amount0, amount1 } = computeLockedAmounts(
      tickLower,
      tickUpper,
      liquidityActive,
      token0,
      token1
    );

    // Calculate USD value
    const usdcAmount = isUSDC0 ? amount0 : amount1;
    const securityAmount = isUSDC0 ? amount1 : amount0;
    const midPriceUSDPerSecurity = (priceLowerUSD + priceUpperUSD) / 2;
    const liquidityUSD =
      parseFloat(usdcAmount) +
      parseFloat(securityAmount) * midPriceUSDPerSecurity;

    bands.push({
      tickLower,
      tickUpper,
      liquidityActive,
      priceLowerUSD,
      priceUpperUSD,
      amount0,
      amount1,
      liquidityUSD,
    });
  }

  return bands;
}
