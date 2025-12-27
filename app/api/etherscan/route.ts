import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ETHERSCAN_API_KEY = process.env.NEXT_PUBLIC_ETHERSCAN_API_KEY || 'YourApiKeyToken';
// V2 API base URL
const ETHERSCAN_BASE_URL = 'https://api.etherscan.io/v2/api';
const CHAIN_ID = 1; // Default to Ethereum mainnet

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');
    const address = searchParams.get('address');
    const contractAddress = searchParams.get('contractAddress') || searchParams.get('contractaddress');
    const chainId = searchParams.get('chainid') || searchParams.get('chainId') || String(CHAIN_ID);
    const page = searchParams.get('page');
    const offset = searchParams.get('offset');

    if (!action || !address) {
      return NextResponse.json(
        { error: 'Missing required parameters: action and address' },
        { status: 400 }
      );
    }

    // V2 API format: chainid={chainId}&module=account&action=...
    // According to docs: https://api.etherscan.io/v2/api?chainid={chainId}&module=account&action=tokenbalance&contractaddress={token}&address={wallet}&tag=latest&apikey={key}
    let url = `${ETHERSCAN_BASE_URL}?chainid=${chainId}&module=account&action=${action}&apikey=${ETHERSCAN_API_KEY}`;

    // Add address parameter and action-specific parameters
    if (action === 'tokentx') {
      url += `&address=${address}&startblock=0&endblock=99999999&sort=asc`;
    } else if (action === 'tokenbalance') {
      // For tokenbalance, both contractaddress and address are required
      if (!contractAddress) {
        return NextResponse.json(
          { error: 'Missing required parameter: contractAddress for tokenbalance action' },
          { status: 400 }
        );
      }
      url += `&contractaddress=${contractAddress}&address=${address}&tag=latest`;
    } else if (action === 'addresstokenbalance') {
      // For addresstokenbalance, address, page, and offset are required
      url += `&address=${address}`;
      if (page) {
        url += `&page=${page}`;
      }
      if (offset) {
        url += `&offset=${offset}`;
      }
    } else {
      url += `&address=${address}`;
      if (action === 'balance') {
        url += '&tag=latest';
      }
    }

    console.log(`🔍 [Etherscan V2 Proxy] ${action} for ${address} on chain ${chainId}${contractAddress ? ` (token: ${contractAddress})` : ''}`);
    console.log(`🔍 [Etherscan V2 Proxy] Full URL: ${url.replace(ETHERSCAN_API_KEY, '***')}`);
    
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === '1') {
      if (action === 'tokenbalance') {
        console.log(`✅ [Etherscan V2 Proxy] Balance fetched: ${data.result} for token ${contractAddress}`);
      } else if (action === 'tokentx') {
        const count = Array.isArray(data.result) ? data.result.length : 0;
        console.log(`✅ [Etherscan V2 Proxy] Found ${count} token transfers`);
      } else if (action === 'addresstokenbalance') {
        const count = Array.isArray(data.result) ? data.result.length : 0;
        console.log(`✅ [Etherscan V2 Proxy] Found ${count} token balances${page ? ` (page ${page})` : ''}`);
      } else {
        console.log(`✅ [Etherscan V2 Proxy] Success for ${action}`);
      }
    } else {
      console.warn(`⚠️ [Etherscan V2 Proxy] API Error: ${data.message || 'Unknown error'}`, data.result);
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('❌ [Etherscan V2 Proxy] Error:', error);
    return NextResponse.json(
      { error: 'Etherscan request failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

