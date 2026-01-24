import { TickMath, tickToPrice, FeeAmount, TICK_SPACINGS } from '@uniswap/v3-sdk'
import { Token } from '@uniswap/sdk-core'
import JSBI from 'jsbi'

// Q96 fixed-point constant (2^96)
const Q96 = JSBI.exponentiate(JSBI.BigInt(2), JSBI.BigInt(96))

/**
 * Convert tick to price (token0 per token1)
 * Handles JSBI compatibility and error cases
 */
export function tickToPriceNumber(
  token0: Token,
  token1: Token,
  tick: number
): number {
  try {
    const tickNumber = Number(tick)
    if (isNaN(tickNumber)) {
      console.error('Invalid tick value:', tick)
      return 0
    }
    
    const price = tickToPrice(token0, token1, tickNumber)
    return parseFloat(price.toSignificant(18))
  } catch (error) {
    console.error('Error in tickToPriceNumber:', error, { 
      token0: token0.symbol, 
      token1: token1.symbol, 
      tick 
    })
    return 0
  }
}

/**
 * Compute locked token amounts for a tick band using canonical Uniswap V3 formulas
 * 
 * Mathematical Foundation:
 * - amount0 = L * (√P_upper - √P_lower) / (√P_lower * √P_upper)
 * - amount1 = L * (√P_upper - √P_lower)
 * 
 * Where:
 * - L = liquidity (uint128 format)
 * - √P = sqrt price ratio (Q96 fixed-point format)
 * - Q96 = 2^96 (scaling factor)
 * 
 * Implementation Notes:
 * - All calculations use JSBI to avoid floating-point errors
 * - sqrtRatioAtTick returns Q96 format values
 * - Final amounts are adjusted by token decimals
 */
export function computeLockedAmounts(
  tickLower: number,
  tickUpper: number,
  liquidity: JSBI,
  token0: Token,
  token1: Token
): { amount0: string; amount1: string } {
  // Get sqrt ratios at ticks (in Q96 format)
  const sqrtA_SDK = TickMath.getSqrtRatioAtTick(tickLower)
  const sqrtB_SDK = TickMath.getSqrtRatioAtTick(tickUpper)
  
  // Convert SDK JSBI to our JSBI via string conversion (handles version differences)
  const sqrtA = JSBI.BigInt(String(sqrtA_SDK))
  const sqrtB = JSBI.BigInt(String(sqrtB_SDK))

  // Calculate sqrtB - sqrtA (in Q96 format)
  const sqrtDiff = JSBI.subtract(sqrtB, sqrtA)

  // Calculate amount0:
  // amount0 = (L * (√B - √A) * Q96) / (√A * √B)
  const sqrtProduct = JSBI.multiply(sqrtA, sqrtB)
  const amount0Numerator = JSBI.multiply(liquidity, JSBI.multiply(sqrtDiff, Q96))
  const amount0Raw = JSBI.divide(amount0Numerator, sqrtProduct)

  // Calculate amount1:
  // amount1 = (L * (√B - √A)) / Q96
  const amount1Raw = JSBI.divide(
    JSBI.multiply(liquidity, sqrtDiff),
    Q96
  )

  // Convert JSBI to decimal numbers with proper scaling
  const amount0RawNumber = parseFloat(amount0Raw.toString())
  const amount1RawNumber = parseFloat(amount1Raw.toString())
  
  // Adjust by token decimals only (Q96 scaling is already handled in the JSBI calculations)
  const amount0Decimal = amount0RawNumber / Math.pow(10, token0.decimals)
  const amount1Decimal = amount1RawNumber / Math.pow(10, token1.decimals)

  return {
    amount0: Math.max(0, amount0Decimal).toFixed(6),
    amount1: Math.max(0, amount1Decimal).toFixed(6),
  }
}

/**
 * Get tick spacing from fee tier
 * Fee tiers: 100 (0.01%), 500 (0.05%), 3000 (0.3%), 10000 (1%)
 */
export function getTickSpacing(fee: number): number {
  const feeAmount = fee as FeeAmount
  return TICK_SPACINGS[feeAmount] || 60
}

/**
 * Format price band as string
 */
export function formatPriceBand(
  priceLower: number,
  priceUpper: number
): string {
  return `$${priceLower.toFixed(2)} – $${priceUpper.toFixed(2)}`
}

/**
 * Get mid-price for a tick band
 */
export function getBandMidPrice(tickLower: number, tickUpper: number): number {
  return (tickLower + tickUpper) / 2
}

/**
 * Convert price to "security token per USDC" format
 * 
 * Example: If pool is USDC/SLVon and price is 10 USDC per SLVon,
 * this returns 0.1 SLVon per USDC
 * 
 * @param priceToken0PerToken1 - Raw price from Uniswap (token0 per token1)
 * @param isUSDC0 - True if USDC is token0
 */
export function convertToSecurityPerUSDC(
  priceToken0PerToken1: number,
  isUSDC0: boolean
): number {
  // If USDC is token0: price = USDC per security, we want security per USDC
  // If USDC is token1: price = security per USDC (already correct)
  return isUSDC0 ? 1 / priceToken0PerToken1 : priceToken0PerToken1
}

/**
 * Convert price to "USD per security" format (for liquidity calculations)
 */
export function convertToUSDPrice(
  priceToken0PerToken1: number,
  isUSDC0: boolean
): number {
  return isUSDC0 ? priceToken0PerToken1 : 1 / priceToken0PerToken1
}
