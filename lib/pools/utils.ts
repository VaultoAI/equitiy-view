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
  fees30d,
  tvl,
}: {
  fees30d?: number;
  tvl?: number;
}): Percent {
  if (!fees30d || !tvl || !Math.round(tvl)) {
    return new Percent(0);
  }
  
  // Calculate APR: (Fees 30d / 30 * 365 / TVL) * 100
  // This annualizes the 30-day fees: (fees30d / 30) gives daily average, * 365 gives annual, / tvl gives rate, * 100 gives percentage
  // Simplified: (fees30d * 365 / (30 * tvl)) * 100 = (fees30d * 12.167 / tvl) * 100
  const aprPercentage = (fees30d * 365 / (30 * tvl)) * 100;
  
  // Percent class represents (numerator/denominator) * 100%
  // To represent APR as percentage, we use numerator = aprPercentage, denominator = 100
  // Result: (aprPercentage / 100) * 100% = aprPercentage%
  return new Percent(
    Math.round(aprPercentage * 100), // Convert to basis points (multiply by 100 for precision)
    10000 // Denominator of 10000 to represent percentage (10000 basis points = 100%)
  );
}

export function sortPools(
  pools: TablePool[],
  sortState: PoolTableSortState
): TablePool[] {
  return [...pools].sort((a, b) => {
    switch (sortState.sortBy) {
      case PoolSortFields.TVL:
        return sortState.sortDirection === 'desc'
          ? b.tvl - a.tvl
          : a.tvl - b.tvl;
      case PoolSortFields.Apr:
        return sortState.sortDirection === 'desc'
          ? (b.apr.greaterThan(a.apr) ? 1 : -1)
          : (a.apr.greaterThan(b.apr) ? 1 : -1);
      case PoolSortFields.FeeTier:
        const feeTierA = a.feeTier?.feeAmount ?? 0;
        const feeTierB = b.feeTier?.feeAmount ?? 0;
        return sortState.sortDirection === 'desc'
          ? feeTierB - feeTierA
          : feeTierA - feeTierB;
      case PoolSortFields.Fees24h:
        const fees24hA = a.fees24h ?? 0;
        const fees24hB = b.fees24h ?? 0;
        return sortState.sortDirection === 'desc'
          ? fees24hB - fees24hA
          : fees24hA - fees24hB;
      case PoolSortFields.Volume24h:
        return sortState.sortDirection === 'desc'
          ? b.volume24h - a.volume24h
          : a.volume24h - b.volume24h;
      case PoolSortFields.Volume30D:
        return sortState.sortDirection === 'desc'
          ? b.volume30d - a.volume30d
          : a.volume30d - b.volume30d;
      default:
        return sortState.sortDirection === 'desc'
          ? b.tvl - a.tvl
          : a.tvl - b.tvl;
    }
  });
}

