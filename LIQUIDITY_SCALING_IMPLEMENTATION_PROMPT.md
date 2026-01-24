# Uniswap V3 Liquidity Scaling Implementation Prompt

## Objective
Implement the exact Uniswap V3 liquidity scaling functionality that calculates locked token amounts across different price ranges using canonical Uniswap V3 formulas.

## Core Mathematical Equations

### 1. Token Amount Calculations

For a liquidity position between tick A (lower) and tick B (upper):

**Token0 Amount (typically the quote token like USDC):**
```
amount0 = L × (√PriceB - √PriceA) / (√PriceA × √PriceB)
```

**Token1 Amount (typically the base token):**
```
amount1 = L × (√PriceB - √PriceA)
```

Where:
- `L` = Active liquidity in the tick range (stored as uint128 in Uniswap V3)
- `√PriceA` = Square root price at lower tick boundary
- `√PriceB` = Square root price at upper tick boundary
- Sqrt prices are in Q96 fixed-point format (scaled by 2^96)

### 2. Fixed-Point Number Formats

**Critical:** Uniswap V3 uses fixed-point arithmetic:
- **Q96 format**: Square root prices are stored as `value × 2^96`
- **Q128 format**: Liquidity values are uint128 (not scaled, but require careful handling)
- **Q192**: Intermediate calculations may produce Q192 values (Q96 × Q96)

```
Q96 = 2^96 = 79,228,162,514,264,337,593,543,950,336
```

## Implementation Requirements

### Step 1: Calculate Square Root Prices from Ticks

Use Uniswap's TickMath library or equivalent:
```typescript
// Convert tick index to sqrt price (Q96 format)
const sqrtPriceA = TickMath.getSqrtRatioAtTick(tickLower)
const sqrtPriceB = TickMath.getSqrtRatioAtTick(tickUpper)
```

The tick-to-sqrt-price formula:
```
sqrtPrice = 1.0001^(tick/2) × 2^96
```

### Step 2: Compute Token Amounts with Precise Arithmetic

**For Token0:**
```typescript
// Calculate difference
const sqrtDiff = sqrtPriceB - sqrtPriceA

// Calculate denominator (Q96 × Q96 = Q192)
const sqrtProduct = sqrtPriceA × sqrtPriceB

// Calculate amount0 (multiply by Q96 to maintain precision)
const amount0Raw = (L × sqrtDiff × Q96) / sqrtProduct
```

**For Token1:**
```typescript
// Calculate difference
const sqrtDiff = sqrtPriceB - sqrtPriceA

// Calculate amount1 (divide by Q96 to normalize)
const amount1Raw = (L × sqrtDiff) / Q96
```

### Step 3: Convert to Decimal Amounts

```typescript
// Convert from raw amounts to human-readable decimal amounts
const amount0Decimal = amount0Raw / Q96 / (10 ** token0.decimals)
const amount1Decimal = amount1Raw / Q96 / (10 ** token1.decimals)
```

## Complete Implementation Example

```typescript
import JSBI from 'jsbi'
import { TickMath } from '@uniswap/v3-sdk'
import { Token } from '@uniswap/sdk-core'

const Q96 = JSBI.exponentiate(JSBI.BigInt(2), JSBI.BigInt(96))

/**
 * Compute locked token amounts for a tick band using canonical v3 formulas
 * 
 * @param tickLower - Lower tick boundary
 * @param tickUpper - Upper tick boundary  
 * @param liquidity - Active liquidity in the range (JSBI BigInt)
 * @param token0 - Token0 object with decimals
 * @param token1 - Token1 object with decimals
 * @returns Object with amount0 and amount1 as decimal strings
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
  
  // Convert to JSBI if needed (handle SDK compatibility)
  const sqrtA = JSBI.BigInt(String(sqrtA_SDK))
  const sqrtB = JSBI.BigInt(String(sqrtB_SDK))

  // Calculate sqrtB - sqrtA (in Q96)
  const sqrtDiff = JSBI.subtract(sqrtB, sqrtA)

  // amount0 = L * (sqrtB - sqrtA) / (sqrtA * sqrtB)
  // Multiply by Q96 to maintain precision during division
  const sqrtProduct = JSBI.multiply(sqrtA, sqrtB)
  const amount0Numerator = JSBI.multiply(
    liquidity, 
    JSBI.multiply(sqrtDiff, Q96)
  )
  const amount0Raw = JSBI.divide(amount0Numerator, sqrtProduct)

  // amount1 = L * (sqrtB - sqrtA) / Q96
  const amount1Raw = JSBI.divide(
    JSBI.multiply(liquidity, sqrtDiff),
    Q96
  )

  // Convert JSBI to numbers (handle large BigInt carefully)
  const Q96Number = parseFloat(Q96.toString())
  const amount0RawNumber = parseFloat(amount0Raw.toString())
  const amount1RawNumber = parseFloat(amount1Raw.toString())
  
  // Convert to decimal amounts accounting for Q96 and token decimals
  const amount0Decimal = amount0RawNumber / Q96Number / Math.pow(10, token0.decimals)
  const amount1Decimal = amount1RawNumber / Q96Number / Math.pow(10, token1.decimals)

  return {
    amount0: Math.max(0, amount0Decimal).toFixed(6),
    amount1: Math.max(0, amount1Decimal).toFixed(6),
  }
}
```

## Computing USD Value of Liquidity

Once you have token amounts, calculate total USD value:

```typescript
// Determine which token is USDC
const usdcAmount = isUSDC0 ? amount0 : amount1
const securityAmount = isUSDC0 ? amount1 : amount0

// Get USD price for the security token (mid-price of the range)
const priceLowerUSD = convertTickToUSDPrice(tickLower, token0, token1, isUSDC0)
const priceUpperUSD = convertTickToUSDPrice(tickUpper, token0, token1, isUSDC0)
const midPriceUSD = (priceLowerUSD + priceUpperUSD) / 2

// Calculate total USD value
const liquidityUSD = parseFloat(usdcAmount) + 
                     (parseFloat(securityAmount) × midPriceUSD)
```

## Active Liquidity Accumulation

To compute liquidity at each price band:

1. **Find the current active tick** (where price currently sits)
2. **Set initial liquidity** to the pool's active liquidity
3. **Traverse ticks upward** (ascending):
   - Add `liquidityNet` when crossing an initialized tick upward
   - Formula: `liquidityActive[i+1] = liquidityActive[i] + liquidityNet[i+1]`

4. **Traverse ticks downward** (descending):
   - Subtract `liquidityNet` when crossing an initialized tick downward
   - Formula: `liquidityActive[i-1] = liquidityActive[i] - liquidityNet[i]`

```typescript
// Ascending (moving up in price)
if (direction === Direction.ASC && currentInitializedTick) {
  currentTickProcessed.liquidityActive = JSBI.add(
    previousTickProcessed.liquidityActive,
    JSBI.BigInt(currentInitializedTick.liquidityNet)
  )
}

// Descending (moving down in price)
if (direction === Direction.DESC && 
    JSBI.notEqual(previousTickProcessed.liquidityNet, JSBI.BigInt(0))) {
  currentTickProcessed.liquidityActive = JSBI.subtract(
    previousTickProcessed.liquidityActive,
    previousTickProcessed.liquidityNet
  )
}
```

## Key Implementation Considerations

### 1. Use Big Integer Library
```typescript
// Required for handling uint128 and Q96 values safely
import JSBI from 'jsbi'
```

### 2. Tick Spacing
```typescript
// Different fee tiers have different tick spacings
const TICK_SPACINGS = {
  500: 10,      // 0.05% fee
  3000: 60,     // 0.30% fee
  10000: 200,   // 1.00% fee
}
```

### 3. Active Tick Calculation
```typescript
// Snap to valid tick on grid
const activeTickIdx = Math.floor(tickCurrent / tickSpacing) * tickSpacing
```

### 4. Tick to Price Conversion
```typescript
// Convert tick to actual price
const price = 1.0001 ^ tick

// Or use Uniswap SDK
const price = tickToPrice(token0, token1, tick)
const priceNumber = parseFloat(price.toSignificant(18))
```

### 5. Handle Token Ordering
```typescript
// Uniswap orders tokens by address (token0 < token1)
// Determine which token is USDC/quote currency
const isUSDC0 = token0.address.toLowerCase() === USDC_ADDRESS.toLowerCase()

// Convert to desired price format
const usdPrice = isUSDC0 ? priceToken0PerToken1 : 1 / priceToken0PerToken1
```

## Testing Checklist

- [ ] Verify calculations match Uniswap interface liquidity displays
- [ ] Test with different tick ranges (narrow and wide)
- [ ] Test with different fee tiers (different tick spacings)
- [ ] Verify handling of very large liquidity values (>10^18)
- [ ] Test edge cases: MIN_TICK and MAX_TICK boundaries
- [ ] Confirm USD value calculations are accurate
- [ ] Validate BigInt arithmetic doesn't overflow
- [ ] Test with both token orderings (USDC as token0 and token1)

## Dependencies Required

```json
{
  "dependencies": {
    "@uniswap/v3-sdk": "^3.x.x",
    "@uniswap/sdk-core": "^4.x.x",
    "jsbi": "^4.x.x"
  }
}
```

## Common Pitfalls to Avoid

1. **Don't use standard JavaScript numbers** for liquidity calculations - they lose precision
2. **Don't forget Q96 normalization** when converting to decimal amounts
3. **Don't mix up token0/token1 ordering** - always check which is USDC
4. **Don't skip tick spacing validation** - ticks must align to the grid
5. **Don't forget to handle direction correctly** when traversing ticks
6. **Don't use Math operations on JSBI** - use JSBI.add, JSBI.multiply, etc.

## Expected Output Format

For each liquidity band, produce:
```typescript
{
  tickLower: number,          // Lower tick index
  tickUpper: number,          // Upper tick index  
  liquidityActive: JSBI,      // Active liquidity (BigInt)
  priceLowerUSD: number,      // Lower price boundary in USD
  priceUpperUSD: number,      // Upper price boundary in USD
  amount0: string,            // Token0 amount (decimal string)
  amount1: string,            // Token1 amount (decimal string)
  liquidityUSD: number        // Total USD value of liquidity
}
```

## Reference Implementation

This implementation is based on the canonical Uniswap V3 liquidity distribution algorithm as implemented in:
- Uniswap V3 Core: Tick and Position math
- Uniswap Interface: Liquidity chart calculations
- This codebase: `lib/uniswap/math.ts` and `lib/uniswap/activeLiquidity.ts`

The formulas are mathematically equivalent to Uniswap's native calculations and will produce identical results when given the same input data (pool state, tick data, and current price).
