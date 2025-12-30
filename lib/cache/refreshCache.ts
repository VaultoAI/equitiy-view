import { 
  clearCache, 
  setCachedData, 
  cacheExists, 
  verifyCacheCleared, 
  verifyCacheSet,
  logCacheState 
} from '@/lib/cache/serverCache';
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
  console.log('🔄 [Cache Refresh] Starting comprehensive cache refresh...');
  
  // Log initial cache state
  const initialTokenizedExists = cacheExists(TOKENIZED_STOCK_POOLS_KEY);
  const initialSolanaExists = cacheExists(SOLANA_POOLS_KEY);
  console.log(`📊 [Cache Refresh] Initial cache state:`, {
    tokenizedStockPools: initialTokenizedExists,
    solanaPools: initialSolanaExists,
  });
  
  // Clear existing cache to force fresh fetch
  clearCache(TOKENIZED_STOCK_POOLS_KEY);
  clearCache(SOLANA_POOLS_KEY);
  
  // Verify cache was cleared
  const tokenizedCleared = verifyCacheCleared(TOKENIZED_STOCK_POOLS_KEY);
  const solanaCleared = verifyCacheCleared(SOLANA_POOLS_KEY);
  
  if (!tokenizedCleared || !solanaCleared) {
    console.warn('⚠️ [Cache Refresh] Cache clearing verification failed:', {
      tokenizedStockPools: tokenizedCleared,
      solanaPools: solanaCleared,
    });
  } else {
    console.log('✅ [Cache Refresh] Cache cleared and verified');
  }
  
  // Refresh both pool types in parallel with timeout protection
  const [tokenizedResult, solanaResult] = await Promise.all([
    (async () => {
      try {
        const pools = await withTimeout(
          fetchTokenizedStockPools(),
          OPERATION_TIMEOUT,
          'Tokenized stock pools fetch'
        );
        
        // Update cache with fresh data only after successful fetch
        setCachedData(TOKENIZED_STOCK_POOLS_KEY, pools);
        
        // Verify cache was set correctly
        const verification = verifyCacheSet(TOKENIZED_STOCK_POOLS_KEY, pools.length);
        if (!verification.isSet || !verification.hasData) {
          console.error('❌ [Cache Refresh] Failed to verify tokenized stock pools cache was set');
        } else {
          console.log(`✅ [Cache Refresh] Tokenized stock pools cache verified: ${verification.dataLength ?? pools.length} pools`);
        }
        
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
        
        // Update cache with fresh data only after successful fetch
        setCachedData(SOLANA_POOLS_KEY, pools);
        
        // Verify cache was set correctly
        const verification = verifyCacheSet(SOLANA_POOLS_KEY, pools.length);
        if (!verification.isSet || !verification.hasData) {
          console.error('❌ [Cache Refresh] Failed to verify Solana pools cache was set');
        } else {
          console.log(`✅ [Cache Refresh] Solana pools cache verified: ${verification.dataLength ?? pools.length} pools`);
        }
        
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
  
  // Log final cache state
  if (allSuccess) {
    console.log(`✅ [Cache Refresh] Successfully refreshed all pools at ${results.timestamp}`);
    console.log(`   - Tokenized Stock Pools: ${tokenizedResult.count} pools`);
    console.log(`   - Solana Pools: ${solanaResult.count} pools`);
    
    // Log final cache state for verification
    logCacheState();
  } else {
    console.warn(`⚠️ [Cache Refresh] Partial refresh completed at ${results.timestamp}`);
    if (!tokenizedResult.success) {
      console.warn(`   - Tokenized Stock Pools failed: ${tokenizedResult.error}`);
    }
    if (!solanaResult.success) {
      console.warn(`   - Solana Pools failed: ${solanaResult.error}`);
    }
    
    // Log cache state even on partial failure
    logCacheState();
  }
  
  return results;
}

