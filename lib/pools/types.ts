export interface Token {
  id: string;
  name: string;
  symbol: string;
  decimals: number;
  address: string;
  chain: string;
  logoURI?: string;
}

export interface TokenBalance {
  currencyInfo: {
    currency: Token;
  };
  quantity: number;
  balanceUSD?: number;
}

export interface TablePool {
  hash: string;
  token0: Token;
  token1: Token;
  tvl: number;
  volume24h: number;
  volume30d: number;
  fees24h?: number;
  fees30d?: number;
  apr: number;
  volOverTvl?: number;
  feeTier?: {
    feeAmount: number;
    tickSpacing: number;
    isDynamic: boolean;
  };
  protocolVersion: 'V2' | 'V3' | 'V4';
  hookAddress?: string;
  tvl24HChange?: number;  // Percentage change (e.g., 5.2 for +5.2%)
  fees24HDiff?: number;   // Dollar difference (e.g., 500 for +$500)
}

export interface PoolData {
  idOrAddress: string;
  protocolVersion: 'V2' | 'V3' | 'V4';
  token0: Token;
  token1: Token;
  tvlUSD?: number;
  volumeUSD24H?: number;
  feesUSD24H?: number;
  volumeUSD30D?: number;
  feesUSD30D?: number;
  feeTier?: {
    feeAmount: number;
    tickSpacing: number;
    isDynamic: boolean;
  };
  txCount?: number;
  hookAddress?: string;
  tvlHistory?: TVLDataPoint[];
  tvlUSD24HChange?: number;  // Percentage change (e.g., 5.2 for +5.2%)
  feesUSD24HDiff?: number;   // Dollar difference (e.g., 500 for +$500)
}

export enum PoolSortFields {
  TVL = 'TVL',
  Apr = 'APR',
  FeeTier = 'Fee Tier',
  Fees24h = 'Fees 24h',
  Fees30d = 'Fees 30d',
  Volume24h = '1 day volume',
  Volume30D = '30 day volume',
  VolOverTvl = '1 day volume/TVL',
}

export type PoolTableSortState = {
  sortBy: PoolSortFields;
  sortDirection: 'asc' | 'desc';
}

// Alias for backward compatibility
export type PoolToken = Token;

export interface TVLDataPoint {
  date: number;
  tvlUSD: number;
  volumeUSD: number;
  price: number; // token0 price in USD (or token0/token1 ratio if USD not available)
}

export interface PoolTransaction {
  type: 'swap' | 'mint' | 'burn';
  timestamp: number;
  transactionHash: string;
  amount0: string;
  amount1: string;
  amountUSD: string;
  sender?: string;
  owner?: string;
  token0Symbol: string;
  token1Symbol: string;
  token0Decimals: number;
  token1Decimals: number;
}

// Liquidity chart types
export interface PoolTick {
  tickIdx: number;
  liquidityGross: string;
  liquidityNet: string;
  price0: string;
  price1: string;
}

export interface TickProcessed {
  tick: number;
  liquidityActive: string; // Using string instead of JSBI for serialization
  liquidityNet: string;
  price0: string;
}export interface LiquidityChartEntry {
  activeLiquidity: number;
  price0: number;
  tick: number;
  amount0Locked: number;
  amount1Locked: number;
}

export interface PoolTicksData {
  tick: number;
  liquidity: string;
  sqrtPrice: string;
  feeTier: number;
  ticks: PoolTick[];
}
