import { NextRequest, NextResponse } from 'next/server';
import { getCachedData, setCachedData } from '@/lib/cache/serverCache';
import { TablePool } from '@/lib/pools/types';
import { calculateApr } from '@/lib/pools/utils';
import { getSolanaTokenLogoUrl, getSolanaTokenName, getTrackedSolanaTokenMints } from '@/lib/utils/solanaTokenLogo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CACHE_KEY = 'solanaPools';

// Common Solana token addresses
const SOLANA_COMMON_TOKENS: Record<string, { symbol: string; name: string; decimals: number }> = {
  'So11111111111111111111111111111111111111112': { symbol: 'SOL', name: 'Solana', decimals: 9 },
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': { symbol: 'USDC', name: 'USD Coin', decimals: 6 },
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': { symbol: 'USDT', name: 'Tether', decimals: 6 },
};

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

/**
 * Parses token symbol and name from pool name (e.g., "ANDURIL/USDC" -> ["ANDURIL", "USDC"])
 */
function parseTokenInfoFromPoolName(poolName: string, mintAddress: string): { symbol: string; name: string; decimals: number } {
  // Check if it's a tracked token
  const trackedName = getSolanaTokenName(mintAddress);
  if (trackedName) {
    // For tracked tokens, use known name and symbol
    // Default decimals to 9 for Solana tokens (can be updated if we have specific data)
    return { symbol: trackedName, name: trackedName, decimals: 9 };
  }

  // Check if it's a common token
  if (mintAddress in SOLANA_COMMON_TOKENS) {
    return SOLANA_COMMON_TOKENS[mintAddress];
  }

  // Try to parse from pool name (format: "TOKEN1/TOKEN2")
  const parts = poolName.split('/');
  if (parts.length >= 2) {
    // Determine which token this is based on position
    // This is approximate - we'll use the first part for mint_x, second for mint_y typically
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

const METEORA_API_BASE_URL = 'https://dlmm-api.meteora.ag';
const REQUEST_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 2;

// Common Solana token addresses used in pairs (for Meteora API fetching)
const SOLANA_COMMON_TOKEN_MINTS: Record<string, boolean> = {
  'So11111111111111111111111111111111111111112': true, // SOL
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': true, // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': true, // USDT
};

/**
 * Fetches from Meteora API with retry logic
 */
async function fetchWithRetry(url: string, retries = MAX_RETRIES): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      if (attempt === retries) {
        throw error;
      }
      // Wait before retry (exponential backoff)
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
      console.log(`🔄 [Solana Pools API] Retry attempt ${attempt + 1}/${retries}`);
    }
  }
  throw new Error('Max retries exceeded');
}

/**
 * Sorts two mint addresses lexicographically and returns them as an array
 */
function sortMintsLexically(mint1: string, mint2: string): [string, string] {
  return mint1 < mint2 ? [mint1, mint2] : [mint2, mint1];
}

async function fetchPoolsFromMeteora(): Promise<TablePool[]> {
  const TRACKED_SOLANA_TOKEN_MINTS = getTrackedSolanaTokenMints();
  
  if (TRACKED_SOLANA_TOKEN_MINTS.length === 0) {
    return [];
  }

  console.log(`🏊 [Solana Pools API] Fetching pools from Meteora API for ${TRACKED_SOLANA_TOKEN_MINTS.length} tracked tokens...`);

  try {
    // Use /pair/group_pair/{lexical_order_mints} to fetch only specific pools
    const allPoolsMap = new Map<string, MeteoraPoolResponse>();
    
    // Common tokens that our prestocks pair with
    const commonTokenMints = Object.keys(SOLANA_COMMON_TOKEN_MINTS);
    
    // For each tracked prestock, fetch pools paired with each common token
    for (const trackedMint of TRACKED_SOLANA_TOKEN_MINTS) {
      for (const commonMint of commonTokenMints) {
        try {
          // Sort mints lexicographically for the endpoint
          const [mint1, mint2] = sortMintsLexically(trackedMint, commonMint);
          
          // Try different separator formats (hyphen is most common)
          const separatorFormats = ['-', '_', '/'];
          let poolFound = false;
          
          for (const separator of separatorFormats) {
            try {
              const lexicalMints = `${mint1}${separator}${mint2}`;
              const url = `${METEORA_API_BASE_URL}/pair/group_pair/${lexicalMints}`;
              
              const response = await fetchWithRetry(url);
              
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
                
                // Add valid pools to map
                pools.forEach((pool: MeteoraPoolResponse) => {
                  if (pool && pool.address && pool.mint_x && pool.mint_y) {
                    // Verify this pool contains our tracked token
                    const mintXLower = pool.mint_x.toLowerCase();
                    const mintYLower = pool.mint_y.toLowerCase();
                    const trackedLower = trackedMint.toLowerCase();
                    
                    if ((mintXLower === trackedLower || mintYLower === trackedLower) &&
                        (mintXLower === commonMint.toLowerCase() || mintYLower === commonMint.toLowerCase())) {
                      allPoolsMap.set(pool.address, pool);
                      poolFound = true;
                    }
                  }
                });
                
                // If we found pools with this separator, break
                if (poolFound) {
                  break;
                }
              } else if (response.status === 404) {
                // Pool doesn't exist for this pair, continue to next
                continue;
              }
            } catch (err) {
              // Try next separator format
              continue;
            }
          }
        } catch (err) {
          // Log but continue to next pair
          console.warn(`⚠️ [Solana Pools API] Error fetching pool for ${trackedMint}/${commonMint}:`, err);
        }
      }
    }
    
    console.log(`📊 [Solana Pools API] Found ${allPoolsMap.size} pools for tracked prestocks`);

    // Convert map to array and filter out zero TVL pools
    const pools: MeteoraPoolResponse[] = Array.from(allPoolsMap.values()).filter((pool) => {
      const tvl = parseFloat(pool.liquidity || '0');
      return tvl > 0;
    });

    // Note: Server-side filtering already done - pools are pre-filtered for tracked tokens
    console.log(`📊 [Solana Pools API] Received ${pools.length} pre-filtered pools from API`);

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
        console.error(`❌ [Solana Pools API] Error processing pool ${pool.address}:`, err);
      }
    });

    // Convert map values to array
    const tablePools: TablePool[] = Array.from(poolsByToken.values());

    console.log(`✅ [Solana Pools API] Successfully processed ${tablePools.length} pools`);

    return tablePools;
  } catch (err) {
    console.error('❌ [Solana Pools API] Error fetching pools from Meteora API:', err);
    throw err;
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check cache first
    const cachedData = getCachedData<TablePool[]>(CACHE_KEY);
    
    if (cachedData !== null) {
      console.log(`✅ [Solana Pools API] Returning cached data (${cachedData.length} pools)`);
      return NextResponse.json({ pools: cachedData, cached: true });
    }

    // Cache miss or expired, fetch fresh data
    console.log(`🔄 [Solana Pools API] Cache miss, fetching fresh data...`);
    const pools = await fetchPoolsFromMeteora();
    
    // Update cache
    setCachedData(CACHE_KEY, pools);
    console.log(`💾 [Solana Pools API] Cached ${pools.length} pools for 1 hour`);
    
    return NextResponse.json({ pools, cached: false });
  } catch (error) {
    console.error('❌ [Solana Pools API] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch Solana pools', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

