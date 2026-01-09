'use client';

import { useQuery } from '@tanstack/react-query';
import { gql } from '@apollo/client';
import { apolloClient } from '@/lib/graphql/client';
import { PoolTransaction } from '@/lib/pools/types';

interface SwapResponse {
  id: string;
  transaction: {
    id: string;
    timestamp: number;
  };
  sender: string;
  recipient: string;
  amount0: string;
  amount1: string;
  amountUSD: string;
  pool: {
    token0: {
      symbol: string;
      decimals: number;
    };
    token1: {
      symbol: string;
      decimals: number;
    };
  };
}

interface MintResponse {
  id: string;
  transaction: {
    id: string;
    timestamp: number;
  };
  owner: string;
  sender: string;
  amount: string;
  amount0: string;
  amount1: string;
  amountUSD: string;
  pool: {
    token0: {
      symbol: string;
      decimals: number;
    };
    token1: {
      symbol: string;
      decimals: number;
    };
  };
}

interface BurnResponse {
  id: string;
  transaction: {
    id: string;
    timestamp: number;
  };
  owner: string;
  amount: string;
  amount0: string;
  amount1: string;
  amountUSD: string;
  pool: {
    token0: {
      symbol: string;
      decimals: number;
    };
    token1: {
      symbol: string;
      decimals: number;
    };
  };
}

interface PoolTransactionsResponse {
  swaps: SwapResponse[];
  mints: MintResponse[];
  burns: BurnResponse[];
}

const POOL_TRANSACTIONS_QUERY = gql`
  query PoolTransactions($poolId: ID!, $first: Int!) {
    swaps(
      where: { pool: $poolId }
      orderBy: timestamp
      orderDirection: desc
      first: $first
    ) {
      id
      transaction {
        id
        timestamp
      }
      sender
      recipient
      amount0
      amount1
      amountUSD
      pool {
        token0 {
          symbol
          decimals
        }
        token1 {
          symbol
          decimals
        }
      }
    }
    mints(
      where: { pool: $poolId }
      orderBy: timestamp
      orderDirection: desc
      first: $first
    ) {
      id
      transaction {
        id
        timestamp
      }
      owner
      sender
      amount
      amount0
      amount1
      amountUSD
      pool {
        token0 {
          symbol
          decimals
        }
        token1 {
          symbol
          decimals
        }
      }
    }
    burns(
      where: { pool: $poolId }
      orderBy: timestamp
      orderDirection: desc
      first: $first
    ) {
      id
      transaction {
        id
        timestamp
      }
      owner
      amount
      amount0
      amount1
      amountUSD
      pool {
        token0 {
          symbol
          decimals
        }
        token1 {
          symbol
          decimals
        }
      }
    }
  }
`;

function transformTransactions(response: PoolTransactionsResponse): PoolTransaction[] {
  const transactions: PoolTransaction[] = [];

  // Transform swaps
  response.swaps.forEach((swap) => {
    transactions.push({
      type: 'swap',
      timestamp: swap.transaction.timestamp,
      transactionHash: swap.transaction.id,
      amount0: swap.amount0,
      amount1: swap.amount1,
      amountUSD: swap.amountUSD,
      sender: swap.sender,
      token0Symbol: swap.pool.token0.symbol,
      token1Symbol: swap.pool.token1.symbol,
      token0Decimals: swap.pool.token0.decimals,
      token1Decimals: swap.pool.token1.decimals,
    });
  });

  // Transform mints
  response.mints.forEach((mint) => {
    transactions.push({
      type: 'mint',
      timestamp: mint.transaction.timestamp,
      transactionHash: mint.transaction.id,
      amount0: mint.amount0,
      amount1: mint.amount1,
      amountUSD: mint.amountUSD,
      sender: mint.sender,
      owner: mint.owner,
      token0Symbol: mint.pool.token0.symbol,
      token1Symbol: mint.pool.token1.symbol,
      token0Decimals: mint.pool.token0.decimals,
      token1Decimals: mint.pool.token1.decimals,
    });
  });

  // Transform burns
  response.burns.forEach((burn) => {
    transactions.push({
      type: 'burn',
      timestamp: burn.transaction.timestamp,
      transactionHash: burn.transaction.id,
      amount0: burn.amount0,
      amount1: burn.amount1,
      amountUSD: burn.amountUSD,
      owner: burn.owner,
      token0Symbol: burn.pool.token0.symbol,
      token1Symbol: burn.pool.token1.symbol,
      token0Decimals: burn.pool.token0.decimals,
      token1Decimals: burn.pool.token1.decimals,
    });
  });

  // Sort all transactions by timestamp descending
  return transactions.sort((a, b) => b.timestamp - a.timestamp);
}

export function usePoolTransactions(poolIdOrAddress: string, limit: number = 100) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['poolTransactions', poolIdOrAddress, limit],
    queryFn: async () => {
      if (!poolIdOrAddress) {
        return [];
      }

      try {
        // Normalize pool address to lowercase (subgraph expects lowercase)
        const normalizedPoolId = poolIdOrAddress.toLowerCase();
        
        const { data: response } = await apolloClient.query<PoolTransactionsResponse>({
          query: POOL_TRANSACTIONS_QUERY,
          variables: {
            poolId: normalizedPoolId,
            first: limit,
          },
          fetchPolicy: 'network-only',
        });

        return transformTransactions(response);
      } catch (err) {
        console.error('Error fetching pool transactions:', err);
        return [];
      }
    },
    enabled: !!poolIdOrAddress,
    staleTime: 60000, // 1 minute
  });

  return {
    data: data || [],
    loading: isLoading,
    error: error as Error | null,
  };
}
