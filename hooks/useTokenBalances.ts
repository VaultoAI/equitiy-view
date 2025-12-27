'use client';

import { useEffect } from 'react';
import { useAccount } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import { TokenBalance } from '@/lib/pools/types';
import { getTokensFromAllChains, TokenInfo } from '@/lib/etherscan/client';
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
        // Step 1: Get tokens from all supported chains
        const tokens = await getTokensFromAllChains(address);
        
        // Update cache with fetched tokens
        setWalletTokensCache(address, tokens);
        
        const tokenCount = tokens.length;
        console.log(`✅ [Token Balances] Found ${tokenCount} tokens with non-zero balance across all chains for address ${address}`);
        console.log(`💾 [Token Balances] Cached ${tokenCount} tokens for 24 hours`);
        
        if (tokenCount > 0) {
          console.log('📋 [Token Balances] Token list:');
          tokens.forEach((token, index) => {
            const balance = parseFloat(token.balance) / Math.pow(10, token.decimals);
            console.log(`  ${index + 1}. ${token.symbol} (${token.name}) on ${token.chain}`);
            console.log(`     Address: ${token.address}`);
            console.log(`     Chain ID: ${token.chainId}`);
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
    console.log(`📊 [Token Balances] Processing ${data.tokens.length} tokens...`);
    
    data.tokens.forEach((token: TokenInfo, index: number) => {
      // Parse raw balance string to number using BigInt for precision
      const rawBalance = token.balance;
      const decimals = token.decimals;
      
      // Use BigInt for precise calculation to avoid floating point errors
      const balanceBigInt = BigInt(rawBalance || '0');
      const divisor = BigInt(10 ** decimals);
      const wholePart = balanceBigInt / divisor;
      const fractionalPart = balanceBigInt % divisor;
      const balance = Number(wholePart) + Number(fractionalPart) / Number(divisor);
      
      const chainId = token.chainId || 1;
      const normalizedAddress = token.address.toLowerCase();
      
      // Log token details
      console.log(`  ${index + 1}. ${token.symbol} (${token.name})`);
      console.log(`     Chain: ${token.chain} (${chainId})`);
      console.log(`     Address: ${token.address}`);
      console.log(`     Balance: ${balance.toFixed(6)}`);

      balanceMap[normalizedAddress] = { usdValue: 0, balance };

      balanceList.push({
        currencyInfo: {
          currency: {
            id: token.address,
            name: token.name,
            symbol: token.symbol,
            decimals: token.decimals,
            address: token.address,
            chain: token.chain || 'ETHEREUM',
            logoURI: getTokenLogoUrl(token.address, token.chainId || 1),
          },
        },
        quantity: balance,
        balanceUSD: 0,
      });
    });
    
    console.log(`✅ [Token Balances] Processed ${balanceList.length} tokens into balance list`);
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

