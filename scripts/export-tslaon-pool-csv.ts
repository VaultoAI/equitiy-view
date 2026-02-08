/**
 * Export TSLAON pool TVL and volume time series to CSV.
 *
 * Run: npx tsx scripts/export-tslaon-pool-csv.ts
 * Or:  npm run export:tslaon-pool
 *
 * Loads .env.local when present (so THE_GRAPH_API_KEY is used if set).
 * Output: tslaon-pool-data.csv in project root
 */

import * as fs from 'fs';
import * as path from 'path';

try {
  const p = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(p)) {
    fs.readFileSync(p, 'utf8')
      .split('\n')
      .forEach((line: string) => {
        const m = line.match(/^([^#=]+)=(.*)$/);
        if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
      });
  }
} catch {
  /* ignore */
}

const TSLAON_TOKEN_ADDRESS = '0xf6b1117ec07684d3958cad8beb1b302bfd21103f';
const SUBGRAPH_ID = '5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV';
const GATEWAY_BASE = 'https://gateway.thegraph.com/api/subgraphs/id';

const TSLAON_POOL_QUERY = `
  query TslaonPool($first: Int!, $tokenAddress: String!) {
    pools(
      first: $first
      where: {
        or: [
          { token0_: { id: $tokenAddress } }
          { token1_: { id: $tokenAddress } }
        ]
      }
      orderBy: totalValueLockedUSD
      orderDirection: desc
    ) {
      id
      token0 { symbol }
      token1 { symbol }
      poolDayData(
        orderBy: date
        orderDirection: desc
        first: 90
      ) {
        date
        volumeUSD
        tvlUSD
      }
    }
  }
`;

interface PoolDayData {
  date: number;
  volumeUSD: string;
  tvlUSD: string;
}

interface PoolResponse {
  data?: {
    pools?: Array<{
      id: string;
      token0: { symbol: string };
      token1: { symbol: string };
      poolDayData: PoolDayData[];
    }>;
  };
  errors?: Array<{ message: string }>;
}

async function fetchTslaonPool(): Promise<PoolResponse> {
  const graphApiKey =
    process.env.NEXT_PUBLIC_THE_GRAPH_API_KEY || process.env.THE_GRAPH_API_KEY;
  const customUrl = process.env.NEXT_PUBLIC_UNISWAP_GRAPHQL_URL;
  let graphqlUrl: string;

  if (customUrl) {
    graphqlUrl = customUrl;
  } else {
    graphqlUrl = `${GATEWAY_BASE}/${SUBGRAPH_ID}`;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (graphApiKey) {
    headers['Authorization'] = `Bearer ${graphApiKey}`;
  }

  const res = await fetch(graphqlUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      query: TSLAON_POOL_QUERY,
      variables: {
        first: 5,
        tokenAddress: TSLAON_TOKEN_ADDRESS.toLowerCase(),
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }

  return (await res.json()) as PoolResponse;
}

function toIsoDate(unix: number): string {
  return new Date(unix * 1000).toISOString().slice(0, 10);
}

function escapeCsvValue(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

async function main() {
  console.log('Fetching TSLAON pool data from Uniswap V3 subgraph...');

  const response = await fetchTslaonPool();

  if (response.errors?.length) {
    throw new Error(`GraphQL errors: ${JSON.stringify(response.errors)}`);
  }

  const pools = response.data?.pools;
  if (!pools || pools.length === 0) {
    throw new Error('No TSLAON pools found');
  }

  const pool = pools[0];
  console.log(
    `Found pool: ${pool.token0.symbol}/${pool.token1.symbol} (${pool.id})`
  );

  const dayData = pool.poolDayData || [];
  if (dayData.length === 0) {
    throw new Error('No pool day data available');
  }

  // Sort ascending by date for chronological time series
  const sorted = [...dayData].sort((a, b) => a.date - b.date);

  const header = 'date,date_unix,tvl_usd,volume_usd';
  const rows = sorted.map((d) => {
    const date = toIsoDate(d.date);
    const tvl = parseFloat(d.tvlUSD || '0').toFixed(2);
    const volume = parseFloat(d.volumeUSD || '0').toFixed(2);
    return [date, String(d.date), tvl, volume].map(escapeCsvValue).join(',');
  });

  const csv = [header, ...rows].join('\n');
  const outputPath = path.join(process.cwd(), 'tslaon-pool-data.csv');
  fs.writeFileSync(outputPath, csv, 'utf8');

  console.log(`Exported ${sorted.length} rows to ${outputPath}`);
}

main().catch((err) => {
  console.error('Error:', err.message || err);
  process.exit(1);
});
