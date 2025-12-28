import { clearCache, setCachedData } from '@/lib/cache/serverCache';
import { fetchTokenizedStockPools, fetchSolanaPools } from '@/lib/cache/poolFetchers';

const TOKENIZED_STOCK_POOLS_KEY = 'tokenizedStockPools';
const SOLANA_POOLS_KEY = 'solanaPools';
const OPERATION_TIMEOUT = 30000; // 30 seconds per operation

export interface RefreshResult {
  tokenizedStockPools: {
    success: boolean;
    count?: number;
    error?: string;
  };
  solanaPools: {
    success: boolean;
    count?: number;
    error?: string;
  };
  timestamp: string;
}

/**
 * Wraps an async operation with a timeout
 */
async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  return Promise.race([
    operation,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${errorMessage} (timeout after ${timeoutMs}ms)`)), timeoutMs)
    ),
  ]);
}

/**
 * Refreshes all cache data by fetching fresh pool data
 * This function can be called directly without HTTP overhead
 */
export async function refreshAllCaches(): Promise<RefreshResult> {
  console.log('🔄 [Cache Refresh] Starting background refresh of pool data...');
  
  // Clear existing cache to force fresh fetch
  clearCache(TOKENIZED_STOCK_POOLS_KEY);
  clearCache(SOLANA_POOLS_KEY);
  
  // Refresh both pool types in parallel with timeout protection
  const [tokenizedResult, solanaResult] = await Promise.all([
    (async () => {
      try {
        const pools = await withTimeout(
          fetchTokenizedStockPools(),
          OPERATION_TIMEOUT,
          'Tokenized stock pools fetch'
        );
        
        // Update cache with fresh data
        setCachedData(TOKENIZED_STOCK_POOLS_KEY, pools);
        
        return { success: true, count: pools.length };
      } catch (error) {
        console.error('❌ [Cache Refresh] Error refreshing tokenized stock pools:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    })(),
    (async () => {
      try {
        const pools = await withTimeout(
          fetchSolanaPools(),
          OPERATION_TIMEOUT,
          'Solana pools fetch'
        );
        
        // Update cache with fresh data
        setCachedData(SOLANA_POOLS_KEY, pools);
        
        return { success: true, count: pools.length };
      } catch (error) {
        console.error('❌ [Cache Refresh] Error refreshing Solana pools:', error);
        return { 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        };
      }
    })(),
  ]);
  
  const results: RefreshResult = {
    tokenizedStockPools: tokenizedResult,
    solanaPools: solanaResult,
    timestamp: new Date().toISOString(),
  };
  
  const allSuccess = tokenizedResult.success && solanaResult.success;
  
  if (allSuccess) {
    console.log(`✅ [Cache Refresh] Successfully refreshed all pools at ${results.timestamp}`);
    console.log(`   - Tokenized Stock Pools: ${tokenizedResult.count} pools`);
    console.log(`   - Solana Pools: ${solanaResult.count} pools`);
  } else {
    console.warn(`⚠️ [Cache Refresh] Partial refresh completed at ${results.timestamp}`);
    if (!tokenizedResult.success) {
      console.warn(`   - Tokenized Stock Pools failed: ${tokenizedResult.error}`);
    }
    if (!solanaResult.success) {
      console.warn(`   - Solana Pools failed: ${solanaResult.error}`);
    }
  }
  
  return results;
}

