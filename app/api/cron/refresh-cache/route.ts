import { NextRequest, NextResponse } from 'next/server';
import { refreshAllCaches } from '@/lib/cache/refreshCache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Cron-triggered cache refresh endpoint
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
        { error: 'Cache refresh not configured. CACHE_REFRESH_SECRET environment variable is required.' },
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

    console.log('🔄 [Cron Refresh] Starting cache refresh...');

    // Call the refresh function directly (no HTTP overhead)
    const result = await refreshAllCaches();
    
    console.log(`✅ [Cron Refresh] Cache refresh completed at ${result.timestamp}`);
    console.log(`   - Tokenized Stock Pools: ${result.tokenizedStockPools.success ? 'Success' : 'Failed'} (${result.tokenizedStockPools.count || 0} pools)`);
    console.log(`   - Solana Pools: ${result.solanaPools.success ? 'Success' : 'Failed'} (${result.solanaPools.count || 0} pools)`);

    const allSuccess = result.tokenizedStockPools.success && result.solanaPools.success;

    return NextResponse.json({
      success: allSuccess,
      message: allSuccess ? 'Cache refreshed successfully' : 'Cache refresh completed with some errors',
      ...result,
    }, {
      status: allSuccess ? 200 : 207 // 207 Multi-Status for partial success
    });
  } catch (error) {
    console.error('❌ [Cron Refresh] Error:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to refresh cache', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}


