import { FeeAmount, TickMath, tickToPrice } from '@uniswap/v3-sdk'
import { Token } from '@uniswap/sdk-core'
import JSBI from 'jsbi'
import { GraphTick, TickProcessed, LiquidityBand } from '../types'
import { PoolTick } from '../pools/types'
import {
  computeLockedAmounts,
  tickToPriceNumber,
  convertToSecurityPerUSDC,
} from './math'

const MAX_TICK = TickMath.MAX_TICK
const MIN_TICK = TickMath.MIN_TICK

// Type that supports both GraphTick (string tickIdx) and PoolTick (number tickIdx)
type CompatibleTick = GraphTick | PoolTick

/**
 * Compute active liquidity per tick band
 * 
 * This is the CORE algorithm that calculates how much liquidity is available
 * for trading at each price level.
 * 
 * Algorithm Overview:
 * 1. Start at current price tick with pool's current liquidity
 * 2. Traverse ticks upward/downward from current position
 * 3. At each initialized tick, adjust liquidity by liquidityNet
 *    - Ascending: ADD liquidityNet (more positions become active)
 *    - Descending: SUBTRACT liquidityNet (positions become inactive)
 * 4. Create bands between consecutive ticks
 * 5. Calculate USD value for each band
 * 
 * @param tickCurrent - Current price tick from pool
 * @param poolLiquidity - Current active liquidity (from pool.liquidity()) - can be string or JSBI
 * @param tickSpacing - Tick spacing (depends on fee tier)
 * @param token0 - Token 0 object (with decimals, symbol)
 * @param token1 - Token 1 object (with decimals, symbol)
 * @param numSurroundingTicks - How many ticks to process above/below current
 * @param graphTicks - All initialized ticks from subgraph
 * @param isUSDC0 - True if USDC is token0
 * @returns Array of liquidity bands with USD values
 */
export function computeActiveLiquidityBands(
  tickCurrent: number,
  poolLiquidity: JSBI | string,
  tickSpacing: number,
  token0: Token,
  token1: Token,
  numSurroundingTicks: number,
  graphTicks: CompatibleTick[],
  isUSDC0: boolean
): LiquidityBand[] {
  // Build tick dictionary for O(1) lookup
  const tickIdxToTickDictionary: Record<string | number, CompatibleTick> = {}
  graphTicks.forEach((graphTick) => {
    const tickIdx = typeof graphTick.tickIdx === 'string' 
      ? graphTick.tickIdx 
      : String(graphTick.tickIdx)
    const tickIdxNum = typeof graphTick.tickIdx === 'number'
      ? graphTick.tickIdx
      : parseInt(graphTick.tickIdx)
    
    // Store both string and number keys for compatibility
    tickIdxToTickDictionary[tickIdx] = graphTick
    tickIdxToTickDictionary[tickIdxNum] = graphTick
  })

  // Calculate active tick index (aligned to tick spacing)
  let activeTickIdx = Math.floor(tickCurrent / tickSpacing) * tickSpacing

  // Edge case: if at minimum tick, wrap to maximum
  if (activeTickIdx <= MIN_TICK) {
    activeTickIdx = MAX_TICK
  }

  // Convert pool liquidity to JSBI if it's a string
  const poolLiquidityJSBI = typeof poolLiquidity === 'string' 
    ? JSBI.BigInt(poolLiquidity) 
    : poolLiquidity

  // Process ticks to compute active liquidity at each position
  const processedTicks = processTicks(
    activeTickIdx,
    tickCurrent,
    poolLiquidityJSBI,
    tickSpacing,
    token0,
    token1,
    numSurroundingTicks,
    tickIdxToTickDictionary
  )

  // Convert processed ticks to liquidity bands
  const bands: LiquidityBand[] = []

  for (let i = 0; i < processedTicks.length - 1; i++) {
    const tickLower = processedTicks[i].tickIdx
    const tickUpper = processedTicks[i + 1].tickIdx
    const liquidityActive = processedTicks[i].liquidityActive

    // Compute prices at tick boundaries (token0 per token1)
    const priceLower = tickToPriceNumber(token0, token1, tickLower)
    const priceUpper = tickToPriceNumber(token0, token1, tickUpper)

    // Convert to "security per USDC" for chart display
    const priceLowerSecurityPerUSDC = convertToSecurityPerUSDC(priceLower, isUSDC0)
    const priceUpperSecurityPerUSDC = convertToSecurityPerUSDC(priceUpper, isUSDC0)
    
    // Also compute "USD per security" for liquidity USD calculation
    const priceLowerUSDPerSecurity = isUSDC0 ? priceLower : 1 / priceLower
    const priceUpperUSDPerSecurity = isUSDC0 ? priceUpper : 1 / priceUpper

    // Compute locked token amounts using canonical formulas
    const { amount0, amount1 } = computeLockedAmounts(
      tickLower,
      tickUpper,
      liquidityActive,
      token0,
      token1
    )

    // Determine which token is USDC and which is security
    const usdcAmount = isUSDC0 ? amount0 : amount1
    const securityAmount = isUSDC0 ? amount1 : amount0

    // Compute total USD value of liquidity in this band
    // Formula: USDC amount + (security amount × USD per security)
    const midPriceUSDPerSecurity = (priceLowerUSDPerSecurity + priceUpperUSDPerSecurity) / 2
    const usdcValue = parseFloat(usdcAmount)
    const securityValue = parseFloat(securityAmount) * midPriceUSDPerSecurity
    const liquidityUSD = usdcValue + securityValue

    // Create band object
    bands.push({
      tickLower,
      tickUpper,
      liquidityActive,
      priceLowerUSD: priceLowerSecurityPerUSDC,
      priceUpperUSD: priceUpperSecurityPerUSDC,
      amount0,
      amount1,
      liquidityUSD,
    })
  }

  return bands
}

/**
 * Process ticks to compute active liquidity
 * 
 * Creates a TickProcessed entry for each tick, starting from the active tick
 * and traversing both upward and downward.
 */
function processTicks(
  activeTickIdx: number,
  tickCurrent: number,
  poolLiquidity: JSBI,
  tickSpacing: number,
  token0: Token,
  token1: Token,
  numSurroundingTicks: number,
  tickIdxToTickDictionary: Record<string, CompatibleTick>
): TickProcessed[] {
  // Create active tick entry with current pool liquidity
  const activeTickProcessed: TickProcessed = {
    tickIdx: activeTickIdx,
    liquidityActive: poolLiquidity,
    liquidityNet: JSBI.BigInt(0),
    price0: tickToPriceNumber(token0, token1, activeTickIdx),
    price1: tickToPriceNumber(token1, token0, activeTickIdx),
    isCurrent: Math.abs(activeTickIdx - tickCurrent) < tickSpacing,
  }

  // Look up liquidityNet for active tick
  const activeTick = tickIdxToTickDictionary[activeTickIdx.toString()] || 
                     tickIdxToTickDictionary[activeTickIdx]
  if (activeTick) {
    activeTickProcessed.liquidityNet = JSBI.BigInt(activeTick.liquidityNet)
  }

  // Compute subsequent ticks (upward, ascending prices)
  const subsequentTicks = computeInitializedTicks(
    activeTickProcessed,
    numSurroundingTicks,
    tickSpacing,
    Direction.ASC,
    token0,
    token1,
    tickIdxToTickDictionary
  )

  // Compute previous ticks (downward, descending prices)
  const previousTicks = computeInitializedTicks(
    activeTickProcessed,
    numSurroundingTicks,
    tickSpacing,
    Direction.DESC,
    token0,
    token1,
    tickIdxToTickDictionary
  )

  // Combine: previous + active + subsequent (maintains ascending order)
  return previousTicks.concat(activeTickProcessed).concat(subsequentTicks)
}

enum Direction {
  ASC,
  DESC,
}

/**
 * Compute initialized ticks in a given direction
 * 
 * This is the CRITICAL liquidity accumulation logic:
 * 
 * - When ASCENDING (crossing ticks upward):
 *   At each tick, ADD its liquidityNet to active liquidity
 *   Why? New positions become active as price crosses their lower bound
 * 
 * - When DESCENDING (crossing ticks downward):
 *   At each tick, SUBTRACT the PREVIOUS tick's liquidityNet from active liquidity
 *   Why? Positions become inactive as price crosses their upper bound
 * 
 * This matches Uniswap's core contract logic for liquidity management.
 */
function computeInitializedTicks(
  activeTickProcessed: TickProcessed,
  numSurroundingTicks: number,
  tickSpacing: number,
  direction: Direction,
  token0: Token,
  token1: Token,
  tickIdxToTickDictionary: Record<string, CompatibleTick>
): TickProcessed[] {
  let previousTickProcessed: TickProcessed = {
    ...activeTickProcessed,
  }

  let ticksProcessed: TickProcessed[] = []

  // Iterate through surrounding ticks
  for (let i = 0; i < numSurroundingTicks; i++) {
    // Calculate next tick index based on direction
    const currentTickIdx =
      direction === Direction.ASC
        ? previousTickProcessed.tickIdx + tickSpacing
        : previousTickProcessed.tickIdx - tickSpacing

    // Stop if we've hit tick bounds
    if (currentTickIdx < MIN_TICK || currentTickIdx > MAX_TICK) {
      break
    }

    // Create new tick entry (starts with previous tick's liquidity)
    const currentTickProcessed: TickProcessed = {
      tickIdx: currentTickIdx,
      liquidityActive: previousTickProcessed.liquidityActive,
      liquidityNet: JSBI.BigInt(0),
      price0: tickToPriceNumber(token0, token1, currentTickIdx),
      price1: tickToPriceNumber(token1, token0, currentTickIdx),
      isCurrent: false,
    }

    // Look up tick data from dictionary
    const currentInitializedTick =
      tickIdxToTickDictionary[currentTickIdx.toString()] || 
      tickIdxToTickDictionary[currentTickIdx]
    
    if (currentInitializedTick) {
      currentTickProcessed.liquidityNet = JSBI.BigInt(
        currentInitializedTick.liquidityNet
      )
    }

    // Adjust liquidity based on direction
    if (direction === Direction.ASC && currentInitializedTick) {
      // Ascending: add liquidityNet when crossing tick upward
      currentTickProcessed.liquidityActive = JSBI.add(
        previousTickProcessed.liquidityActive,
        JSBI.BigInt(currentInitializedTick.liquidityNet)
      )
    } else if (
      direction === Direction.DESC &&
      JSBI.notEqual(previousTickProcessed.liquidityNet, JSBI.BigInt(0))
    ) {
      // Descending: subtract previous tick's liquidityNet when crossing downward
      currentTickProcessed.liquidityActive = JSBI.subtract(
        previousTickProcessed.liquidityActive,
        previousTickProcessed.liquidityNet
      )
    }

    ticksProcessed.push(currentTickProcessed)
    previousTickProcessed = currentTickProcessed
  }

  // Reverse descending ticks to maintain ascending order
  if (direction === Direction.DESC) {
    ticksProcessed = ticksProcessed.reverse()
  }

  return ticksProcessed
}
