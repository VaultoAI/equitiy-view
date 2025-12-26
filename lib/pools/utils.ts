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
}): number {
  if (!fees30d || !tvl || tvl === 0) {
    return 0;
  }
  
  // Calculate APR: (Fees 30d / 30 * 365 / TVL) * 100
  // This annualizes the 30-day fees: (fees30d / 30) gives daily average, * 365 gives annual, / tvl gives rate, * 100 gives percentage
  // Formula: (fees30d * 365 / (30 * tvl)) * 100
  // Returns exact calculation as a number without any rounding
  return (fees30d * 365 / (30 * tvl)) * 100;
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
          ? b.apr - a.apr
          : a.apr - b.apr;
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

