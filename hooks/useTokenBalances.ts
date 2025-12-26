'use client';

import { useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import { TokenBalance } from '@/lib/pools/types';
import { getTokenTransfers, getUniqueTokensFromTransfers, TokenInfo } from '@/lib/etherscan/client';
import { getWalletTokensCache, setWalletTokensCache } from '@/lib/cache/walletCache';
import { getTokenLogoUrl } from '@/lib/utils/tokenLogo';

type TokenBalances = {
  [tokenAddress: string]: { usdValue: number; balance: number };
};

export function useTokenBalances() {
  const { address, isConnected } = useAccount();

  const { data, isLoading, error } = useQuery({
    queryKey: ['tokenBalances', address, 'v1'],
    queryFn: async () => {
      if (!address) {
        console.log('🔍 [Token Balances] No address provided, returning empty');
        return { tokens: [] };
      }

      // Check cache first
      const cachedTokens = getWalletTokensCache(address);
      if (cachedTokens !== null) {
        console.log(`✅ [Token Balances] Using cached tokens for address ${address} (${cachedTokens.length} tokens)`);
        return { tokens: cachedTokens };
      }

      console.log('🔍 [Token Balances] Cache miss or expired, fetching tokens for address:', address);
      
      try {
        // Step 1: Get all token transfers
        const transfers = await getTokenTransfers(address);
        
        if (transfers.length === 0) {
          console.log('⚠️ [Token Balances] No token transfers found');
          // Cache empty result to avoid repeated API calls
          setWalletTokensCache(address, []);
          return { tokens: [] };
        }

        // Step 2: Extract unique tokens and get current balances
        const tokens = await getUniqueTokensFromTransfers(transfers, address);
        
        // Update cache with fetched tokens
        setWalletTokensCache(address, tokens);
        
        const tokenCount = tokens.length;
        console.log(`✅ [Token Balances] Found ${tokenCount} tokens with non-zero balance for address ${address}`);
        console.log(`💾 [Token Balances] Cached ${tokenCount} tokens for 24 hours`);
        
        if (tokenCount > 0) {
          console.log('📋 [Token Balances] Token list:');
          tokens.forEach((token, index) => {
            const balance = parseFloat(token.balance) / Math.pow(10, token.decimals);
            console.log(`  ${index + 1}. ${token.symbol} (${token.name})`);
            console.log(`     Address: ${token.address}`);
            console.log(`     Balance: ${balance.toFixed(4)}`);
            console.log(`     Decimals: ${token.decimals}`);
          });
        }

        return { tokens };
      } catch (err) {
        console.error('❌ [Token Balances] Error fetching token balances:', err);
        return { tokens: [] };
      }
    },
    enabled: isConnected && !!address,
    staleTime: 24 * 60 * 60 * 1000, // Cache for 24 hours (matches localStorage cache duration)
  });

  const balanceMap: TokenBalances = {};
  const balanceList: TokenBalance[] = [];

  if (data?.tokens) {
    data.tokens.forEach((token: TokenInfo) => {
      const balance = parseFloat(token.balance) / Math.pow(10, token.decimals);
      // Note: USD value would require price API - setting to 0 for now
      const usdValue = 0;

      balanceMap[token.address.toLowerCase()] = { usdValue, balance };

      balanceList.push({
        currencyInfo: {
          currency: {
            id: token.address,
            name: token.name,
            symbol: token.symbol,
            decimals: token.decimals,
            address: token.address,
            chain: 'ETHEREUM',
            logoURI: getTokenLogoUrl(token.address, 1),
          },
        },
        quantity: balance,
        balanceUSD: usdValue,
      });
    });
  }

  // Only log when balanceList length changes, not on every render
  useEffect(() => {
    if (balanceList.length > 0) {
      console.log(`📊 [Token Balances] Processed ${balanceList.length} tokens into balance list`);
    }
  }, [balanceList.length]);

  return {
    balanceMap,
    balanceList,
    loading: isLoading,
    error,
  };
}

