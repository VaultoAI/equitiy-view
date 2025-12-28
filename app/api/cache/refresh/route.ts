import { NextRequest, NextResponse } from 'next/server';
import { refreshAllCaches } from '@/lib/cache/refreshCache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // Use the shared refresh function (no HTTP overhead)
    const results = await refreshAllCaches();
    
    const allSuccess = results.tokenizedStockPools.success && results.solanaPools.success;
    
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


