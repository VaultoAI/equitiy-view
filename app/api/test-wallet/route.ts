import { NextRequest, NextResponse } from 'next/server';
import { getAddressTokenBalances, getTokensFromAllChains, TokenInfo } from '@/lib/etherscan/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const address = searchParams.get('address') || '0x540BA6f6c0f2828D8514F941109EA462A502aA77';
  const chainId = searchParams.get('chainId') ? parseInt(searchParams.get('chainId')!) : undefined;
  const allChains = searchParams.get('allChains') === 'true';

  try {
    let tokens: TokenInfo[] = [];
    let testResults: any = {
      walletAddress: address,
      timestamp: new Date().toISOString(),
    };

    let rawApiResponse: any = null;
    
    if (allChains) {
      // Test: Fetch from all chains
      console.log(`\n🔍 [Test] Fetching tokens from ALL chains for ${address}`);
      tokens = await getTokensFromAllChains(address);
      testResults.method = 'getTokensFromAllChains';
      testResults.chains = 'all';
    } else if (chainId) {
      // Test: Fetch from specific chain
      console.log(`\n🔍 [Test] Fetching tokens from chain ${chainId} for ${address}`);
      tokens = await getAddressTokenBalances(address, chainId, 1, 1000);
      testResults.method = 'getAddressTokenBalances';
      testResults.chainId = chainId;
      
      // Also test the raw API call to see what we get
      try {
        const testUrl = `/api/etherscan?chainid=${chainId}&module=account&action=addresstokenbalance&address=${address}&page=1&offset=1000`;
        const testResponse = await fetch(`http://localhost:3000${testUrl}`);
        rawApiResponse = await testResponse.json();
        testResults.rawApiResponse = rawApiResponse;
      } catch (e) {
        testResults.rawApiError = e instanceof Error ? e.message : 'Unknown error';
      }
    } else {
      // Test: Fetch from Ethereum mainnet
      console.log(`\n🔍 [Test] Fetching tokens from Ethereum mainnet for ${address}`);
      tokens = await getAddressTokenBalances(address, 1, 1, 1000);
      testResults.method = 'getAddressTokenBalances';
      testResults.chainId = 1;
      
      // Also test the raw API call to see what we get
      try {
        const testUrl = `/api/etherscan?chainid=1&module=account&action=addresstokenbalance&address=${address}&page=1&offset=1000`;
        const testResponse = await fetch(`http://localhost:3000${testUrl}`);
        rawApiResponse = await testResponse.json();
        testResults.rawApiResponse = rawApiResponse;
      } catch (e) {
        testResults.rawApiError = e instanceof Error ? e.message : 'Unknown error';
      }
    }

    testResults.totalTokens = tokens.length;

    // Group tokens by chain
    const tokensByChain = new Map<number, TokenInfo[]>();
    tokens.forEach(token => {
      const chain = token.chainId;
      if (!tokensByChain.has(chain)) {
        tokensByChain.set(chain, []);
      }
      tokensByChain.get(chain)!.push(token);
    });

    testResults.tokensByChain = Array.from(tokensByChain.entries()).map(([chainId, chainTokens]) => ({
      chainId,
      chainName: chainTokens[0]?.chain || 'UNKNOWN',
      tokenCount: chainTokens.length,
    }));

    // Process tokens with balances
    const processedTokens = tokens.map((token) => {
      const balance = BigInt(token.balance);
      const divisor = BigInt(10 ** token.decimals);
      const wholePart = balance / divisor;
      const fractionalPart = balance % divisor;
      const balanceNum = Number(wholePart) + Number(fractionalPart) / Number(divisor);

      return {
        symbol: token.symbol,
        name: token.name,
        address: token.address,
        balance: balanceNum,
        balanceRaw: token.balance,
        decimals: token.decimals,
        chainId: token.chainId,
        chain: token.chain,
      };
    });

    testResults.tokens = processedTokens;

    return NextResponse.json(testResults, { status: 200 });
  } catch (error) {
    console.error('❌ [Test] Error:', error);
    return NextResponse.json(
      {
        error: 'Test failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        walletAddress: address,
      },
      { status: 500 }
    );
  }
}

