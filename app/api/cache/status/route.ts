import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Caching has been disabled - data is always fetched fresh
    return NextResponse.json({
      message: 'Caching is disabled - data is always fetched fresh on each request',
      cacheEnabled: false,
    });
  } catch (error) {
    console.error('❌ [Cache Status] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to get cache status', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
