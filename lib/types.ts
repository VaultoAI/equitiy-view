import JSBI from 'jsbi'

/**
 * Raw tick data from Uniswap subgraph
 * tickIdx: Tick index (integer)
 * liquidityGross: Total liquidity referencing this tick
 * liquidityNet: Net liquidity change when crossing this tick
 */
export interface GraphTick {
  tickIdx: string
  liquidityGross: string
  liquidityNet: string
}

/**
 * Processed tick with computed active liquidity
 * Used internally for liquidity calculation
 */
export interface TickProcessed {
  tickIdx: number
  liquidityActive: JSBI        // Active liquidity at this tick
  liquidityNet: JSBI           // Net liquidity change
  price0: number               // Token0 per Token1
  price1: number               // Token1 per Token0
  isCurrent: boolean           // Is this the current price tick?
}

/**
 * Liquidity band for chart display
 * Represents a price range with active liquidity
 */
export interface LiquidityBand {
  tickLower: number            // Lower tick bound
  tickUpper: number            // Upper tick bound
  liquidityActive: JSBI        // Active liquidity in this band (raw)
  priceLowerUSD: number        // Lower price in USD (per security token)
  priceUpperUSD: number        // Upper price in USD (per security token)
  amount0: string              // Amount of token0 locked
  amount1: string              // Amount of token1 locked
  liquidityUSD: number         // Total USD value of liquidity
}

/**
 * Pool metadata from subgraph
 */
export interface PoolMetadata {
  id: string
  token0: {
    id: string
    symbol: string
    decimals: string
  }
  token1: {
    id: string
    symbol: string
    decimals: string
  }
  feeTier: string
  totalValueLockedToken0?: string
  totalValueLockedToken1?: string
  totalValueLockedUSD?: string
  totalValueLockedETH?: string
}

/**
 * Display metadata for pool info
 */
export interface PoolMetadataDisplay {
  chainId?: number
  token0: {
    id: string
    symbol: string
    decimals: string
  }
  token1: {
    id: string
    symbol: string
    decimals: string
  }
  feeTier: string
}
