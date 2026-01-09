import { NextRequest, NextResponse } from 'next/server';
import { fetchTokenizedStockPools, fetchSolanaPools } from '@/lib/cache/poolFetchers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Fetch fresh data (no caching)
    console.log('🔄 [Cache Refresh] Fetching fresh pool data...');
    
    const [tokenizedPools, solanaPools] = await Promise.all([
      fetchTokenizedStockPools().catch((err) => {
        console.error('❌ [Cache Refresh] Error fetching tokenized stock pools:', err);
        return { error: err instanceof Error ? err.message : 'Unknown error' };
      }),
      fetchSolanaPools().catch((err) => {
        console.error('❌ [Cache Refresh] Error fetching Solana pools:', err);
        return { error: err instanceof Error ? err.message : 'Unknown error' };
      }),
    ]);

    const tokenizedResult = Array.isArray(tokenizedPools)
      ? { success: true, count: tokenizedPools.length }
      : { success: false, error: (tokenizedPools as any).error || 'Unknown error' };

    const solanaResult = Array.isArray(solanaPools)
      ? { success: true, count: solanaPools.length }
      : { success: false, error: (solanaPools as any).error || 'Unknown error' };

    const results = {
      tokenizedStockPools: tokenizedResult,
      solanaPools: solanaResult,
      timestamp: new Date().toISOString(),
      message: 'Data fetched fresh (caching disabled)',
    };

    const allSuccess = tokenizedResult.success && solanaResult.success;
    
    return NextResponse.json(results, { 
      status: allSuccess ? 200 : 207 // 207 Multi-Status for partial success
    });
  } catch (error) {
    console.error('❌ [Cache Refresh] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch pool data', 
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


