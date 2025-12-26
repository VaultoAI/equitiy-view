'use client';

import { useAccount } from 'wagmi';
import { useQuery } from '@tanstack/react-query';
import { TokenBalance } from '@/lib/pools/types';
import { getTokenTransfers, getUniqueTokensFromTransfers, TokenInfo } from '@/lib/etherscan/client';

type TokenBalances = {
  [tokenAddress: string]: { usdValue: number; balance: number };
};

export function useTokenBalances() {
  const { address, isConnected } = useAccount();

  const { data, isLoading, error } = useQuery({
    queryKey: ['tokenBalances', address],
    queryFn: async () => {
      if (!address) {
        console.log('🔍 [Token Balances] No address provided, returning empty');
        return { tokens: [] };
      }

      console.log('🔍 [Token Balances] Fetching tokens for address:', address);
      
      try {
        // Step 1: Get all token transfers
        const transfers = await getTokenTransfers(address);
        
        if (transfers.length === 0) {
          console.log('⚠️ [Token Balances] No token transfers found');
          return { tokens: [] };
        }

        // Step 2: Extract unique tokens and get current balances
        const tokens = await getUniqueTokensFromTransfers(transfers, address);
        
        const tokenCount = tokens.length;
        console.log(`✅ [Token Balances] Found ${tokenCount} tokens with non-zero balance for address ${address}`);
        
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
    staleTime: 60000, // Cache for 1 minute
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
          },
        },
        quantity: balance,
        balanceUSD: usdValue,
      });
    });
  }

  if (balanceList.length > 0) {
    console.log(`📊 [Token Balances] Processed ${balanceList.length} tokens into balance list`);
  }

  return {
    balanceMap,
    balanceList,
    loading: isLoading,
    error,
  };
}

