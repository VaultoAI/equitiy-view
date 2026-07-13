import { TablePool, Token } from '@/lib/pools/types';
import { calculateApr, calculate24hMetrics } from '@/lib/pools/utils';
import { getTokenLogoUrl } from '@/lib/utils/tokenLogo';
import { getSolanaTokenLogoUrl, getSolanaTokenName, getTrackedSolanaTokenMints } from '@/lib/utils/solanaTokenLogo';
import { getOndoEquityAddresses } from '@/lib/pools/ondoTokens';
import { BSC_CHAIN_ID } from '@/lib/pools/ondoConfig';

const DEFAULT_TICK_SPACING = 60;
const REQUEST_TIMEOUT = 10000; // 10 seconds (reduced from 30s for faster failure detection)
const MAX_RETRIES = 2;

// USDC identification constants
const USDC_ETHEREUM_ADDRESS = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const USDC_SYMBOL = 'USDC';
const USDC_NAME = 'USD Coin';

/**
 * Checks if a token is USDC by comparing address, symbol, or name
 * @param token - The token to check
 * @returns true if the token is USDC, false otherwise
 */
function isUSDC(token: { address: string; symbol: string; name: string }): boolean {
  const address = token.address.toLowerCase();
  const symbol = token.symbol.toUpperCase();
  const name = token.name;
  
  return (
    address === USDC_ETHEREUM_ADDRESS.toLowerCase() ||
    symbol === USDC_SYMBOL ||
    name === USDC_NAME
  );
}

// Common Solana token addresses
const SOLANA_COMMON_TOKENS: Record<string, { symbol: string; name: string; decimals: number }> = {
  'So11111111111111111111111111111111111111112': { symbol: 'SOL', name: 'Solana', decimals: 9 },
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': { symbol: 'USDC', name: 'USD Coin', decimals: 6 },
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': { symbol: 'USDT', name: 'Tether', decimals: 6 },
};

// Common Solana token addresses used in pairs (for Meteora API fetching)
const SOLANA_COMMON_TOKEN_MINTS: Record<string, boolean> = {
  'So11111111111111111111111111111111111111112': true, // SOL
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': true, // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': true, // USDT
};

interface PoolResponse {
  pools: Array<{
    id: string;
    token0: {
      id: string;
      symbol: string;
      name: string;
      decimals: number;
    };
    token1: {
      id: string;
      symbol: string;
      name: string;
      decimals: number;
    };
    feeTier: number;
    totalValueLockedUSD: string;
    txCount: string;
    poolDayData: Array<{
      date: number;
      volumeUSD: string;
      feesUSD: string;
      tvlUSD: string;
    }>;
    poolHourData?: Array<{
      periodStartUnix: number;
      volumeUSD: string;
      feesUSD: string;
    }>;
  }>;
}

interface MeteoraPoolResponse {
  address: string;
  name: string;
  mint_x: string;
  mint_y: string;
  liquidity: string;
  trade_volume_24h: number;
  fees_24h: number;
  base_fee_percentage: string;
}

// Batched query: fetches every pool that pairs any of the supplied Ondo token
// addresses, ordered by TVL. A single request covers the whole token universe.
const ONDO_POOLS_QUERY = `
  query OndoPools($tokens: [String!]!, $first: Int!, $skip: Int!) {
    pools(
      first: $first
      skip: $skip
      where: {
        or: [
          { token0_in: $tokens }
          { token1_in: $tokens }
        ]
      }
      orderBy: totalValueLockedUSD
      orderDirection: desc
    ) {
      id
      token0 {
        id
        symbol
        name
        decimals
      }
      token1 {
        id
        symbol
        name
        decimals
      }
      feeTier
      totalValueLockedUSD
      txCount
      token0Price
      token1Price
      poolDayData(
        orderBy: date
        orderDirection: desc
        first: 30
      ) {
        date
        volumeUSD
        feesUSD
        tvlUSD
        open
        high
        low
        close
      }
      poolHourData(
        orderBy: periodStartUnix
        orderDirection: desc
        first: 49
      ) {
        periodStartUnix
        volumeUSD
        feesUSD
      }
    }
  }
`;

const METEORA_API_BASE_URL = 'https://dlmm-api.meteora.ag';

/**
 * Fetches from external API with timeout and retry logic
 * Skips retries for 404 responses (expected when pools don't exist)
 */
async function fetchWithTimeoutAndRetry(
  url: string,
  options: RequestInit = {},
  retries = MAX_RETRIES
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      // Ensure fetch doesn't cache responses - always fetch fresh data
      const fetchOptions: RequestInit = {
        ...options,
        signal: controller.signal,
        cache: 'no-store', // Always fetch fresh data, don't use cache
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          ...(options.headers || {}), // Merge user-provided headers
        },
      };

      const response = await fetch(url, fetchOptions);

      clearTimeout(timeoutId);
      
      // Don't retry 404s - they're expected when pools don't exist
      if (response.status === 404) {
        return response;
      }
      
      return response;
    } catch (error) {
      if (attempt === retries) {
        throw error;
      }
      // Wait before retry (exponential backoff)
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      console.log(`🔄 [Pool Fetchers] Retry attempt ${attempt + 1}/${retries} for ${url}`);
    }
  }
  throw new Error('Max retries exceeded');
}

/**
 * Parses token symbol and name from pool name (e.g., "ANDURIL/USDC" -> ["ANDURIL", "USDC"])
 */
function parseTokenInfoFromPoolName(poolName: string, mintAddress: string): { symbol: string; name: string; decimals: number } {
  // Check if it's a tracked token
  const trackedName = getSolanaTokenName(mintAddress);
  if (trackedName) {
    return { symbol: trackedName, name: trackedName, decimals: 9 };
  }

  // Check if it's a common token
  if (mintAddress in SOLANA_COMMON_TOKENS) {
    return SOLANA_COMMON_TOKENS[mintAddress];
  }

  // Try to parse from pool name (format: "TOKEN1/TOKEN2")
  const parts = poolName.split('/');
  if (parts.length >= 2) {
    const symbol = parts[0]?.trim() || 'UNKNOWN';
    return { symbol, name: symbol, decimals: 9 };
  }

  // Fallback
  return { symbol: 'UNKNOWN', name: 'Unknown Token', decimals: 9 };
}

/**
 * Determines which token is which from pool name and mint addresses
 */
function determineTokens(
  pool: MeteoraPoolResponse
): { token0: { symbol: string; name: string; decimals: number; mint: string }; token1: { symbol: string; name: string; decimals: number; mint: string } } {
  // Get token info for mint_x
  const token0Name = getSolanaTokenName(pool.mint_x);
  const token0Info = token0Name
    ? { symbol: token0Name, name: token0Name, decimals: 9 }
    : pool.mint_x in SOLANA_COMMON_TOKENS
    ? SOLANA_COMMON_TOKENS[pool.mint_x]
    : parseTokenInfoFromPoolName(pool.name || '', pool.mint_x);

  // Get token info for mint_y
  const token1Name = getSolanaTokenName(pool.mint_y);
  const token1Info = token1Name
    ? { symbol: token1Name, name: token1Name, decimals: 9 }
    : pool.mint_y in SOLANA_COMMON_TOKENS
    ? SOLANA_COMMON_TOKENS[pool.mint_y]
    : parseTokenInfoFromPoolName(pool.name || '', pool.mint_y);

  // If we still don't have good info, try parsing from pool name
  if (token0Info.symbol === 'UNKNOWN' || token1Info.symbol === 'UNKNOWN') {
    const poolName = pool.name || '';
    const parts = poolName.split('/');
    if (parts.length >= 2) {
      if (token0Info.symbol === 'UNKNOWN') {
        token0Info.symbol = parts[0]?.trim() || 'TOKEN0';
        token0Info.name = token0Info.symbol;
      }
      if (token1Info.symbol === 'UNKNOWN') {
        token1Info.symbol = parts[1]?.trim() || 'TOKEN1';
        token1Info.name = token1Info.symbol;
      }
    }
  }

  return {
    token0: {
      ...token0Info,
      mint: pool.mint_x,
    },
    token1: {
      ...token1Info,
      mint: pool.mint_y,
    },
  };
}

/**
 * Converts fee percentage string to basis points
 */
function feePercentageToBasisPoints(feePercentage: string): number {
  try {
    const fee = parseFloat(feePercentage);
    if (isNaN(fee)) return 0;
    // Convert percentage (e.g., 0.01 for 0.01%) to basis points (e.g., 1)
    return Math.round(fee * 100);
  } catch {
    return 0;
  }
}

/**
 * Sorts two mint addresses lexicographically and returns them as an array
 */
function sortMintsLexically(mint1: string, mint2: string): [string, string] {
  return mint1 < mint2 ? [mint1, mint2] : [mint2, mint1];
}

/**
 * Fetches a pool pair from Meteora API, trying separator formats sequentially (hyphen first, most common)
 * @param trackedMint - The tracked prestock token mint address
 * @param commonMint - The common token mint address (USDC)
 * @returns The pool response if found, null otherwise
 */
async function fetchPoolPair(
  trackedMint: string,
  commonMint: string
): Promise<MeteoraPoolResponse | null> {
  // Sort mints lexicographically for the endpoint
  const [mint1, mint2] = sortMintsLexically(trackedMint, commonMint);
  
  // Try separator formats sequentially, starting with hyphen (most common)
  // This reduces API calls from 3 per pair to 1 per pair in most cases
  const separatorFormats = ['-', '_', '/'];
  
  for (const separator of separatorFormats) {
    try {
      const lexicalMints = `${mint1}${separator}${mint2}`;
      const url = `${METEORA_API_BASE_URL}/pair/group_pair/${lexicalMints}`;
      
      const response = await fetchWithTimeoutAndRetry(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Handle response - could be array or single object
        let pools: MeteoraPoolResponse[] = [];
        if (Array.isArray(data)) {
          pools = data;
        } else if (data && data.address) {
          // Single pool object
          pools = [data];
        }
        
        // Find and return the first valid pool that matches our tokens
        for (const pool of pools) {
          if (pool && pool.address && pool.mint_x && pool.mint_y) {
            // Verify this pool contains our tracked token and common token
            const mintXLower = pool.mint_x.toLowerCase();
            const mintYLower = pool.mint_y.toLowerCase();
            const trackedLower = trackedMint.toLowerCase();
            const commonLower = commonMint.toLowerCase();
            
            if ((mintXLower === trackedLower || mintYLower === trackedLower) &&
                (mintXLower === commonLower || mintYLower === commonLower)) {
              return pool;
            }
          }
        }
      } else if (response.status === 404) {
        // Pool doesn't exist with this separator, try next one
        continue;
      }
    } catch (err) {
      // Try next separator format on error
      continue;
    }
  }
  
  return null;
}

/**
 * Converts a raw Uniswap V3 subgraph pool into our TablePool shape, deriving
 * rolling 24h / 30d volume + fees, APR and TVL change from the nested day/hour
 * data supplied by the subgraph.
 */
function mapRawPoolToTablePool(pool: PoolResponse['pools'][number]): TablePool {
  const tvl = parseFloat(pool.totalValueLockedUSD || '0');

  // Calculate 24h and 30d volumes and fees from poolDayData
  const dayData = pool.poolDayData || [];

  // Calculate true rolling 24h volume and fees from hourly data if available
  let volume24h: number;
  let fees24h: number;
  let fees24HDiff: number | undefined;

  if (pool.poolHourData && pool.poolHourData.length > 0) {
    // Use hourly data for accurate rolling 24h calculation
    const metrics = calculate24hMetrics(pool.poolHourData);
    volume24h = metrics.volume24h;
    fees24h = metrics.fees24h;
    fees24HDiff = metrics.fees24hDiff;
  } else {
    // Fallback to daily data (current day)
    volume24h = dayData.length > 0
      ? parseFloat(dayData[0].volumeUSD || '0')
      : 0;
    fees24h = dayData.length > 0
      ? parseFloat(dayData[0].feesUSD || '0')
      : 0;

    // Calculate fees diff using daily data as fallback
    if (dayData.length >= 2) {
      const previousFees = parseFloat(dayData[1].feesUSD || '0');
      const diff = fees24h - previousFees;
      if (!isNaN(diff) && isFinite(diff)) {
        fees24HDiff = diff;
      }
    }
  }

  // 30d volume: sum of last 30 days
  const volume30d = dayData.reduce((sum, day) => {
    return sum + parseFloat(day.volumeUSD || '0');
  }, 0);

  // 30d fees: sum of last 30 days
  const fees30d = dayData.reduce((sum, day) => {
    return sum + parseFloat(day.feesUSD || '0');
  }, 0);

  // Calculate TVL 24h percentage change
  // Compare most recent day's TVL with previous day's TVL (24h ago)
  let tvl24HChange: number | undefined;
  if (dayData.length >= 2) {
    const currentDayTvl = parseFloat(dayData[0].tvlUSD || '0');
    const previousDayTvl = parseFloat(dayData[1].tvlUSD || '0');
    if (previousDayTvl > 0 && currentDayTvl > 0) {
      const change = ((currentDayTvl - previousDayTvl) / previousDayTvl) * 100;
      // Only include if there's a meaningful change (|change| > 0.001%)
      if (Math.abs(change) > 0.001 && !isNaN(change) && isFinite(change)) {
        tvl24HChange = change;
      }
    }
  }

  const token0Address = pool.token0.id.split('-')[0];
  const token1Address = pool.token1.id.split('-')[0];

  return {
    hash: pool.id,
    token0: {
      id: pool.token0.id,
      name: pool.token0.name,
      symbol: pool.token0.symbol,
      decimals: pool.token0.decimals,
      address: token0Address,
      chain: 'ETHEREUM',
      logoURI: getTokenLogoUrl(token0Address, 1),
    },
    token1: {
      id: pool.token1.id,
      name: pool.token1.name,
      symbol: pool.token1.symbol,
      decimals: pool.token1.decimals,
      address: token1Address,
      chain: 'ETHEREUM',
      logoURI: getTokenLogoUrl(token1Address, 1),
    },
    tvl,
    volume24h,
    volume30d,
    fees24h,
    fees30d,
    volOverTvl: undefined,
    apr: calculateApr({
      fees30d,
      tvl,
    }),
    feeTier: {
      feeAmount: pool.feeTier,
      tickSpacing: DEFAULT_TICK_SPACING,
      isDynamic: false,
    },
    protocolVersion: 'V3',
    tvl24HChange,
    fees24HDiff,
  } as TablePool;
}

/**
 * Fetches pools for the full Ondo tokenized-equity universe from the Uniswap V3
 * subgraph. Discovers every Ondo token that currently has USDC liquidity on
 * Uniswap (rather than a hand-maintained shortlist) via a single batched query,
 * then returns the highest-TVL USDC pool for each such token.
 */
export async function fetchTokenizedStockPools(): Promise<TablePool[]> {
  // The set of candidate Ondo token addresses (refreshed from the official
  // Ondo token list at runtime, with a vendored fallback).
  const ondoAddresses = await getOndoEquityAddresses(1);
  if (ondoAddresses.length === 0) {
    return [];
  }
  // getOndoEquityAddresses() already returns lowercased addresses.
  const ondoAddressSet = new Set(ondoAddresses);

  console.log(`🏊 [Pool Fetchers] Fetching Uniswap pools for ${ondoAddresses.length} Ondo tokens...`);

  // Get GraphQL endpoint and auth (per The Graph docs: managing-api-keys)
  const graphApiKey = process.env.NEXT_PUBLIC_THE_GRAPH_API_KEY || process.env.THE_GRAPH_API_KEY;
  const customUrl = process.env.NEXT_PUBLIC_UNISWAP_GRAPHQL_URL;
  const SUBGRAPH_ID = '5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV';
  const GATEWAY_BASE = 'https://gateway.thegraph.com/api/subgraphs/id';

  let graphqlUrl: string;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (customUrl) {
    graphqlUrl = customUrl;
  } else {
    graphqlUrl = `${GATEWAY_BASE}/${SUBGRAPH_ID}`;
    // Prefer Bearer auth (docs: "added layer of security"). URL has no key in path.
    if (graphApiKey) {
      headers['Authorization'] = `Bearer ${graphApiKey}`;
    }
  }

  // Page through every pool that pairs an Ondo token. Ordered by TVL desc, so
  // in practice a single page covers the entire universe.
  const PAGE_SIZE = 1000;
  const MAX_PAGES = 6; // subgraph skip cap is 5000; 6 pages is a safety ceiling
  const rawPools: PoolResponse['pools'] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const skip = page * PAGE_SIZE;
    const response = await fetchWithTimeoutAndRetry(graphqlUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        query: ONDO_POOLS_QUERY,
        variables: {
          tokens: ondoAddresses,
          first: PAGE_SIZE,
          skip,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`GraphQL request failed: ${response.statusText}`);
    }

    const result = await response.json();

    if (result.errors && result.errors.length > 0) {
      console.error('❌ [Pool Fetchers] GraphQL errors:', result.errors);
      const msg = String((result.errors[0] as { message?: string })?.message ?? '');
      if (
        msg.includes('bad indexers') ||
        msg.includes('indexing_error') ||
        msg.includes('auth error') ||
        msg.includes('too far behind')
      ) {
        const err = new Error(
          `Subgraph unavailable: ${msg.slice(0, 120)}. See TOKENIZED_STOCK_POOLS_API_FAILURE.md.`
        ) as Error & { statusCode?: number };
        err.statusCode = 503;
        throw err;
      }
    }

    const pagePools = (result.data as PoolResponse | undefined)?.pools ?? [];
    rawPools.push(...pagePools);

    if (pagePools.length < PAGE_SIZE) break;
  }

  console.log(`📊 [Pool Fetchers] Received ${rawPools.length} Ondo-paired pools from subgraph`);

  // Map to TablePool, keep only USDC-paired pools with TVL > 0 that actually
  // include an Ondo token, then keep the highest-TVL pool per Ondo token.
  const poolsByToken = new Map<string, TablePool>();

  for (const rawPool of rawPools) {
    try {
      const pool = mapRawPoolToTablePool(rawPool);

      const hasUSDC = isUSDC(pool.token0) || isUSDC(pool.token1);
      if (!hasUSDC || pool.tvl <= 0) continue;

      const token0IsOndo = ondoAddressSet.has(pool.token0.address.toLowerCase());
      const token1IsOndo = ondoAddressSet.has(pool.token1.address.toLowerCase());
      if (!token0IsOndo && !token1IsOndo) continue;

      const ondoAddress = (token0IsOndo ? pool.token0.address : pool.token1.address).toLowerCase();
      const existing = poolsByToken.get(ondoAddress);
      if (!existing || pool.tvl > existing.tvl) {
        poolsByToken.set(ondoAddress, pool);
      }
    } catch (err) {
      // Skip a single malformed pool rather than failing the whole batch.
      console.warn(`⚠️ [Pool Fetchers] Skipping malformed pool ${rawPool?.id}:`, err);
    }
  }

  const validPools = Array.from(poolsByToken.values());

  console.log(`✅ [Pool Fetchers] Found ${validPools.length} Ondo tokens with USDC liquidity on Uniswap`);

  return validPools;
}

// ---------------------------------------------------------------------------
// BNB Smart Chain (Ondo equities on PancakeSwap / Uniswap) via Dexscreener
// ---------------------------------------------------------------------------
//
// Unlike Ethereum, BSC Ondo liquidity is fragmented across PancakeSwap V2, V3
// and Uniswap and is not covered by a single reliable subgraph. Dexscreener
// already aggregates every DEX pair for a token address, so we use its public
// REST API (the same "aggregator REST" shape used for Solana/Meteora) to find,
// for each Ondo BSC token, its deepest stablecoin-paired pool.

/** USD stablecoins on BNB Chain that Ondo equities pair against (lowercased). */
const BSC_STABLES: Record<string, string> = {
  '0x55d398326f99059ff775485246999027b3197955': 'USDT', // Binance-Peg USDT
  '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d': 'USDC', // Binance-Peg USDC
  '0x8d0d000ee44948fc98c9b98a4fa4921476f08b0d': 'USD1', // World Liberty USD1
  '0x1f8955e640cbd9abc3c3bb408c9e2e1f5f20dfe6': 'USDon', // Ondo U.S. Dollar Token
};

/**
 * Drop dust pools: below this liquidity the table can't compute a meaningful
 * APR (see PoolTableRow's `< $100 → "NA"` rule), so they add noise, not signal.
 */
const BSC_MIN_LIQUIDITY_USD = 100;

/**
 * Nominal swap-fee rate used to *estimate* fees for BSC pools. Dexscreener does
 * not expose per-pool fees, so we approximate them from 24h volume using
 * PancakeSwap's common 0.25% tier. This is clearly an estimate (like the Solana
 * 30d approximation) and only affects the derived APR figure.
 */
const BSC_ESTIMATED_FEE_RATE = 0.0025;

const DEXSCREENER_TOKENS_URL = 'https://api.dexscreener.com/latest/dex/tokens';
const DEXSCREENER_BATCH_SIZE = 30; // max token addresses per Dexscreener request

interface DexscreenerToken {
  address: string;
  name: string;
  symbol: string;
}

interface DexscreenerPair {
  chainId: string;
  dexId?: string;
  labels?: string[];
  pairAddress: string;
  baseToken: DexscreenerToken;
  quoteToken: DexscreenerToken;
  volume?: { h24?: number };
  liquidity?: { usd?: number };
}

function chunkArray<T>(arr: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/** Builds a TablePool from a Dexscreener BSC pair, given which side is Ondo. */
function mapDexscreenerPairToTablePool(pair: DexscreenerPair, ondoAddress: string): TablePool {
  const isBaseOndo = pair.baseToken.address.toLowerCase() === ondoAddress;
  const ondoTok = isBaseOndo ? pair.baseToken : pair.quoteToken;
  const stableTok = isBaseOndo ? pair.quoteToken : pair.baseToken;

  const tvl = pair.liquidity?.usd ?? 0;
  const volume24h = pair.volume?.h24 ?? 0;
  // Dexscreener only exposes rolling 24h volume; approximate longer windows.
  const volume30d = volume24h * 30;
  const fees24h = volume24h * BSC_ESTIMATED_FEE_RATE;
  const fees30d = fees24h * 30;

  const isV2 = (pair.labels ?? []).some((l) => l.toLowerCase() === 'v2');

  const buildToken = (t: DexscreenerToken): Token => ({
    id: t.address,
    name: t.name,
    symbol: t.symbol,
    decimals: 18,
    address: t.address,
    chain: 'BSC',
    logoURI: getTokenLogoUrl(t.address, BSC_CHAIN_ID),
  });

  return {
    hash: pair.pairAddress,
    token0: buildToken(ondoTok),
    token1: buildToken(stableTok),
    tvl,
    volume24h,
    volume30d,
    fees24h,
    fees30d,
    volOverTvl: undefined,
    apr: calculateApr({ fees30d, tvl }),
    feeTier: {
      feeAmount: 2500, // nominal 0.25% (Dexscreener does not expose the tier)
      tickSpacing: DEFAULT_TICK_SPACING,
      isDynamic: false,
    },
    protocolVersion: isV2 ? 'V2' : 'V3',
  } as TablePool;
}

/**
 * Fetches the deepest stablecoin-paired DEX pool on BNB Chain for each Ondo
 * tokenized-equity token, via the Dexscreener aggregator API. Best-effort:
 * individual batch failures are dropped rather than failing the whole set, so
 * callers can safely treat this as additive to the Ethereum pools.
 */
export async function fetchBscTokenizedStockPools(): Promise<TablePool[]> {
  const ondoAddresses = await getOndoEquityAddresses(BSC_CHAIN_ID);
  if (ondoAddresses.length === 0) return [];
  const ondoSet = new Set(ondoAddresses); // already lowercased

  console.log(`🏊 [Pool Fetchers] Fetching BSC liquidity for ${ondoAddresses.length} Ondo tokens via Dexscreener...`);

  const batches = chunkArray(ondoAddresses, DEXSCREENER_BATCH_SIZE);
  const responses = await Promise.allSettled(
    batches.map((batch) =>
      fetchWithTimeoutAndRetry(`${DEXSCREENER_TOKENS_URL}/${batch.join(',')}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      }).then((r) => (r.ok ? (r.json() as Promise<{ pairs?: DexscreenerPair[] }>) : null))
    )
  );

  // Keep the highest-liquidity stable-paired pool per Ondo token.
  const bestByToken = new Map<string, DexscreenerPair>();

  for (const res of responses) {
    if (res.status !== 'fulfilled' || !res.value) continue;
    for (const pair of res.value.pairs ?? []) {
      if (pair.chainId !== 'bsc' || !pair.baseToken || !pair.quoteToken) continue;

      const base = pair.baseToken.address.toLowerCase();
      const quote = pair.quoteToken.address.toLowerCase();

      let ondoAddress: string | null = null;
      if (ondoSet.has(base) && BSC_STABLES[quote]) ondoAddress = base;
      else if (ondoSet.has(quote) && BSC_STABLES[base]) ondoAddress = quote;
      if (!ondoAddress) continue;

      const liq = pair.liquidity?.usd ?? 0;
      if (liq < BSC_MIN_LIQUIDITY_USD) continue;

      const existing = bestByToken.get(ondoAddress);
      if (!existing || liq > (existing.liquidity?.usd ?? 0)) {
        bestByToken.set(ondoAddress, pair);
      }
    }
  }

  const pools: TablePool[] = [];
  for (const [ondoAddress, pair] of bestByToken) {
    try {
      pools.push(mapDexscreenerPairToTablePool(pair, ondoAddress));
    } catch (err) {
      console.warn(`⚠️ [Pool Fetchers] Skipping malformed BSC pair ${pair?.pairAddress}:`, err);
    }
  }

  console.log(`✅ [Pool Fetchers] Found ${pools.length} Ondo tokens with stablecoin liquidity on BSC`);
  return pools;
}

/**
 * Fetches Solana pools from Meteora API
 * Optimized to fetch all pairs in parallel for maximum performance
 */
export async function fetchSolanaPools(): Promise<TablePool[]> {
  const TRACKED_SOLANA_TOKEN_MINTS = getTrackedSolanaTokenMints();
  
  if (TRACKED_SOLANA_TOKEN_MINTS.length === 0) {
    return [];
  }

  console.log(`🏊 [Pool Fetchers] Fetching Solana pools from Meteora API for ${TRACKED_SOLANA_TOKEN_MINTS.length} tracked tokens...`);

  try {
    // Only fetch USDC pairs - all prestock pools are paired with USDC
    // This reduces API calls from 15 (5 tokens × 3 common tokens) to 5 (5 tokens × 1 common token)
    const USDC_MINT = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
    
    // Generate all pair combinations upfront (only USDC pairs)
    const pairCombinations: Array<[string, string]> = TRACKED_SOLANA_TOKEN_MINTS.map(
      (trackedMint) => [trackedMint, USDC_MINT] as [string, string]
    );
    
    console.log(`🚀 [Pool Fetchers] Fetching ${pairCombinations.length} USDC pool pairs in parallel...`);
    
    // Execute all pair fetches in parallel
    const pairPromises = pairCombinations.map(([trackedMint, commonMint]) =>
      fetchPoolPair(trackedMint, commonMint).catch((err) => {
        console.warn(`⚠️ [Pool Fetchers] Error fetching pool for ${trackedMint}/${commonMint}:`, err);
        return null;
      })
    );
    
    const poolResults = await Promise.allSettled(pairPromises);
    
    // Collect all valid pools into a map (deduplicate by address)
    const allPoolsMap = new Map<string, MeteoraPoolResponse>();
    
    for (const result of poolResults) {
      if (result.status === 'fulfilled' && result.value !== null) {
        const pool = result.value;
        if (pool && pool.address) {
          allPoolsMap.set(pool.address, pool);
        }
      }
    }
    
    console.log(`📊 [Pool Fetchers] Found ${allPoolsMap.size} pools for tracked prestocks`);

    // Convert map to array and filter out zero TVL pools
    const pools: MeteoraPoolResponse[] = Array.from(allPoolsMap.values()).filter((pool) => {
      const tvl = parseFloat(pool.liquidity || '0');
      return tvl > 0;
    });

    console.log(`📊 [Pool Fetchers] Received ${pools.length} pre-filtered pools from API`);

    // Convert to TablePool format and group by tracked token
    const poolsByToken = new Map<string, TablePool>();

    pools.forEach((pool) => {
      try {
        const tvl = parseFloat(pool.liquidity || '0');
        
        // TVL filtering already done server-side, but double-check for safety
        if (tvl <= 0) {
          return;
        }

        // Determine which tracked token this pool is for
        const trackedTokenMint = TRACKED_SOLANA_TOKEN_MINTS.find(
          (mint) => pool.mint_x.toLowerCase() === mint.toLowerCase() || pool.mint_y.toLowerCase() === mint.toLowerCase()
        );

        if (!trackedTokenMint) {
          return;
        }

        const { token0: token0Info, token1: token1Info } = determineTokens(pool);

        // Get logo URLs
        const token0LogoUrl = getSolanaTokenLogoUrl(pool.mint_x) || '';
        const token1LogoUrl = getSolanaTokenLogoUrl(pool.mint_y) || '';

        // Volume and fees
        const volume24h = pool.trade_volume_24h || 0;
        const fees24h = pool.fees_24h || 0;
        
        // Estimate 30d data (multiply 24h by 30, this is approximate)
        const volume30d = volume24h * 30;
        const fees30d = fees24h * 30;

        // Calculate APR using the same method as pool details page (always calculate from fees30d and tvl)
        const apr = calculateApr({ fees30d, tvl });

        // Convert fee percentage to basis points
        const feeAmount = feePercentageToBasisPoints(pool.base_fee_percentage || '0');

        const tablePool: TablePool = {
          hash: pool.address,
          token0: {
            id: pool.mint_x,
            name: token0Info.name,
            symbol: token0Info.symbol,
            decimals: token0Info.decimals,
            address: pool.mint_x,
            chain: 'SOLANA',
            logoURI: token0LogoUrl,
          },
          token1: {
            id: pool.mint_y,
            name: token1Info.name,
            symbol: token1Info.symbol,
            decimals: token1Info.decimals,
            address: pool.mint_y,
            chain: 'SOLANA',
            logoURI: token1LogoUrl,
          },
          tvl,
          volume24h,
          volume30d,
          fees24h,
          fees30d,
          volOverTvl: undefined,
          apr,
          feeTier: {
            feeAmount,
            tickSpacing: 60, // Default tick spacing for DLMM
            isDynamic: true, // DLMM uses dynamic fees
          },
          protocolVersion: 'V3',
        };

        // Keep only the highest TVL pool for each tracked token
        const existingPool = poolsByToken.get(trackedTokenMint);
        if (!existingPool || tablePool.tvl > existingPool.tvl) {
          poolsByToken.set(trackedTokenMint, tablePool);
        }
      } catch (err) {
        console.error(`❌ [Pool Fetchers] Error processing pool ${pool.address}:`, err);
      }
    });

    // Convert map values to array
    const tablePools: TablePool[] = Array.from(poolsByToken.values());

    console.log(`✅ [Pool Fetchers] Successfully processed ${tablePools.length} pools`);

    return tablePools;
  } catch (err) {
    console.error('❌ [Pool Fetchers] Error fetching pools from Meteora API:', err);
    throw err;
  }
}

