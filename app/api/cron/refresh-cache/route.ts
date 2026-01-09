import { NextRequest, NextResponse } from 'next/server';
import { fetchTokenizedStockPools, fetchSolanaPools } from '@/lib/cache/poolFetchers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Cron-triggered data fetch endpoint (caching disabled)
 * Protected with secret token to prevent unauthorized access
 * 
 * Usage:
 * - Set CACHE_REFRESH_SECRET environment variable
 * - Call: POST /api/cron/refresh-cache?secret=YOUR_SECRET
 * - Or set Authorization header: Authorization: Bearer YOUR_SECRET
 * 
 * Can be used with:
 * - Vercel Cron Jobs
 * - GitHub Actions
 * - External cron services (cron-job.org, etc.)
 */
export async function GET(request: NextRequest) {
  return handleRequest(request);
}

export async function POST(request: NextRequest) {
  return handleRequest(request);
}

async function handleRequest(request: NextRequest) {
  try {
    // Get secret from environment variable
    const expectedSecret = process.env.CACHE_REFRESH_SECRET;
    
    if (!expectedSecret) {
      console.error('❌ [Cron Refresh] CACHE_REFRESH_SECRET not configured');
      return NextResponse.json(
        { error: 'Refresh not configured. CACHE_REFRESH_SECRET environment variable is required.' },
        { status: 500 }
      );
    }

    // Get secret from query parameter or Authorization header
    const searchParams = request.nextUrl.searchParams;
    const querySecret = searchParams.get('secret');
    const authHeader = request.headers.get('authorization');
    const headerSecret = authHeader?.replace('Bearer ', '');

    const providedSecret = querySecret || headerSecret;

    // Validate secret
    if (!providedSecret) {
      console.warn('⚠️ [Cron Refresh] No secret provided');
      return NextResponse.json(
        { error: 'Secret required. Provide ?secret=YOUR_SECRET or Authorization: Bearer YOUR_SECRET header' },
        { status: 401 }
      );
    }

    if (providedSecret !== expectedSecret) {
      console.warn('⚠️ [Cron Refresh] Invalid secret provided');
      return NextResponse.json(
        { error: 'Invalid secret' },
        { status: 403 }
      );
    }

    console.log('🔄 [Cron Refresh] Fetching fresh pool data...');

    // Fetch fresh data (no caching)
    const [tokenizedPools, solanaPools] = await Promise.all([
      fetchTokenizedStockPools().catch((err) => {
        console.error('❌ [Cron Refresh] Error fetching tokenized stock pools:', err);
        return { error: err instanceof Error ? err.message : 'Unknown error' };
      }),
      fetchSolanaPools().catch((err) => {
        console.error('❌ [Cron Refresh] Error fetching Solana pools:', err);
        return { error: err instanceof Error ? err.message : 'Unknown error' };
      }),
    ]);

    const tokenizedResult = Array.isArray(tokenizedPools)
      ? { success: true, count: tokenizedPools.length }
      : { success: false, error: (tokenizedPools as any).error || 'Unknown error' };

    const solanaResult = Array.isArray(solanaPools)
      ? { success: true, count: solanaPools.length }
      : { success: false, error: (solanaPools as any).error || 'Unknown error' };

    const result = {
      tokenizedStockPools: tokenizedResult,
      solanaPools: solanaResult,
      timestamp: new Date().toISOString(),
    };
    
    console.log(`✅ [Cron Refresh] Data fetch completed at ${result.timestamp}`);
    console.log(`   - Tokenized Stock Pools: ${tokenizedResult.success ? 'Success' : 'Failed'} (${tokenizedResult.count || 0} pools)`);
    console.log(`   - Solana Pools: ${solanaResult.success ? 'Success' : 'Failed'} (${solanaResult.count || 0} pools)`);

    const allSuccess = tokenizedResult.success && solanaResult.success;

    return NextResponse.json({
      success: allSuccess,
      message: allSuccess ? 'Data fetched successfully' : 'Data fetch completed with some errors',
      ...result,
    }, {
      status: allSuccess ? 200 : 207 // 207 Multi-Status for partial success
    });
  } catch (error) {
    console.error('❌ [Cron Refresh] Error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch pool data', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}


