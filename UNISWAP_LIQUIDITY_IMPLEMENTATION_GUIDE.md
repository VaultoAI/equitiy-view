# Uniswap Liquidity Providing Implementation Guide

This guide extracts the exact implementation patterns from Uniswap's interface to rebuild their liquidity providing feature from scratch.

## Table of Contents

1. [Wallet Connection & Token Balance Fetching](#1-wallet-connection--token-balance-fetching)
2. [Pool Discovery & Filtering by Wallet Tokens](#2-pool-discovery--filtering-by-wallet-tokens)
3. [Pool List Display Component](#3-pool-list-display-component)
4. [Pool Details Page](#4-pool-details-page)
5. [Create Position / Add Liquidity Flow](#5-create-position--add-liquidity-flow)
6. [Routing Configuration](#6-routing-configuration)
7. [APR Calculation](#7-apr-calculation)
8. [Transaction Execution](#8-transaction-execution)

---

## 1. Wallet Connection & Token Balance Fetching

### Key Implementation Files

**File: `interface/apps/web/src/hooks/useTokenBalances.ts`**

This hook provides a simple interface for accessing token balances from the connected wallet.

```typescript:interface/apps/web/src/hooks/useTokenBalances.ts
import { useActiveAddresses } from 'features/accounts/store/hooks'
import { useMemo } from 'react'
import { usePortfolioBalances } from 'uniswap/src/features/dataApi/balances/balances'
import { PortfolioBalance } from 'uniswap/src/features/dataApi/types'
import { currencyKey } from 'utils/currencyKey'

type TokenBalances = { [tokenAddress: string]: { usdValue: number; balance: number } }

/**
 * Returns the user's token balances via the factory hook that switches between GraphQL and REST.
 */
export function useTokenBalances({ cacheOnly }: { cacheOnly?: boolean } = {}): {
  balanceMap: TokenBalances
  balanceList: readonly PortfolioBalance[]
  loading: boolean
} {
  const activeAddresses = useActiveAddresses()
  const evmAddress = activeAddresses.evmAddress
  const svmAddress = activeAddresses.svmAddress

  // Use the factory hook that handles GraphQL/REST switching
  const { data: balancesById, loading } = usePortfolioBalances({
    evmAddress,
    svmAddress,
    fetchPolicy: cacheOnly ? 'cache-first' : 'cache-and-network',
  })

  return useMemo(() => {
    if (!balancesById) {
      return { balanceMap: {}, balanceList: [], loading }
    }

    const balanceList = Object.values(balancesById)
    const balanceMap = balanceList.reduce((balanceMap, tokenBalance) => {
      const currency = tokenBalance.currencyInfo.currency
      const key = currencyKey(currency)
      const usdValue = tokenBalance.balanceUSD ?? 0
      const balance = tokenBalance.quantity
      balanceMap[key] = { usdValue, balance }
      return balanceMap
    }, {} as TokenBalances)

    return { balanceMap, balanceList, loading }
  }, [balancesById, loading])
}
```

**File: `interface/apps/web/src/appGraphql/data/apollo/TokenBalancesProvider.tsx`**

This provider component handles fetching and caching token balances from the GraphQL API.

```typescript:interface/apps/web/src/appGraphql/data/apollo/TokenBalancesProvider.tsx
import { AdaptiveTokenBalancesProvider } from 'appGraphql/data/apollo/AdaptiveTokenBalancesProvider'
import { apolloClient } from 'appGraphql/data/apollo/client'
import { useQueryClient } from '@tanstack/react-query'
import { GraphQLApi } from '@universe/api'
import { usePendingActivity } from 'components/AccountDrawer/MiniPortfolio/Activity/hooks'
import { useAccount } from 'hooks/useAccount'
import { PropsWithChildren, useCallback, useEffect, useMemo, useState } from 'react'
import { useWatchTransactionsCallback } from 'state/sagas/transactions/watcherSaga'
import { usePendingTransactions } from 'state/transactions/hooks'
import { useEnabledChains } from 'uniswap/src/features/chains/hooks/useEnabledChains'
import { usePortfolioValueModifiers } from 'uniswap/src/features/dataApi/balances/balances'
import { usePrevious } from 'utilities/src/react/hooks'

function useHasAccountUpdate() {
  // Used to detect account updates without relying on subscription data.
  const { pendingActivityCount } = usePendingActivity()
  const prevPendingActivityCount = usePrevious(pendingActivityCount)
  const hasLocalStateUpdate = !!prevPendingActivityCount && pendingActivityCount < prevPendingActivityCount

  const account = useAccount()
  const prevAccount = usePrevious(account.address)

  const { isTestnetModeEnabled } = useEnabledChains()
  const prevIsTestnetModeEnabled = usePrevious(isTestnetModeEnabled)

  return useMemo(() => {
    const hasPolledTxUpdate = hasLocalStateUpdate
    const accountChanged = Boolean(prevAccount !== account.address && account.address)
    const hasTestnetModeChanged = prevIsTestnetModeEnabled !== isTestnetModeEnabled

    return hasPolledTxUpdate || accountChanged || hasTestnetModeChanged
  }, [account.address, hasLocalStateUpdate, prevAccount, prevIsTestnetModeEnabled, isTestnetModeEnabled])
}

function TokenBalancesProviderInternal({ children }: PropsWithChildren) {
  const [lazyFetch, query] = GraphQLApi.usePortfolioBalancesLazyQuery({ errorPolicy: 'all' })
  const account = useAccount()
  const hasAccountUpdate = useHasAccountUpdate()
  const queryClient = useQueryClient()

  const valueModifiers = usePortfolioValueModifiers(account.address)
  const prevValueModifiers = usePrevious(valueModifiers)

  const { gqlChains } = useEnabledChains()
  const pendingTransactions = usePendingTransactions()
  const prevPendingTransactions = usePrevious(pendingTransactions)
  const pendingDiff = useMemo(
    () => prevPendingTransactions?.filter((tx) => !pendingTransactions.includes(tx)),
    [pendingTransactions, prevPendingTransactions],
  )
  const watchTransactions = useWatchTransactionsCallback()

  useEffect(() => {
    if (!account.address || !account.chainId) {
      return
    }

    if (!pendingDiff?.length) {
      return
    }

    watchTransactions({
      address: account.address,
      chainId: account.chainId,
      pendingDiff,
      apolloClient,
      queryClient,
    })
  }, [pendingDiff, account.address, account.chainId, watchTransactions, queryClient])

  const fetch = useCallback(() => {
    if (!account.address) {
      return
    }

    lazyFetch({
      variables: {
        ownerAddress: account.address,
        chains: gqlChains,
        valueModifiers,
      },
    })
  }, [account.address, gqlChains, lazyFetch, valueModifiers])

  return (
    <AdaptiveTokenBalancesProvider
      query={query}
      fetch={fetch}
      stale={hasAccountUpdate || valueModifiers !== prevValueModifiers}
    >
      {children}
    </AdaptiveTokenBalancesProvider>
  )
}

export function TokenBalancesProvider({ children }: PropsWithChildren) {
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    setInitialized(true)
  }, [])

  if (!initialized) {
    return null
  }

  return <TokenBalancesProviderInternal>{children}</TokenBalancesProviderInternal>
}
```

**File: `interface/packages/uniswap/src/features/dataApi/balances/balances.ts` (useSortedPortfolioBalances)**

This hook fetches and sorts portfolio balances by USD value.

```typescript:interface/packages/uniswap/src/features/dataApi/balances/balances.ts
/**
 * Returns portfolio balances for a given address sorted by USD value.
 *
 * @param address to get portfolio balances for
 * @param pollInterval optional polling interval for auto refresh.
 *    If undefined, query will run only once.
 * @param onCompleted callback
 * @returns SortedPortfolioBalances object with `balances` and `hiddenBalances`
 */
export function useSortedPortfolioBalances({
  evmAddress,
  svmAddress,
  pollInterval,
  onCompleted,
  chainIds,
}: {
  evmAddress?: Address
  svmAddress?: Address
  pollInterval?: PollingInterval
  onCompleted?: () => void
  chainIds?: UniverseChainId[]
}): SortedPortfolioBalancesResult {
  const { isTestnetModeEnabled } = useEnabledChains()

  // Fetch all balances including small balances and spam tokens because we want to return those in separate arrays
  const {
    data: balancesById,
    loading,
    networkStatus,
    refetch,
  } = usePortfolioBalances({
    evmAddress,
    svmAddress,
    pollInterval,
    onCompleted,
    fetchPolicy: 'cache-and-network',
    chainIds,
  })

  const { shownTokens, hiddenTokens } = useTokenBalancesGroupedByVisibility({ balancesById })

  return useMemo(
    () => ({
      data: {
        balances: sortPortfolioBalances({ balances: shownTokens || [], isTestnetModeEnabled }),
        hiddenBalances: sortPortfolioBalances({ balances: hiddenTokens || [], isTestnetModeEnabled }),
      },
      loading,
      networkStatus,
      refetch,
    }),
    [shownTokens, hiddenTokens, isTestnetModeEnabled, loading, networkStatus, refetch],
  )
}

/**
 * Helper function to stable sort balances by descending balanceUSD – or native balance tokens in testnet mode –
 * followed by all other tokens sorted alphabetically
 * */
export function sortPortfolioBalances({
  balances,
  isTestnetModeEnabled,
}: {
  balances: PortfolioBalance[]
  isTestnetModeEnabled: boolean
}): PortfolioBalance[] {
  if (isTestnetModeEnabled) {
    const sortedNativeBalances = balances
      .filter((b) => b.currencyInfo.currency.isNative)
      .sort((a, b) => b.quantity - a.quantity)

    const sortedNonNativeBalances = sortBalancesByName(balances.filter((b) => !b.currencyInfo.currency.isNative))

    return [...sortedNativeBalances, ...sortedNonNativeBalances]
  }

  const balancesWithUSDValue = balances.filter((b) => b.balanceUSD)
  const balancesWithoutUSDValue = balances.filter((b) => !b.balanceUSD)

  return [
    ...balancesWithUSDValue.sort((a, b) => {
      if (!a.balanceUSD) {
        return 1
      }
      if (!b.balanceUSD) {
        return -1
      }
      return b.balanceUSD - a.balanceUSD
    }),
    ...sortBalancesByName(balancesWithoutUSDValue),
  ]
}
```

### Usage Pattern

```typescript
// In your component
const { balanceMap, balanceList, loading } = useTokenBalances()

// balanceList contains all token balances
// balanceMap provides quick lookup by currency key
// Each balance includes: currencyInfo, quantity, balanceUSD
```

### Implementation Pattern for Filtering Pools by Wallet Tokens

To filter pools by tokens in the user's wallet:

1. Get token balances from wallet using `useTokenBalances()`
2. Extract token addresses from `balanceList`
3. For each token address, call `usePoolsFromTokenAddress()` hook
4. Merge and deduplicate results from all tokens
5. Sort the combined pool list

Example implementation approach:
```typescript
const { balanceList } = useTokenBalances()
const tokenAddresses = balanceList.map(b => b.currencyInfo.currency.address)

// Fetch pools for each token (you may want to batch this)
const poolsForTokens = tokenAddresses.map(address => 
  usePoolsFromTokenAddress({ 
    tokenAddress: address, 
    sortState, 
    chainId 
  })
)

// Merge and deduplicate pools
const allPools = useMemo(() => {
  const poolMap = new Map()
  poolsForTokens.forEach(({ pools }) => {
    pools?.forEach(pool => {
      if (!poolMap.has(pool.hash)) {
        poolMap.set(pool.hash, pool)
      }
    })
  })
  return Array.from(poolMap.values())
}, [poolsForTokens])
```

---

## 2. Pool Discovery & Filtering by Wallet Tokens

### Key Implementation Files

**File: `interface/apps/web/src/appGraphql/data/pools/usePoolsFromTokenAddress.ts`**

This hook fetches pools that contain a specific token address, querying across V4, V3, and V2 protocols.

```typescript:interface/apps/web/src/appGraphql/data/pools/usePoolsFromTokenAddress.ts
import {
  calculate1DVolOverTvl,
  calculateApr,
  PoolTableSortState,
  sortPools,
  TablePool,
} from 'appGraphql/data/pools/useTopPools'
import { GraphQLApi } from '@universe/api'
import { useCallback, useMemo, useRef } from 'react'
import { DEFAULT_TICK_SPACING, V2_DEFAULT_FEE_TIER } from 'uniswap/src/constants/pools'
import { DEFAULT_NATIVE_ADDRESS } from 'uniswap/src/features/chains/evm/rpc'
import { UniverseChainId } from 'uniswap/src/features/chains/types'
import { toGraphQLChain } from 'uniswap/src/features/chains/utils'
import { isSVMChain } from 'uniswap/src/features/platforms/utils/chains'

const DEFAULT_QUERY_SIZE = 20

export function usePoolsFromTokenAddress({
  tokenAddress,
  sortState,
  chainId,
  isNative,
}: {
  tokenAddress: string
  sortState: PoolTableSortState
  chainId: UniverseChainId
  isNative?: boolean
}) {
  const chain = toGraphQLChain(chainId)
  const skipPoolQueries = isSVMChain(chainId)

  const {
    loading: loadingV4,
    error: errorV4,
    data: dataV4,
    fetchMore: fetchMoreV4,
  } = GraphQLApi.useTopV4PoolsQuery({
    variables: {
      first: DEFAULT_QUERY_SIZE,
      tokenAddress: isNative ? DEFAULT_NATIVE_ADDRESS : tokenAddress,
      chain,
    },
    skip: skipPoolQueries,
  })

  const {
    loading: loadingV3,
    error: errorV3,
    data: dataV3,
    fetchMore: fetchMoreV3,
  } = GraphQLApi.useTopV3PoolsQuery({
    variables: {
      first: DEFAULT_QUERY_SIZE,
      tokenAddress,
      chain,
    },
    skip: skipPoolQueries,
  })

  const {
    loading: loadingV2,
    error: errorV2,
    data: dataV2,
    fetchMore: fetchMoreV2,
  } = GraphQLApi.useTopV2PairsQuery({
    variables: {
      first: DEFAULT_QUERY_SIZE,
      tokenAddress,
      chain,
    },
    skip: skipPoolQueries,
  })
  const loading = loadingV4 || loadingV3 || loadingV2

  const loadingMoreV4 = useRef(false)
  const loadingMoreV3 = useRef(false)
  const loadingMoreV2 = useRef(false)
  const sizeRef = useRef(DEFAULT_QUERY_SIZE)
  const loadMore = useCallback(
    ({ onComplete }: { onComplete?: () => void }) => {
      if (loadingMoreV4.current || loadingMoreV3.current || loadingMoreV2.current) {
        return
      }
      loadingMoreV4.current = true
      loadingMoreV3.current = true
      loadingMoreV2.current = true
      sizeRef.current += DEFAULT_QUERY_SIZE
      fetchMoreV4({
        variables: {
          cursor: dataV4?.topV4Pools?.[dataV4.topV4Pools.length - 1]?.totalLiquidity?.value,
        },
        updateQuery: (prev, { fetchMoreResult }) => {
          if (!Object.keys(prev).length) {
            loadingMoreV4.current = false
            return prev
          }
          if (!loadingMoreV3.current && !loadingMoreV2.current) {
            onComplete?.()
          }
          const mergedData = {
            topV4Pools: [...(prev.topV4Pools ?? []).slice(), ...(fetchMoreResult.topV4Pools ?? []).slice()],
          }
          loadingMoreV4.current = false
          return mergedData
        },
      })
      fetchMoreV3({
        variables: {
          cursor: dataV3?.topV3Pools?.[dataV3.topV3Pools.length - 1]?.totalLiquidity?.value,
        },
        updateQuery: (prev, { fetchMoreResult }) => {
          if (!Object.keys(prev).length) {
            loadingMoreV3.current = false
            return prev
          }
          if (!loadingMoreV2.current && !loadingMoreV4.current) {
            onComplete?.()
          }
          const mergedData = {
            topV3Pools: [...(prev.topV3Pools ?? []).slice(), ...(fetchMoreResult.topV3Pools ?? []).slice()],
          }
          loadingMoreV3.current = false
          return mergedData
        },
      })
      fetchMoreV2({
        variables: {
          cursor: dataV2?.topV2Pairs?.[dataV2.topV2Pairs.length - 1]?.totalLiquidity?.value,
        },
        updateQuery: (prev, { fetchMoreResult }) => {
          if (!Object.keys(prev).length) {
            loadingMoreV2.current = false
            return prev
          }
          if (!loadingMoreV3.current && !loadingMoreV4.current) {
            onComplete?.()
          }
          const mergedData = {
            topV2Pairs: [...(prev.topV2Pairs ?? []).slice(), ...(fetchMoreResult.topV2Pairs ?? []).slice()],
          }
          loadingMoreV2.current = false
          return mergedData
        },
      })
    },
    [dataV2?.topV2Pairs, dataV3?.topV3Pools, dataV4?.topV4Pools, fetchMoreV2, fetchMoreV3, fetchMoreV4],
  )

  return useMemo(() => {
    const topV4Pools: TablePool[] =
      dataV4?.topV4Pools?.map((pool) => {
        return {
          hash: pool.poolId,
          token0: pool.token0,
          token1: pool.token1,
          tvl: pool.totalLiquidity?.value,
          volume24h: pool.volume24h?.value,
          volume30d: pool.volume30d?.value,
          volOverTvl: calculate1DVolOverTvl(pool.volume24h?.value, pool.totalLiquidity?.value),
          apr: calculateApr({
            volume24h: pool.volume24h?.value,
            tvl: pool.totalLiquidity?.value,
            feeTier: pool.feeTier,
          }),
          feeTier: pool.feeTier
            ? {
                feeAmount: pool.feeTier,
                tickSpacing: DEFAULT_TICK_SPACING,
                isDynamic: pool.isDynamicFee ?? false,
              }
            : undefined,
          protocolVersion: pool.protocolVersion,
          hookAddress: pool.hook?.address,
        } as TablePool
      }) ?? []

    const topV3Pools: TablePool[] =
      dataV3?.topV3Pools?.map((pool) => {
        return {
          hash: pool.address,
          token0: pool.token0,
          token1: pool.token1,
          tvl: pool.totalLiquidity?.value,
          volume24h: pool.volume24h?.value,
          volume30d: pool.volume30d?.value,
          volOverTvl: calculate1DVolOverTvl(pool.volume24h?.value, pool.totalLiquidity?.value),
          apr: calculateApr({
            volume24h: pool.volume24h?.value,
            tvl: pool.totalLiquidity?.value,
            feeTier: pool.feeTier,
          }),
          feeTier: pool.feeTier
            ? {
                feeAmount: pool.feeTier,
                tickSpacing: DEFAULT_TICK_SPACING,
                isDynamic: false,
              }
            : undefined,
          protocolVersion: pool.protocolVersion,
        } as TablePool
      }) ?? []
    const topV2Pairs: TablePool[] =
      dataV2?.topV2Pairs?.map((pool) => {
        return {
          hash: pool.address,
          token0: pool.token0,
          token1: pool.token1,
          tvl: pool.totalLiquidity?.value,
          volume24h: pool.volume24h?.value,
          volume30d: pool.volume30d?.value,
          volOverTvl: calculate1DVolOverTvl(pool.volume24h?.value, pool.totalLiquidity?.value),
          apr: calculateApr({
            volume24h: pool.volume24h?.value,
            tvl: pool.totalLiquidity?.value,
            feeTier: V2_DEFAULT_FEE_TIER,
          }),
          feeTier: {
            feeAmount: V2_DEFAULT_FEE_TIER,
            tickSpacing: DEFAULT_TICK_SPACING,
            isDynamic: false,
          },
          protocolVersion: pool.protocolVersion,
        } as TablePool
      }) ?? []

    const pools = sortPools([...topV4Pools, ...topV3Pools, ...topV2Pairs], sortState).slice(0, sizeRef.current)
    return { loading, errorV2, errorV3, errorV4, pools, loadMore }
  }, [
    dataV2?.topV2Pairs,
    dataV3?.topV3Pools,
    dataV4?.topV4Pools,
    errorV2,
    errorV3,
    errorV4,
    loadMore,
    loading,
    sortState,
  ])
}
```

**File: `interface/packages/api/src/clients/graphql/web/topPools.graphql`**

GraphQL queries for fetching top pools by token filter.

```graphql:interface/packages/api/src/clients/graphql/web/topPools.graphql
query TopV4Pools($chain: Chain!, $first: Int!, $cursor: Float, $tokenAddress: String) {
  topV4Pools(first: $first, chain: $chain, tokenFilter: $tokenAddress, tvlCursor: $cursor) {
    id
    protocolVersion
    poolId
    isDynamicFee
    hook {
      id
      address
    }
    totalLiquidity {
      value
    }
    feeTier
    token0 {
      ...SimpleTokenDetails
    }
    token1 {
      ...SimpleTokenDetails
    }
    txCount
    volume24h: cumulativeVolume(duration: DAY) {
      value
    }
    volume30d: cumulativeVolume(duration: MONTH) {
      value
    }
  }
}

query TopV3Pools($chain: Chain!, $first: Int!, $cursor: Float, $tokenAddress: String) {
  topV3Pools(first: $first, chain: $chain, tokenFilter: $tokenAddress, tvlCursor: $cursor) {
    id
    protocolVersion
    address
    totalLiquidity {
      value
    }
    feeTier
    token0 {
      ...SimpleTokenDetails
    }
    token1 {
      ...SimpleTokenDetails
    }
    txCount
    volume24h: cumulativeVolume(duration: DAY) {
      value
    }
    volume30d: cumulativeVolume(duration: MONTH) {
      value
    }
  }
}

query TopV2Pairs($chain: Chain!, $first: Int!, $cursor: Float, $tokenAddress: String) {
  topV2Pairs(first: $first, chain: $chain, tokenFilter: $tokenAddress, tvlCursor: $cursor) {
    id
    protocolVersion
    address
    totalLiquidity {
      value
    }
    token0 {
      ...SimpleTokenDetails
    }
    token1 {
      ...SimpleTokenDetails
    }
    txCount
    volume24h: cumulativeVolume(duration: DAY) {
      value
    }
    volume30d: cumulativeVolume(duration: MONTH) {
      value
    }
  }
}
```

**Key Points:**
- The `tokenFilter` parameter filters pools that contain the specified token address
- Queries V4, V3, and V2 pools separately and merges results
- Results are sorted using `sortPools` function
- Supports pagination via `fetchMore` with cursor-based pagination
- Native tokens use `DEFAULT_NATIVE_ADDRESS` as the token filter

---


## 7. APR Calculation

**File: `interface/apps/web/src/appGraphql/data/pools/useTopPools.ts`**

Pool sorting logic and APR calculation functions.

```typescript:interface/apps/web/src/appGraphql/data/pools/useTopPools.ts
import { OrderDirection } from 'appGraphql/data/util'
import { Percent } from '@uniswap/sdk-core'
import { GraphQLApi } from '@universe/api'
import { FeeData } from 'components/Liquidity/Create/types'
import { BIPS_BASE } from 'uniswap/src/constants/misc'

export function sortPools(pools: TablePool[], sortState: PoolTableSortState) {
  return pools.sort((a, b) => {
    switch (sortState.sortBy) {
      case PoolSortFields.VolOverTvl:
        return sortState.sortDirection === OrderDirection.Desc
          ? b.volOverTvl - a.volOverTvl
          : a.volOverTvl - b.volOverTvl
      case PoolSortFields.Volume24h:
        return sortState.sortDirection === OrderDirection.Desc ? b.volume24h - a.volume24h : a.volume24h - b.volume24h
      case PoolSortFields.Volume30D:
        return sortState.sortDirection === OrderDirection.Desc ? b.volume30d - a.volume30d : a.volume30d - b.volume30d
      case PoolSortFields.Apr:
        return sortState.sortDirection === OrderDirection.Desc
          ? b.apr.greaterThan(a.apr)
            ? 1
            : -1
          : a.apr.greaterThan(b.apr)
            ? 1
            : -1
      default:
        return sortState.sortDirection === OrderDirection.Desc ? b.tvl - a.tvl : a.tvl - b.tvl
    }
  })
}

export function calculate1DVolOverTvl(volume24h: number | undefined, tvl: number | undefined): number | undefined {
  if (!volume24h || !tvl) {
    return undefined
  }

  return volume24h / tvl
}

/**
 * Calculate the APR of a pool/pair which is the ratio of 24h fees to TVL expressed as a percent (1 day APR) multiplied by 365
 * @param volume24h the 24h volume of the pool/pair
 * @param tvl the pool/pair's TVL
 * @param feeTier the feeTier of the pool or 300 for a v2 pair
 * @returns APR expressed as a percent
 */
export function calculateApr({
  volume24h,
  tvl,
  feeTier,
}: {
  volume24h?: number
  tvl?: number
  feeTier?: number
}): Percent {
  if (!volume24h || !feeTier || !tvl || !Math.round(tvl)) {
    return new Percent(0)
  }
  return new Percent(Math.round(volume24h * (feeTier / (BIPS_BASE * 100)) * 365), Math.round(tvl))
}

export interface TablePool {
  hash: string
  token0: GraphQLApi.Token
  token1: GraphQLApi.Token
  tvl: number
  volume24h: number
  volume30d: number
  apr: Percent
  volOverTvl: number
  feeTier: FeeData
  protocolVersion: GraphQLApi.ProtocolVersion
  hookAddress?: string
  boostedApr?: number
}

export enum PoolSortFields {
  TVL = 'TVL',
  Apr = 'APR',
  RewardApr = 'Reward APR',
  Volume24h = '1 day volume',
  Volume30D = '30 day volume',
  VolOverTvl = '1 day volume/TVL',
}

export type PoolTableSortState = {
  sortBy: PoolSortFields
  sortDirection: OrderDirection
}
```

**APR Calculation Formula:**
```
APR = (24h_volume * fee_tier / 10000) * 365 / TVL
```

Where:
- `fee_tier` is in basis points (e.g., 3000 = 0.3%)
- `BIPS_BASE` = 10000 (basis points conversion)
- Result is expressed as a `Percent` object from `@uniswap/sdk-core`

---

## 3. Pool List Display Component

**File: `interface/apps/web/src/components/Pools/PoolTable/PoolTable.tsx`**

Main pool table component that displays pools with sortable columns.

Key excerpt showing table structure and column definitions:

```typescript:interface/apps/web/src/components/Pools/PoolTable/PoolTable.tsx
export function PoolsTable({
  pools,
  loading,
  error,
  loadMore,
  maxWidth,
  maxHeight,
  hiddenColumns,
  forcePinning,
}: {
  pools?: TablePool[] | PoolStat[]
  loading: boolean
  error?: ApolloError | boolean
  loadMore?: ({ onComplete }: { onComplete?: () => void }) => void
  maxWidth?: number
  maxHeight?: number
  hiddenColumns?: PoolSortFields[]
  forcePinning?: boolean
}) {
  const { formatPercent, formatNumberOrString, convertFiatAmountFormatted } = useLocalizationContext()
  const sortAscending = useAtomValue(sortAscendingAtom)
  const orderDirection = sortAscending ? OrderDirection.Asc : OrderDirection.Desc
  const sortMethod = useAtomValue(sortMethodAtom)
  const filterString = useAtomValue(exploreSearchStringAtom)
  const { defaultChainId } = useEnabledChains()
  const { t } = useTranslation()
  const isLPIncentivesEnabled = useFeatureFlag(FeatureFlags.LpIncentives)

  const poolTableValues: PoolTableValues[] | undefined = useMemo(
    () =>
      pools?.map((pool, index) => {
        const poolSortRank = index + 1
        const isGqlPool = 'hash' in pool
        const chainId = supportedChainIdFromGQLChain(pool.token0?.chain as GraphQLApi.Chain) ?? defaultChainId

        const token0Address = pool.token0?.address || getNativeAddress(chainId)
        const token1Address = pool.token1?.address || getNativeAddress(chainId)
        const currency0Id =
          pool.protocolVersion === GraphQLApi.ProtocolVersion.V4 && token0Address
            ? buildCurrencyId(chainId, token0Address)
            : undefined
        const currency1Id =
          pool.protocolVersion === GraphQLApi.ProtocolVersion.V4 && token1Address
            ? buildCurrencyId(chainId, token1Address)
            : undefined

        const parseVolume = (amount: number | undefined): string => {
          return amount ? convertFiatAmountFormatted(amount, NumberType.FiatTokenStats) : '-'
        }

        return {
          index: poolSortRank,
          poolDescription: (
            <PoolDescription
              token0={unwrapToken(chainId, pool.token0) as TokenStats | Token | undefined}
              token1={unwrapToken(chainId, pool.token1) as TokenStats | Token | undefined}
              chainId={chainId}
            />
          ),
          protocolVersion: pool.protocolVersion?.toLowerCase(),
          feeTier: pool.feeTier,
          tvl: parseVolume((isGqlPool ? pool.tvl : pool.totalLiquidity?.value) ?? 0),
          volume24h: parseVolume((isGqlPool ? pool.volume24h : pool.volume1Day?.value) ?? 0),
          volume30d: parseVolume((isGqlPool ? pool.volume30d : pool.volume30Day?.value) ?? 0),
          volOverTvl: pool.volOverTvl,
          apr: pool.apr,
          rewardApr: pool.boostedApr,
          link: `/explore/pools/${getChainUrlParam(chainId)}/${isGqlPool ? pool.hash : pool.id}`,
          token0CurrencyId: currency0Id,
          token1CurrencyId: currency1Id,
        }
      }) ?? [],
    [convertFiatAmountFormatted, defaultChainId, filterString, pools],
  )

  const showLoadingSkeleton = loading || !!error
  const media = useMedia()
  const columns = useMemo(() => {
    const columnHelper = createColumnHelper<PoolTableValues>()
    const filteredColumns = [
      // Index column (mobile only)
      !media.lg ? columnHelper.accessor((row) => row.index, { id: 'index', ... }) : null,
      // Pool description column
      columnHelper.accessor((row) => row.poolDescription, { id: 'poolDescription', ... }),
      // Protocol version column
      columnHelper.accessor((row) => row.protocolVersion, { id: 'protocolVersion', ... }),
      // Fee tier column
      columnHelper.accessor((row) => row.feeTier, { id: 'feeTier', ... }),
      // TVL column (sortable)
      !hiddenColumns?.includes(PoolSortFields.TVL)
        ? columnHelper.accessor((row) => row.tvl, {
            id: 'tvl',
            header: () => (
              <HeaderCell>
                <PoolTableHeader
                  category={PoolSortFields.TVL}
                  isCurrentSortMethod={sortMethod === PoolSortFields.TVL}
                  direction={orderDirection}
                />
              </HeaderCell>
            ),
            ...
          })
        : null,
      // APR column (sortable)
      !hiddenColumns?.includes(PoolSortFields.Apr)
        ? columnHelper.accessor((row) => row.apr, {
            id: 'apr',
            header: () => (
              <HeaderCell>
                <PoolTableHeader
                  category={PoolSortFields.Apr}
                  isCurrentSortMethod={sortMethod === PoolSortFields.Apr}
                  direction={orderDirection}
                />
              </HeaderCell>
            ),
            cell: (oneDayApr) => (
              <Cell loading={showLoadingSkeleton}>
                <TableText>{formatPercent(oneDayApr.getValue?.()?.toSignificant())}</TableText>
              </Cell>
            ),
          })
        : null,
      // Volume 24h column (sortable)
      !hiddenColumns?.includes(PoolSortFields.Volume24h)
        ? columnHelper.accessor((row) => row.volume24h, { id: 'volume24h', ... })
        : null,
      // Volume 30d column (sortable)
      !hiddenColumns?.includes(PoolSortFields.Volume30D)
        ? columnHelper.accessor((row) => row.volume30d, { id: 'volume30Day', ... })
        : null,
      // Vol/TVL column (sortable)
      !hiddenColumns?.includes(PoolSortFields.VolOverTvl)
        ? columnHelper.accessor((row) => row.volOverTvl, { id: 'volOverTvl', ... })
        : null,
    ]
    return filteredColumns.filter((column): column is NonNullable<(typeof filteredColumns)[number]> => Boolean(column))
  }, [media.lg, hiddenColumns, isLPIncentivesEnabled, showLoadingSkeleton, t, sortMethod, orderDirection, formatNumberOrString, formatPercent])

  return (
    <Table
      columns={columns}
      data={poolTableValues}
      loading={loading}
      error={error}
      v2={false}
      loadMore={loadMore}
      maxWidth={maxWidth}
      maxHeight={maxHeight}
      defaultPinnedColumns={['index', 'poolDescription']}
      forcePinning={forcePinning}
    />
  )
}
```

**Table Columns:**
1. **Index** (#) - Row number (mobile only)
2. **Pool** - Token pair with logos (e.g., "ETH/USDC")
3. **Protocol** - Version (v2, v3, v4)
4. **Fee Tier** - Fee percentage or "Dynamic"
5. **TVL** - Total Value Locked (sortable, formatted as USD)
6. **APR** - Annual Percentage Rate (sortable, calculated from volume and fees)
7. **Volume 24h** - 24-hour trading volume (sortable)
8. **Volume 30d** - 30-day trading volume (sortable)
9. **Vol/TVL** - Volume to TVL ratio (sortable)
10. **Reward APR** - Additional APR from incentives (if enabled)

Each row links to the pool details page via the `link` property.

---


## 4. Pool Details Page

**File: `interface/apps/web/src/pages/PoolDetails/index.tsx`**

Main pool details page component that displays comprehensive pool information.

```typescript:interface/apps/web/src/pages/PoolDetails/index.tsx
export default function PoolDetailsPage() {
  const { t } = useTranslation()
  const { poolAddress } = useParams<{ poolAddress: string }>()
  const urlChain = useChainIdFromUrlParam()
  const chainInfo = urlChain ? getChainInfo(urlChain) : undefined
  const { data: poolData, loading } = usePoolData({
    poolIdOrAddress: normalizeAddress(poolAddress ?? '', AddressStringFormat.Lowercase),
    chainId: chainInfo?.id,
    isPoolAddress: isEVMAddress(poolAddress),
  })
  const [isReversed, toggleReversed] = useReducer((x) => !x, false)
  const unwrappedTokens = getUnwrappedPoolToken({
    poolData,
    chainId: chainInfo?.id,
    protocolVersion: poolData?.protocolVersion,
  })
  const [token0, token1] = isReversed ? [unwrappedTokens[1], unwrappedTokens[0]] : unwrappedTokens
  const isLPIncentivesEnabled = useFeatureFlag(FeatureFlags.LpIncentives)

  const poolApr = useMemo(
    () =>
      calculateApr({
        volume24h: poolData?.volumeUSD24H,
        tvl: poolData?.tvlUSD,
        feeTier: poolData?.feeTier?.feeAmount,
      }),
    [poolData?.volumeUSD24H, poolData?.tvlUSD, poolData?.feeTier],
  )
  const navigate = useNavigate()

  const colors = useSporeColors()
  const isDarkMode = useIsDarkMode()
  const color0 = useColor(token0 && gqlToCurrency(token0), {
    backgroundColor: colors.surface2.val,
    darkMode: isDarkMode,
  })
  const color1 = useColor(token1 && gqlToCurrency(token1), {
    backgroundColor: colors.surface2.val,
    darkMode: isDarkMode,
  })

  const isInvalidPool = !poolAddress || !chainInfo
  const poolNotFound = (!loading && !poolData) || isInvalidPool

  // ... error handling ...

  return (
    <ThemeProvider
      token0={color0 !== colors.accent1.val ? color0 : undefined}
      token1={color1 !== colors.accent1.val ? color1 : undefined}
    >
      <PageWrapper>
        <LeftColumn>
          <Column gap="20px">
            <Column>
              <PoolDetailsBreadcrumb
                chainId={chainInfo.id}
                poolAddress={poolAddress}
                token0={token0}
                token1={token1}
                loading={loading}
              />
              <PoolDetailsHeader
                chainId={chainInfo.id}
                poolAddress={poolAddress}
                token0={token0}
                token1={token1}
                feeTier={poolData?.feeTier}
                hookAddress={poolData?.hookAddress}
                protocolVersion={poolData?.protocolVersion}
                rewardsApr={poolData?.rewardsCampaign?.boostedApr}
                toggleReversed={toggleReversed}
                loading={loading}
              />
            </Column>
            <ChartSection
              poolData={poolData}
              loading={loading}
              isReversed={isReversed}
              chain={chainInfo.backendChain.chain}
              tokenAColor={isReversed ? color1 : color0}
              tokenBColor={isReversed ? color0 : color1}
            />
          </Column>
          <HR />
          <PoolDetailsTableTab
            poolAddress={poolAddress}
            token0={token0}
            token1={token1}
            protocolVersion={poolData?.protocolVersion}
          />
        </LeftColumn>
        <Flex gap="$spacing24" width={360}>
          <PoolDetailsStatsButtons
            chainId={chainInfo.id}
            token0={token0}
            token1={token1}
            feeTier={poolData?.feeTier?.feeAmount}
            hookAddress={poolData?.hookAddress}
            isDynamic={poolData?.feeTier?.isDynamic}
            protocolVersion={poolData?.protocolVersion}
            loading={loading}
          />
          {poolData && (
            <PoolDetailsApr
              poolApr={poolApr}
              rewardsApr={isLPIncentivesEnabled ? poolData.rewardsCampaign?.boostedApr : undefined}
            />
          )}
          <PoolDetailsStats
            poolData={poolData}
            isReversed={isReversed}
            tokenAColor={color0}
            tokenBColor={color1}
            chainId={chainInfo.id}
            loading={loading}
          />
          <TokenDetailsWrapper>
            <TokenDetailsHeader>
              <Trans i18nKey="common.links" />
            </TokenDetailsHeader>
            <LinksContainer>
              <PoolDetailsLink address={token0?.address} chainId={chainInfo.id} tokens={[token0]} loading={loading} />
              <PoolDetailsLink address={token1?.address} chainId={chainInfo.id} tokens={[token1]} loading={loading} />
            </LinksContainer>
          </TokenDetailsWrapper>
        </Flex>
      </PageWrapper>
    </ThemeProvider>
  )
}
```

**File: `interface/apps/web/src/appGraphql/data/pools/usePoolData.ts`**

Hook for fetching pool data from GraphQL API.

```typescript:interface/apps/web/src/appGraphql/data/pools/usePoolData.ts
export function usePoolData({
  poolIdOrAddress,
  chainId,
  isPoolAddress,
}: {
  poolIdOrAddress: string
  chainId?: UniverseChainId
  isPoolAddress: boolean
}): {
  loading: boolean
  error: boolean
  data?: PoolData
} {
  const { defaultChainId } = useEnabledChains()
  const chain = toGraphQLChain(chainId ?? defaultChainId)
  const isSolanaChain = chainId && isSVMChain(chainId)

  const {
    loading: loadingV4,
    error: errorV4,
    data: dataV4,
  } = GraphQLApi.useV4PoolQuery({
    variables: { chain, poolId: poolIdOrAddress },
    errorPolicy: 'all',
    skip: isPoolAddress || isSolanaChain,
  })
  const {
    loading: loadingV3,
    error: errorV3,
    data: dataV3,
  } = GraphQLApi.useV3PoolQuery({
    variables: { chain, address: poolIdOrAddress },
    errorPolicy: 'all',
    skip: !isPoolAddress || isSolanaChain,
  })
  const {
    loading: loadingV2,
    error: errorV2,
    data: dataV2,
  } = GraphQLApi.useV2PairQuery({
    variables: { chain, address: poolIdOrAddress },
    skip: !chainId || !isPoolAddress || isSolanaChain,
    errorPolicy: 'all',
  })

  return useMemo(() => {
    const anyError = Boolean(errorV4 || errorV3 || errorV2)
    const anyLoading = Boolean(loadingV4 || loadingV3 || loadingV2)

    const pool = dataV4?.v4Pool ?? dataV3?.v3Pool ?? dataV2?.v2Pair ?? undefined
    const feeTier: FeeData = {
      feeAmount: dataV4?.v4Pool?.feeTier ?? dataV3?.v3Pool?.feeTier ?? V2_DEFAULT_FEE_TIER,
      tickSpacing: dataV4?.v4Pool?.tickSpacing ?? DEFAULT_TICK_SPACING,
      isDynamic: dataV4?.v4Pool?.isDynamicFee ?? false,
    }
    const poolId = dataV4?.v4Pool?.poolId ?? dataV3?.v3Pool?.address ?? dataV2?.v2Pair?.address ?? poolIdOrAddress

    return {
      data: pool
        ? {
            idOrAddress: poolId,
            txCount: pool.txCount,
            protocolVersion: pool.protocolVersion,
            token0: pool.token0 as GraphQLApi.Token,
            tvlToken0: pool.token0Supply,
            token0Price: pool.token0?.project?.markets?.[0]?.price?.value ?? pool.token0?.market?.price?.value,
            token1: pool.token1 as GraphQLApi.Token,
            tvlToken1: pool.token1Supply,
            token1Price: pool.token1?.project?.markets?.[0]?.price?.value ?? pool.token1?.market?.price?.value,
            feeTier,
            volumeUSD24H: pool.volume24h?.value,
            volumeUSD24HChange: calc24HVolChange(pool.historicalVolume?.concat()),
            tvlUSD: pool.totalLiquidity?.value,
            tvlUSDChange: pool.totalLiquidityPercentChange24h?.value,
            hookAddress: 'hook' in pool ? pool.hook?.address : undefined,
            rewardsCampaign: 'rewardsCampaign' in pool ? pool.rewardsCampaign : undefined,
          }
        : undefined,
      error: anyError,
      loading: anyLoading,
    }
  }, [
    dataV2?.v2Pair,
    dataV3?.v3Pool,
    dataV4?.v4Pool,
    errorV2,
    errorV3,
    errorV4,
    loadingV2,
    loadingV3,
    loadingV4,
    poolIdOrAddress,
  ])
}
```

**File: `interface/apps/web/src/components/Pools/PoolDetails/PoolDetailsStatsButtons.tsx`**

"Add Liquidity" button that navigates to the create position page with pre-filled parameters.

```typescript:interface/apps/web/src/components/Pools/PoolDetails/PoolDetailsStatsButtons.tsx
const handleAddLiquidity = async () => {
  if (currency0 && currency1) {
    const currency0Address = currency0.isNative ? NATIVE_CHAIN_ID : currency0.address
    const currency1Address = currency1.isNative ? NATIVE_CHAIN_ID : currency1.address
    const chainUrlParam = getChainUrlParam(chainId ?? currency0.chainId)

    if (tokenId) {
      // User already has a position in this pool
      navigate(`/positions/${protocolVersion?.toLowerCase()}/${chainUrlParam}/${tokenId}`, {
        state: { from: location.pathname },
      })
    } else {
      // Create new position - build URL with query params
      const queryParams = new URLSearchParams()
      queryParams.set('currencyA', currency0Address)
      queryParams.set('currencyB', currency1Address)
      queryParams.set('chain', chainUrlParam)
      if (feeTier) {
        queryParams.set('feeTier', feeTier.toString())
      }
      if (hookAddress) {
        queryParams.set('hook', hookAddress)
      }
      if (isDynamic) {
        queryParams.set('isDynamic', 'true')
      }
      const url = `/positions/create/${protocolVersion?.toLowerCase()}?${queryParams.toString()}`
      navigate(url, {
        state: { from: location.pathname },
      })
    }
  }
}
```

**Route Pattern:**
- `/explore/pools/:chainName/:poolAddress`
- Example: `/explore/pools/ethereum/0x88e6a0c2ddd26feeb64f039a2c41296fcb3f5640`

**GraphQL Query:**
See `interface/packages/api/src/clients/graphql/web/pool.graphql` for V4Pool, V3Pool, and V2Pair queries.

---

## 5. Create Position / Add Liquidity Flow

**File: `interface/apps/web/src/pages/CreatePosition/CreatePosition.tsx`**

Main create position component with multi-step flow.

```typescript:interface/apps/web/src/pages/CreatePosition/CreatePosition.tsx
export default function CreatePosition() {
  // URL format is `/positions/create/:protocolVersion`, with possible searchParams `?currencyA=...&currencyB=...&chain=...&feeTier=...&hook=...`
  const { protocolVersion } = useParams<{
    protocolVersion: string
  }>()
  const paramsProtocolVersion = parseRestProtocolVersion(protocolVersion)

  const autoSlippageTolerance = useLPSlippageValue({
    version: paramsProtocolVersion,
  })

  const initialInputs = useLiquidityUrlState()

  if (initialInputs.loading) {
    return null
  }

  return (
    <CreatePositionContent
      initialInputs={initialInputs}
      paramsProtocolVersion={paramsProtocolVersion}
      autoSlippageTolerance={autoSlippageTolerance}
    />
  )
}

function CreatePositionContent({
  initialInputs,
  paramsProtocolVersion,
  autoSlippageTolerance,
}: {
  initialInputs: ReturnType<typeof useLiquidityUrlState>
  paramsProtocolVersion: ProtocolVersion | undefined
  autoSlippageTolerance: number
}) {
  const initialProtocolVersion = paramsProtocolVersion ?? ProtocolVersion.V4

  const [currencyInputs, setCurrencyInputs] = useState<{ tokenA: Maybe<Currency>; tokenB: Maybe<Currency> }>({
    tokenA: initialInputs.tokenA,
    tokenB: initialInputs.tokenB,
  })

  return (
    <Trace logImpression page={InterfacePageName.CreatePosition}>
      <MultichainContextProvider initialChainId={initialInputs.chainId}>
        <LPTransactionSettingsStoreContextProvider autoSlippageTolerance={autoSlippageTolerance}>
          <CreateLiquidityContextProvider
            currencyInputs={currencyInputs}
            setCurrencyInputs={setCurrencyInputs}
            initialPositionState={{
              fee: initialInputs.fee ?? undefined,
              hook: initialInputs.hook ?? undefined,
              protocolVersion: initialProtocolVersion,
            }}
            defaultInitialToken={initialInputs.defaultInitialToken}
            initialPriceRangeState={initialInputs.priceRangeState}
            initialDepositState={initialInputs.depositState}
            initialFlowStep={initialInputs.flowStep}
          >
            <CreatePositionTxContextProvider>
              <FormWrapper toolbar={<Toolbar />}>
                <CreatePositionInner currencyInputs={currencyInputs} setCurrencyInputs={setCurrencyInputs} />
              </FormWrapper>
              <SharedCreateModals />
            </CreatePositionTxContextProvider>
          </CreateLiquidityContextProvider>
        </LPTransactionSettingsStoreContextProvider>
      </MultichainContextProvider>
    </Trace>
  )
}
```

**Flow Steps:**
1. **SELECT_TOKENS_AND_FEE_TIER** - Select token A, token B, and fee tier
2. **PRICE_RANGE** - Set price range (full range or custom ticks for V3/V4)
3. **DEPOSIT** - Enter deposit amounts for each token
4. **Transaction Execution** - Approve tokens and create position

**Route Pattern:**
- `/positions/create/:protocolVersion?currencyA=...&currencyB=...&chain=...&feeTier=...&hook=...`
- Example: `/positions/create/v4?currencyA=ETH&currencyB=USDC&chain=ethereum&feeTier=3000`

**Context Providers:**
- `CreateLiquidityContextProvider` - Manages position state, price range state, deposit state
- `CreatePositionTxContextProvider` - Manages transaction state and calldata generation
- `LPTransactionSettingsStoreContextProvider` - Manages slippage and deadline settings

---

## 6. Routing Configuration

**File: `interface/apps/web/src/pages/RouteDefinitions.tsx`**

Route definitions for pool and position pages.

```typescript:interface/apps/web/src/pages/RouteDefinitions.tsx
// Pool listings
createRouteDefinition({
  path: '/positions',
  getElement: () => <Pool />, // Shows user's positions
  getTitle: getPositionPageTitle,
  getDescription: getPositionPageDescription,
}),
createRouteDefinition({
  path: '/pools',
  getElement: () => <LegacyPoolRedirects />,
  getTitle: getPositionPageTitle,
  getDescription: getPositionPageDescription,
}),

// Pool details
createRouteDefinition({
  path: '/explore/pools/:chainName/:poolAddress',
  getElement: () => <PoolDetailsPage />,
  getTitle: getPoolDetailPageTitle,
  getDescription: () => StaticTitlesAndDescriptions.PoolDetailsDescription,
}),

// Create position
createRouteDefinition({
  path: '/positions/create/:protocolVersion',
  getElement: () => <CreatePosition />,
  getTitle: getAddLiquidityPageTitle,
  getDescription: () => StaticTitlesAndDescriptions.AddLiquidityDescription,
}),

// Legacy routes for backwards compatibility
createRouteDefinition({
  path: '/add/v2',
  nestedPaths: [':currencyIdA', ':currencyIdA/:currencyIdB'],
  getElement: () => <AddLiquidityV2WithTokenRedirects />,
  getTitle: getAddLiquidityPageTitle,
  getDescription: () => StaticTitlesAndDescriptions.AddLiquidityDescription,
}),
createRouteDefinition({
  path: '/add',
  nestedPaths: [
    ':currencyIdA',
    ':currencyIdA/:currencyIdB',
    ':currencyIdA/:currencyIdB/:feeAmount',
    ':currencyIdA/:currencyIdB/:feeAmount/:tokenId',
  ],
  getElement: () => <AddLiquidityV3WithTokenRedirects />,
  getTitle: getAddLiquidityPageTitle,
  getDescription: () => StaticTitlesAndDescriptions.AddLiquidityDescription,
}),
```

**File: `interface/apps/web/src/pages/paths.ts`**

Path constants used throughout the application.

```typescript:interface/apps/web/src/pages/paths.ts
export const paths = [
  '/positions',
  '/positions/create',
  '/positions/create/:protocolVersion',
  '/positions/v2/:chainName/:pairAddress',
  '/positions/v3/:chainName/:tokenId',
  '/positions/v4/:chainName/:tokenId',
  '/explore/pools/:chainName/:poolAddress',
  '/add/v2',
  '/add',
  '/pools',
  '/pools/:tokenId',
  // ... other paths
]
```

---

## 8. Transaction Execution

**File: `interface/apps/web/src/pages/CreatePosition/CreatePositionModal.tsx`**

Transaction modal component that handles position creation.

Key excerpt showing transaction execution:

```typescript:interface/apps/web/src/pages/CreatePosition/CreatePositionModal.tsx
const handleCreate = useCallback(() => {
  setTransactionError(false)

  const isValidTx = isValidLiquidityTxContext(txInfo)
  if (
    !account ||
    !isSignerMnemonicAccountDetails(account) ||
    !isValidTx ||
    !currencyAmounts ||
    !currencyAmounts.TOKEN0 ||
    !currencyAmounts.TOKEN1
  ) {
    return
  }

  dispatch(
    liquiditySaga.actions.trigger({
      selectChain,
      startChainId,
      account,
      liquidityTxContext: txInfo,
      setCurrentStep: setCurrentTransactionStep,
      setSteps,
      onSuccess,
      onFailure: (e) => {
        if (e) {
          setTransactionError(getErrorMessageToDisplay({ calldataError: e }))
        }
        setCurrentTransactionStep(undefined)
      },
      analytics: {
        ...getLPBaseAnalyticsProperties({
          trace,
          hook,
          version: protocolVersion,
          tickLower: ticks[0] ?? undefined,
          tickUpper: ticks[1] ?? undefined,
          fee: fee?.feeAmount,
          tickSpacing: fee?.tickSpacing,
          currency0: currencyAmounts.TOKEN0.currency,
          currency1: currencyAmounts.TOKEN1.currency,
          currency0AmountUsd: currencyAmountsUSDValue?.TOKEN0,
          currency1AmountUsd: currencyAmountsUSDValue?.TOKEN1,
          poolId: getPoolIdOrAddressFromCreatePositionInfo({
            protocolVersion,
            poolOrPair,
            sdkCurrencies: {
              TOKEN0: currencyAmounts.TOKEN0.currency,
              TOKEN1: currencyAmounts.TOKEN1.currency,
            },
          }),
        }),
        expectedAmountBaseRaw: currencyAmounts.TOKEN0.quotient.toString(),
        expectedAmountQuoteRaw: currencyAmounts.TOKEN1.quotient.toString(),
        createPool: creatingPoolOrPair,
        createPosition: true,
      },
    }),
  )
}, [
  txInfo,
  account,
  currencyAmounts,
  // ... other dependencies
])
```

**Transaction Flow:**
1. **Check Approvals** - Verify token approvals (may require separate approval transactions)
2. **Generate Calldata** - Create transaction calldata for position creation
3. **Execute Transaction** - Send transaction via wallet connection
4. **Track Status** - Monitor transaction status (pending, confirmed, failed)
5. **Refresh Data** - Update position data on successful transaction
6. **Handle Errors** - Display error messages for failed transactions

**File: `interface/apps/web/src/state/sagas/liquidity/liquiditySaga.ts`**

Redux saga that handles liquidity transaction execution. This manages the entire transaction lifecycle including approvals, calldata generation, and transaction submission.

---

## Summary

This guide provides a comprehensive overview of Uniswap's liquidity providing implementation. The key components are:

1. **Wallet Integration** - Fetch token balances from connected wallet
2. **Pool Discovery** - Query pools filtered by wallet tokens using GraphQL
3. **Pool Display** - Show pools in sortable table with key metrics (TVL, APR, volume, fees)
4. **Pool Details** - Display comprehensive pool information and charts
5. **Position Creation** - Multi-step flow for adding liquidity
6. **Routing** - URL-based navigation with query parameters for deep linking
7. **Transaction Execution** - Handle approvals and position creation transactions

All code snippets are extracted directly from Uniswap's codebase and represent the exact implementation patterns used in production.

