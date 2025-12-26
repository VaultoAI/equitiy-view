import { Percent } from '@uniswap/sdk-core';

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
  apr: Percent;
  volOverTvl?: number;
  feeTier?: {
    feeAmount: number;
    tickSpacing: number;
    isDynamic: boolean;
  };
  protocolVersion: 'V2' | 'V3' | 'V4';
  hookAddress?: string;
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
}

export enum PoolSortFields {
  TVL = 'TVL',
  Apr = 'APR',
  FeeTier = 'Fee Tier',
  Fees24h = 'Fees 24h',
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
}

