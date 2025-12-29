import { NextRequest, NextResponse } from 'next/server';
import { getCachedDataIgnoringValidity, getCacheTimestamp, cacheExists, getCacheAge, isCacheValid } from '@/lib/cache/serverCache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TOKENIZED_STOCK_POOLS_KEY = 'tokenizedStockPools';
const SOLANA_POOLS_KEY = 'solanaPools';

export async function GET(request: NextRequest) {
  try {
    // Check cache status for both pool types
    const tokenizedData = getCachedDataIgnoringValidity<any[]>(TOKENIZED_STOCK_POOLS_KEY);
    const tokenizedTimestamp = getCacheTimestamp(TOKENIZED_STOCK_POOLS_KEY);
    const tokenizedAge = getCacheAge(TOKENIZED_STOCK_POOLS_KEY);
    const tokenizedValid = tokenizedTimestamp ? isCacheValid(tokenizedTimestamp) : false;
    
    const solanaData = getCachedDataIgnoringValidity<any[]>(SOLANA_POOLS_KEY);
    const solanaTimestamp = getCacheTimestamp(SOLANA_POOLS_KEY);
    const solanaAge = getCacheAge(SOLANA_POOLS_KEY);
    const solanaValid = solanaTimestamp ? isCacheValid(solanaTimestamp) : false;

    return NextResponse.json({
      tokenizedStockPools: {
        exists: cacheExists(TOKENIZED_STOCK_POOLS_KEY),
        hasData: tokenizedData !== null,
        count: tokenizedData?.length || 0,
        timestamp: tokenizedTimestamp,
        age: tokenizedAge,
        ageFormatted: tokenizedAge ? `${Math.floor(tokenizedAge / 1000)}s` : null,
        isValid: tokenizedValid,
        timestampFormatted: tokenizedTimestamp ? new Date(tokenizedTimestamp).toISOString() : null,
      },
      solanaPools: {
        exists: cacheExists(SOLANA_POOLS_KEY),
        hasData: solanaData !== null,
        count: solanaData?.length || 0,
        timestamp: solanaTimestamp,
        age: solanaAge,
        ageFormatted: solanaAge ? `${Math.floor(solanaAge / 1000)}s` : null,
        isValid: solanaValid,
        timestampFormatted: solanaTimestamp ? new Date(solanaTimestamp).toISOString() : null,
      },
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
