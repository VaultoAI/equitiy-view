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
  
  // Calculate APR: (Fees 30d * 12 / TVL) * 100
  // This annualizes the 30-day fees: fees30d * 12 gives annual fees (12 * 30 = 360 days), / tvl gives rate, * 100 gives percentage
  // Formula: (fees30d * 12 / tvl) * 100
  // Returns exact calculation as a number without any rounding
  return (fees30d * 12 / tvl) * 100;
}

/**
 * Calculates true rolling 24-hour fees and volume from hourly data
 * Also calculates the previous 24h period for comparison
 * @param hourlyData Array of hourly pool data with timestamps, volume, and fees (should include at least 48 hours)
 * @returns Object with current and previous 24h metrics, plus the difference
 */
export function calculate24hMetrics(
  hourlyData: Array<{
    periodStartUnix: number;
    volumeUSD: string;
    feesUSD: string;
  }>
): { 
  volume24h: number; 
  fees24h: number;
  volume24hPrevious?: number;
  fees24hPrevious?: number;
  fees24hDiff?: number;
} {
  if (!hourlyData || hourlyData.length === 0) {
    return { volume24h: 0, fees24h: 0 };
  }

  // Calculate timestamps
  const now = Math.floor(Date.now() / 1000);
  const twentyFourHoursAgo = now - 24 * 60 * 60;
  const fortyEightHoursAgo = now - 48 * 60 * 60;

  // Filter hourly data for current 24h period (last 24 hours)
  const currentPeriodData = hourlyData.filter(
    (hour) => hour.periodStartUnix >= twentyFourHoursAgo
  );

  // Filter hourly data for previous 24h period (48h ago to 24h ago)
  const previousPeriodData = hourlyData.filter(
    (hour) => hour.periodStartUnix >= fortyEightHoursAgo && hour.periodStartUnix < twentyFourHoursAgo
  );

  // Sum volume and fees from current period
  const volume24h = currentPeriodData.reduce(
    (sum, hour) => sum + parseFloat(hour.volumeUSD || '0'),
    0
  );
  const fees24h = currentPeriodData.reduce(
    (sum, hour) => sum + parseFloat(hour.feesUSD || '0'),
    0
  );

  // Calculate previous period metrics if we have enough data
  let volume24hPrevious: number | undefined;
  let fees24hPrevious: number | undefined;
  let fees24hDiff: number | undefined;

  if (previousPeriodData.length > 0) {
    volume24hPrevious = previousPeriodData.reduce(
      (sum, hour) => sum + parseFloat(hour.volumeUSD || '0'),
      0
    );
    fees24hPrevious = previousPeriodData.reduce(
      (sum, hour) => sum + parseFloat(hour.feesUSD || '0'),
      0
    );
    
    // Calculate the difference (current - previous)
    fees24hDiff = fees24h - fees24hPrevious;
  }

  return { 
    volume24h, 
    fees24h,
    volume24hPrevious,
    fees24hPrevious,
    fees24hDiff
  };
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
      case PoolSortFields.Fees30d:
        const fees30dA = a.fees30d ?? 0;
        const fees30dB = b.fees30d ?? 0;
        return sortState.sortDirection === 'desc'
          ? fees30dB - fees30dA
          : fees30dA - fees30dB;
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

