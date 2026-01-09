import { TablePool } from '@/lib/pools/types';
import { calculateApr } from '@/lib/pools/utils';
import { getTokenLogoUrl } from '@/lib/utils/tokenLogo';
import { getSolanaTokenLogoUrl, getSolanaTokenName, getTrackedSolanaTokenMints } from '@/lib/utils/solanaTokenLogo';

const DEFAULT_QUERY_SIZE = 20;
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

// Tokenized stock addresses that have pools (chainId: 1 only)
const TOKENIZED_STOCK_ADDRESSES = [
  '0xf3e4872e6a4cf365888d93b6146a2baa7348f1a4', // SLVon - USDC/SLVon
  '0x3632dea96a953c11dac2f00b4a05a32cd1063fae', // CRCLon - CRCLon/USDC
  '0x2d1f7226bd1f780af6b9a49dcc0ae00e8df4bdee', // NVDAon - NVDAon/USDC
  '0xf6b1117ec07684d3958cad8beb1b302bfd21103f', // TSLAon - USDC/TSLAon
  '0xfedc5f4a6c38211c1338aa411018dfaf26612c08', // SPYon - USDC/SPYon
  '0x0e397938c1aa0680954093495b70a9f5e2249aba', // QQQon - QQQon/USDC
  '0xba47214edd2bb43099611b208f75e4b42fdcfedc', // GOOGLon - USDC/GOOGLon
  '0x41765f0fcddc276309195166c7a62ae522fa09ef', // BABAon - BABAon/USDC
  '0x992651bfeb9a0dcc4457610e284ba66d86489d4d', // TLTon - TLTon/USDC
  '0x14c3abf95cb9c93a8b82c1cdcb76d72cb87b2d4c', // AAPLon - AAPLon/USDC
  '0xf042cfa86cf1d598a75bdb55c3507a1f39f9493b', // COINon - USDC/COINon
  '0x998f02a9e343ef6e3e6f28700d5a20f839fd74e6', // HOODon - HOODon/USDC
  '0xb812837b81a3a6b81d7cd74cfb19a7f2784555e5', // MSFTon - USDC/MSFTon
  '0xcabd955322dfbf94c084929ac5e9eca3feb5556f', // MSTRon - USDC/MSTRon
  '0xd8e26fcc879b30cb0a0b543925a2b3500f074d81', // NKEon - USDC/NKEon
  '0xbc843b147db4c7e00721d76037b8b92e13afe13f', // SPGIon - USDC/SPGIon
].map(addr => addr.toLowerCase());

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

const TOP_V3_POOLS_QUERY = `
  query TopV3Pools($first: Int!, $tokenAddress: String!) {
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

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

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
 * Fetches tokenized stock pools from GraphQL
 */
export async function fetchTokenizedStockPools(): Promise<TablePool[]> {
  if (TOKENIZED_STOCK_ADDRESSES.length === 0) {
    return [];
  }

  console.log(`🏊 [Pool Fetchers] Fetching tokenized stock pools for ${TOKENIZED_STOCK_ADDRESSES.length} tokens...`);

  // Get GraphQL endpoint
  const graphApiKey = process.env.NEXT_PUBLIC_THE_GRAPH_API_KEY || process.env.THE_GRAPH_API_KEY;
  const customUrl = process.env.NEXT_PUBLIC_UNISWAP_GRAPHQL_URL;
  
  let graphqlUrl: string;
  
  if (customUrl) {
    graphqlUrl = customUrl;
  } else if (graphApiKey) {
    graphqlUrl = `https://gateway.thegraph.com/api/${graphApiKey}/subgraphs/id/5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV`;
  } else {
    graphqlUrl = 'https://gateway.thegraph.com/api/subgraphs/id/5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV';
  }

  // Fetch pools for all tokens in parallel
  const poolPromises = TOKENIZED_STOCK_ADDRESSES.map(async (tokenAddress) => {
    try {
      const response = await fetchWithTimeoutAndRetry(graphqlUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: TOP_V3_POOLS_QUERY,
          variables: {
            first: DEFAULT_QUERY_SIZE,
            tokenAddress: tokenAddress.toLowerCase(),
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`GraphQL request failed: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.errors && result.errors.length > 0) {
        console.error(`❌ [Pool Fetchers] GraphQL errors for token ${tokenAddress}:`, result.errors);
      }

      const responseData: PoolResponse = result.data || { pools: [] };
      const poolCount = responseData?.pools?.length || 0;
      
      if (poolCount > 0) {
        console.log(`✅ [Pool Fetchers] Found ${poolCount} pools for token ${tokenAddress}`);
      }

      // Convert to TablePool format and get the highest TVL pool
      const pools: TablePool[] = (responseData?.pools || [])
        .map((pool) => {
          const tvl = parseFloat(pool.totalValueLockedUSD || '0');
          
          // Calculate 24h and 30d volumes and fees from poolDayData
          const dayData = pool.poolDayData || [];
          
          // 24h volume: most recent day's volume (first item in array)
          const volume24h = dayData.length > 0 
            ? parseFloat(dayData[0].volumeUSD || '0')
            : 0;
          
          // 24h fees: most recent day's fees (first item in array)
          const fees24h = dayData.length > 0
            ? parseFloat(dayData[0].feesUSD || '0')
            : 0;
          
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

          // Calculate 24h fees difference (current day - previous day)
          let fees24HDiff: number | undefined;
          if (dayData.length >= 2) {
            const previousFees = parseFloat(dayData[1].feesUSD || '0');
            const diff = fees24h - previousFees;
            // Only set if the difference is a valid number
            if (!isNaN(diff) && isFinite(diff)) {
              fees24HDiff = diff;
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
        })
        // Filter to only include pools with TVL > 0 and that involve USDC
        .filter((pool) => {
          const hasUSDC = isUSDC(pool.token0) || isUSDC(pool.token1);
          return hasUSDC && pool.tvl > 0;
        });

      // Return the pool with the highest TVL for this token, or null if no valid pools
      return pools.length > 0 ? pools[0] : null;
    } catch (err) {
      console.error(`❌ [Pool Fetchers] Error fetching pools for token ${tokenAddress}:`, err);
      return null;
    }
  });

  const pools = await Promise.all(poolPromises);
  const validPools = pools.filter((pool): pool is TablePool => pool !== null);
  
  console.log(`✅ [Pool Fetchers] Successfully fetched pools for ${validPools.length} out of ${TOKENIZED_STOCK_ADDRESSES.length} tokenized stocks`);
  
  return validPools;
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

