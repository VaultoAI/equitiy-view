import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const METEORA_API_URL = 'https://dlmm-api.meteora.ag/pair/all';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [Meteora Proxy] Fetching all pairs from Meteora API...');
    
    const response = await fetch(METEORA_API_URL, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [Meteora Proxy] HTTP Error ${response.status}: ${errorText}`);
      throw new Error(`Meteora API request failed: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Log success with pool count
    const poolsCount = Array.isArray(data) ? data.length : 0;
    console.log(`✅ [Meteora Proxy] Successfully fetched ${poolsCount} pools from Meteora API`);

    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ [Meteora Proxy] Error:', error);
    return NextResponse.json(
      { error: 'Meteora API request failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

