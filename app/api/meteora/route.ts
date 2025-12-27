import { NextRequest, NextResponse } from 'next/server';
import { getTrackedSolanaTokenMints, isTrackedSolanaToken } from '@/lib/utils/solanaTokenLogo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const METEORA_API_BASE_URL = 'https://dlmm-api.meteora.ag';
const REQUEST_TIMEOUT = 30000; // 30 seconds
const MAX_RETRIES = 2;

// Common Solana token addresses used in pairs
const SOLANA_COMMON_TOKENS: Record<string, boolean> = {
  'So11111111111111111111111111111111111111112': true, // SOL
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': true, // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': true, // USDT
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
      console.log(`🔄 [Meteora Proxy] Retry attempt ${attempt + 1}/${retries}`);
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

export async function GET(request: NextRequest) {
  try {
    const trackedTokenMints = getTrackedSolanaTokenMints();
    
    if (trackedTokenMints.length === 0) {
      console.log('⚠️ [Meteora Proxy] No tracked tokens configured');
      return NextResponse.json([]);
    }

    console.log(`🔍 [Meteora Proxy] Fetching pools ONLY for ${trackedTokenMints.length} tracked prestocks using /pair/group_pair endpoint...`);
    
    // Use /pair/group_pair/{lexical_order_mints} to fetch only specific pools
    const allPoolsMap = new Map<string, MeteoraPoolResponse>();
    
    // Common tokens that our prestocks pair with
    const commonTokenMints = Object.keys(SOLANA_COMMON_TOKENS);
    
    // For each tracked prestock, fetch pools paired with each common token
    for (const trackedMint of trackedTokenMints) {
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
          console.warn(`⚠️ [Meteora Proxy] Error fetching pool for ${trackedMint}/${commonMint}:`, err);
        }
      }
    }
    
    console.log(`📊 [Meteora Proxy] Found ${allPoolsMap.size} pools for tracked prestocks (using /pair/group_pair, NO /pair/all call)`);

    // Convert map to array and filter out zero TVL pools
    const poolsWithTvl = Array.from(allPoolsMap.values()).filter((pool) => {
      const tvl = parseFloat(pool.liquidity || '0');
      return tvl > 0;
    });

    // Return only necessary fields to reduce payload size
    const optimizedPools = poolsWithTvl.map((pool) => ({
      address: pool.address,
      name: pool.name,
      mint_x: pool.mint_x,
      mint_y: pool.mint_y,
      liquidity: pool.liquidity,
      trade_volume_24h: pool.trade_volume_24h,
      fees_24h: pool.fees_24h,
      base_fee_percentage: pool.base_fee_percentage,
    }));

    console.log(`✅ [Meteora Proxy] Returning ${optimizedPools.length} pools for tracked prestocks only`);

    return NextResponse.json(optimizedPools);
  } catch (error) {
    console.error('❌ [Meteora Proxy] Error:', error);
    
    // Handle timeout errors
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        { error: 'Request timeout', details: 'The request took too long to complete' },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Meteora API request failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

