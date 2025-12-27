import { NextRequest, NextResponse } from 'next/server';
import { clearCache, setCachedData } from '@/lib/cache/serverCache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TOKENIZED_STOCK_POOLS_KEY = 'tokenizedStockPools';
const SOLANA_POOLS_KEY = 'solanaPools';

/**
 * Fetches fresh tokenized stock pools data
 */
async function refreshTokenizedStockPools(): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    // Get the base URL for internal API calls
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    
    const response = await fetch(`${baseUrl}/api/cache/tokenized-stock-pools`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Force refresh by bypassing cache
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Failed to refresh tokenized stock pools: ${response.statusText}`);
    }

    const data = await response.json();
    const pools = data.pools || [];
    
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
}

/**
 * Fetches fresh Solana pools data
 */
async function refreshSolanaPools(): Promise<{ success: boolean; count?: number; error?: string }> {
  try {
    // Get the base URL for internal API calls
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    
    const response = await fetch(`${baseUrl}/api/cache/solana-pools`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Force refresh by bypassing cache
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`Failed to refresh Solana pools: ${response.statusText}`);
    }

    const data = await response.json();
    const pools = data.pools || [];
    
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
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 [Cache Refresh] Starting background refresh of pool data...');
    
    // Clear existing cache to force fresh fetch
    clearCache(TOKENIZED_STOCK_POOLS_KEY);
    clearCache(SOLANA_POOLS_KEY);
    
    // Refresh both pool types in parallel
    const [tokenizedResult, solanaResult] = await Promise.all([
      refreshTokenizedStockPools(),
      refreshSolanaPools(),
    ]);
    
    const results = {
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
    
    return NextResponse.json(results, { 
      status: allSuccess ? 200 : 207 // 207 Multi-Status for partial success
    });
  } catch (error) {
    console.error('❌ [Cache Refresh] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to refresh cache', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

// Also support GET for easier testing
export async function GET(request: NextRequest) {
  return POST(request);
}

