import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // The Graph docs: use Bearer auth (Authorization header) + base URL (no key in path).
    // Subgraph ID for Uniswap V3: 5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV
    const graphApiKey = process.env.NEXT_PUBLIC_THE_GRAPH_API_KEY || process.env.THE_GRAPH_API_KEY;
    const customUrl = process.env.NEXT_PUBLIC_UNISWAP_GRAPHQL_URL;
    const SUBGRAPH_ID = '5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV';
    const GATEWAY_BASE = 'https://gateway.thegraph.com/api/subgraphs/id';

    let graphqlUrl: string;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    if (customUrl) {
      graphqlUrl = customUrl;
      console.log(`🔍 [GraphQL Proxy] Using custom URL: ${customUrl}`);
    } else {
      graphqlUrl = `${GATEWAY_BASE}/${SUBGRAPH_ID}`;
      if (graphApiKey) {
        headers['Authorization'] = `Bearer ${graphApiKey}`;
        console.log(`🔍 [GraphQL Proxy] Using Gateway with Bearer auth`);
      } else {
        console.warn(`⚠️ [GraphQL Proxy] No API key. Using public endpoint (may fail). Get key: https://thegraph.com/studio/apikeys/`);
      }
    }

    console.log(`🔍 [GraphQL Proxy] Forwarding query to ${graphqlUrl}`);
    if (body.query) {
      const queryPreview = body.query.replace(/\s+/g, ' ').substring(0, 200);
      console.log(`📝 [GraphQL Proxy] Query: ${queryPreview}...`);
      if (body.variables) {
        console.log(`📝 [GraphQL Proxy] Variables:`, JSON.stringify(body.variables));
      }
    }

    const response = await fetch(graphqlUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [GraphQL Proxy] HTTP Error ${response.status}: ${errorText}`);
      throw new Error(`GraphQL request failed: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Log the full response for debugging
    console.log(`📊 [GraphQL Proxy] Full response:`, JSON.stringify(data, null, 2));
    
    if (data.errors && data.errors.length > 0) {
      console.error(`⚠️ [GraphQL Proxy] GraphQL errors:`, data.errors);
      data.errors.forEach((error: any) => {
        console.error(`  - ${error.message}`, error.extensions || '');
      });
    } else if (data.data) {
      // Log different success messages based on query type
      if (data.data.pools) {
        console.log(`✅ [GraphQL Proxy] Successfully fetched ${data.data.pools.length} pools`);
      } else if (data.data.pool) {
        console.log(`✅ [GraphQL Proxy] Successfully fetched pool: ${data.data.pool.id}, ticks: ${data.data.pool.ticks?.length || 0}`);
      } else if (data.data.swaps) {
        console.log(`✅ [GraphQL Proxy] Successfully fetched ${data.data.swaps.length} swaps`);
      } else {
        console.log(`✅ [GraphQL Proxy] Query succeeded`);
      }
    }

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('❌ [GraphQL Proxy] Error:', error);
    return NextResponse.json(
      { error: 'GraphQL request failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { 
        status: 500,
        headers: {
          'Cache-Control': 'no-store',
        },
      }
    );
  }
}

