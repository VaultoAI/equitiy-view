'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { gql } from '@apollo/client';
import { apolloClient } from '@/lib/graphql/client';
import { PoolTicksData, PoolTick } from '@/lib/pools/types';

interface PoolTicksResponse {
  pool: {
    id: string;
    tick: string;
    liquidity: string;
    sqrtPrice: string;
    feeTier: number;
    ticks: {
      tickIdx: string;
      liquidityGross: string;
      liquidityNet: string;
      price0: string;
      price1: string;
    }[];
  } | null;
}

const POOL_TICKS_QUERY = gql`
  query PoolTicks($poolId: ID!, $skip: Int!) {
    pool(id: $poolId) {
      id
      tick
      liquidity
      sqrtPrice
      feeTier
      ticks(skip: $skip, first: 1000) {
        tickIdx
        liquidityGross
        liquidityNet
        price0
        price1
      }
    }
  }
`;

export function usePoolTicks(poolAddress: string) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['poolTicks', poolAddress],
    queryFn: async () => {
      if (!poolAddress) {
        return { pool: null };
      }

      try {
        // Fetch ticks in batches (Uniswap subgraph limits to 1000 per request)
        let allTicks: PoolTick[] = [];
        let skip = 0;
        let hasMore = true;

        while (hasMore) {
          const { data: response } = await apolloClient.query<PoolTicksResponse>({
            query: POOL_TICKS_QUERY,
            variables: {
              poolId: poolAddress,
              skip,
            },
            fetchPolicy: 'network-only',
          });

          if (!response?.pool?.ticks || response.pool.ticks.length === 0) {
            hasMore = false;
            break;
          }

          // Convert tick data to proper format
          const ticks: PoolTick[] = response.pool.ticks.map(tick => ({
            tickIdx: parseInt(tick.tickIdx),
            liquidityGross: tick.liquidityGross,
            liquidityNet: tick.liquidityNet,
            price0: tick.price0,
            price1: tick.price1,
          }));

          allTicks = [...allTicks, ...ticks];

          // If we got less than 1000, we're done
          if (response.pool.ticks.length < 1000) {
            hasMore = false;
          } else {
            skip += 1000;
          }

          // Safety limit: don't fetch more than 5000 ticks
          if (allTicks.length >= 5000) {
            console.warn('Reached tick limit of 5000, stopping fetch');
            hasMore = false;
          }
        }

        // Get final pool data
        const { data: finalResponse } = await apolloClient.query<PoolTicksResponse>({
          query: POOL_TICKS_QUERY,
          variables: {
            poolId: poolAddress,
            skip: 0,
          },
          fetchPolicy: 'network-only',
        });

        if (!finalResponse?.pool) {
          return { pool: null };
        }

        return {
          pool: {
            ...finalResponse.pool,
            ticks: allTicks,
          },
        };
      } catch (err) {
        console.error('Error fetching pool ticks:', err);
        return { pool: null };
      }
    },
    enabled: !!poolAddress,
    staleTime: 60 * 1000, // 1 minute
  });

  const ticksData = useMemo<PoolTicksData | undefined>(() => {
    if (!data?.pool) {
      return undefined;
    }

    return {
      tick: parseInt(data.pool.tick),
      liquidity: data.pool.liquidity,
      sqrtPrice: data.pool.sqrtPrice,
      feeTier: data.pool.feeTier,
      ticks: data.pool.ticks,
    };
  }, [data]);

  return {
    loading: isLoading,
    error,
    data: ticksData,
  };
}
