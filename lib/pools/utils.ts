import { Percent } from '@uniswap/sdk-core';
import { TablePool, PoolTableSortState, PoolSortFields } from './types';

const BIPS_BASE = 10000;

export function calculate1DVolOverTvl(
  volume24h: number | undefined,
  tvl: number | undefined
): number | undefined {
  if (!volume24h || !tvl) {
    return undefined;
  }
  return volume24h / tvl;
}

export function calculateApr({
  volume24h,
  tvl,
  feeTier,
}: {
  volume24h?: number;
  tvl?: number;
  feeTier?: number;
}): Percent {
  if (!volume24h || !feeTier || !tvl || !Math.round(tvl)) {
    return new Percent(0);
  }
  // Calculate annual fees earned: (24h volume × fee rate × 365)
  // Fee rate = feeTier / 1000000 (e.g., 10000 = 1% = 0.01)
  // The fee tier is stored such that 10000 basis points = 1% fee
  const annualFees = volume24h * (feeTier / (BIPS_BASE * 100)) * 365;
  
  // Calculate APR as decimal: annualFees / tvl
  const aprDecimal = annualFees / tvl;
  
  // Percent class represents (numerator/denominator) * 100%
  // To represent APR as percentage, we use basis points format
  // Multiply by 100 to convert decimal to percentage, then use denominator of 100
  // Result: (aprDecimal * 100) / 100 * 100% = aprDecimal * 100% = correct APR%
  return new Percent(
    Math.round(aprDecimal * 100),
    100
  );
}

export function sortPools(
  pools: TablePool[],
  sortState: PoolTableSortState
): TablePool[] {
  return [...pools].sort((a, b) => {
    switch (sortState.sortBy) {
      case PoolSortFields.VolOverTvl:
        return sortState.sortDirection === 'desc'
          ? (b.volOverTvl ?? 0) - (a.volOverTvl ?? 0)
          : (a.volOverTvl ?? 0) - (b.volOverTvl ?? 0);
      case PoolSortFields.Volume24h:
        return sortState.sortDirection === 'desc'
          ? b.volume24h - a.volume24h
          : a.volume24h - b.volume24h;
      case PoolSortFields.Volume30D:
        return sortState.sortDirection === 'desc'
          ? b.volume30d - a.volume30d
          : a.volume30d - b.volume30d;
      case PoolSortFields.Apr:
        return sortState.sortDirection === 'desc'
          ? (b.apr.greaterThan(a.apr) ? 1 : -1)
          : (a.apr.greaterThan(b.apr) ? 1 : -1);
      default:
        return sortState.sortDirection === 'desc'
          ? b.tvl - a.tvl
          : a.tvl - b.tvl;
    }
  });
}

