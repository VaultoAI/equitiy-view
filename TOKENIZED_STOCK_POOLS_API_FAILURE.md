# Tokenized Stock Pools API Failure – Root Cause

## Summary

The `/api/cache/tokenized-stock-pools` API returns **0 pools** because the Uniswap V3 subgraph (The Graph) is failing. All pool data comes from that subgraph; when it fails, the API correctly has no data to return.

## What You See

- **Logs**: `❌ [Pool Fetchers] GraphQL errors for token 0x...` with messages like:
  - `bad indexers: { 0x1b7e...: Unavailable(too far behind), 0x326c...: BadResponse(400), ... }`
  - `no attestation: indexing_error`
  - `Unavailable(no status: failed to get indexing progress)`
- **API**: `GET /api/cache/tokenized-stock-pools` → **503** (when subgraph fails) with `{ "error": "...", "details": "Subgraph unavailable: ..." }`. Previously we returned `200` and `{ "pools": [] }`, which was misleading.
- **Stats**: When subgraph fails, the fetcher throws before logging "Successfully fetched..."; otherwise `Successfully fetched pools for 0 out of 16 tokenized stocks` if no token has pools.

## Root Cause

1. **Data source**  
   Tokenized stock pools are fetched from the **Uniswap V3 subgraph** on Ethereum mainnet, via The Graph Gateway:
   - Subgraph ID: `5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV`
   - URL: `https://gateway.thegraph.com/api/subgraphs/id/5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV` (auth via `Authorization: Bearer <API_KEY>` when using an API key)  
   There is no other official Uniswap V3 Ethereum subgraph.

2. **The Graph Gateway**  
   - **Without API key**: Gateway returns `auth error: missing authorization header`. No data.
   - **With API key**: Gateway routes queries to **decentralized indexers**. When **every** indexer fails, the Gateway still returns **HTTP 200** with a JSON body like:
     ```json
     { "data": null, "errors": [{ "message": "bad indexers: { ... }" }] }
     ```

3. **Why “bad indexers”**  
   Each indexer can fail for different reasons, e.g.:
   - `Unavailable(too far behind)` – not synced to latest blocks
   - `BadResponse(400)` – request or indexer error
   - `BadResponse(no attestation: indexing_error)` – indexing/attestation failure
   - `Unavailable(no status: failed to get indexing progress)` – can’t get indexer status  

   If **all** indexers fail, the Gateway has no healthy one to use, so it returns the “bad indexers” error and no `data`.

4. **Why 0 pools**  
   The fetcher uses `result.data || { pools: [] }`. When there are errors, `data` is `null`, so we use `{ pools: [] }`. We then filter for USDC pairs and TVL > 0. Result: **0 pools** for every token, hence “0 out of 16” and `{ "pools": [] }` from the API.

## Flow

```
GET /api/cache/tokenized-stock-pools
  → fetchTokenizedStockPools()
  → for each of 16 token addresses:
      POST GraphQL to The Graph Gateway (Uniswap V3 subgraph)
      → Gateway routes to indexers
      → All indexers fail → Gateway returns 200 + { data: null, errors: ["bad indexers: ..."] }
  → We use result.data || { pools: [] } → always 0 pools per token
  → validPools = [] → API returns { "pools": [] }
```

## How to Verify

1. **Run the test script** (uses same GraphQL query as the API):
   ```bash
   npx tsx scripts/test-tokenized-stock-pools-api.ts
   ```
   It checks The Graph (and optionally Goldsky) and prints which endpoints fail and why.

2. **Call the API** while dev server is running:
   ```bash
   curl -s http://localhost:3000/api/cache/tokenized-stock-pools | jq .
   ```
   When the subgraph is failing, you get `{ "pools": [] }` (or 503 if we throw on subgraph errors).

3. **Check The Graph**  
   - [The Graph Status](https://status.thegraph.com/)  
   - [Uniswap V3 subgraph on Graph Explorer](https://thegraph.com/explorer/subgraphs/5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV)

## What You Can Do

1. **API key**  
   Ensure `NEXT_PUBLIC_THE_GRAPH_API_KEY` or `THE_GRAPH_API_KEY` is set ([The Graph Studio](https://thegraph.com/studio/apikeys/)).  
   Required for Gateway auth; it does **not** fix “bad indexers” when all indexers are down.

2. **Wait for indexers to recover**  
   “Bad indexers” is a **supply-side** issue: indexers are behind or failing. This usually clears when The Graph’s indexers sync and attest again.

3. **Alternative subgraph**  
   There is no other official Uniswap V3 Ethereum subgraph. Goldsky’s `uniswap-v3-ethereum` public endpoint returns 404. If you deploy your own (e.g. Goldsky, Envio), set `NEXT_PUBLIC_UNISWAP_GRAPHQL_URL` to that URL; the app uses it when provided.

4. **Error handling in the app**  
   The fetcher detects subgraph-wide failures (“bad indexers”, “indexing_error”, “auth error”, “too far behind”) and **throws** so the API returns **503** with a clear message instead of **200** and empty pools. That makes “subgraph unavailable” explicit.

## From The Graph Docs (Context7)

The following comes from the official [The Graph docs](https://thegraph.com/docs/) (via Context7) and explains **what causes these errors** and **what to do differently**.

### 1. Authentication – use Bearer, not key-in-URL

- **Two supported methods:**
  - **Key in URL**: `https://gateway.thegraph.com/api/<API_KEY>/subgraphs/id/<SUBGRAPH_ID>`. Docs say “optimal for direct Subgraph interactions.”
  - **Bearer token**: `Authorization: Bearer <API_KEY>` with **base URL** (no key in path): `https://gateway.thegraph.com/api/subgraphs/id/<SUBGRAPH_ID>`. Docs say this “provides an added layer of security.”
- **“auth error: missing authorization header”** occurs when you hit the **base** Gateway URL (no key in path) **without** an `Authorization` header. The public endpoint expects Bearer auth.
- **What we do now:** When an API key is set, we use **Bearer auth** and the **base Gateway URL** (no key in path), per the Bearer example in the docs. The app uses this for both the tokenized-stock-pools fetcher and the GraphQL proxy.

### 2. `indexing_error` and `subgraphError: allow`

- For subgraphs with **nonFatalErrors** enabled, you can use the `subgraphError: allow` argument in your query and still receive data when there are indexing errors; `_meta { hasIndexingErrors }` indicates issues.
- **Important:** “The Graph Network does not yet support non-fatal errors.” Uniswap V3 on Ethereum uses the **decentralized network** (Gateway → indexers). So **`subgraphError: allow` and nonFatalErrors do not apply** to our use case. We cannot use them to work around “bad indexers” or `indexing_error` for this subgraph.

### 3. “Bad indexers” / indexer failures

- The docs don’t define “bad indexers” explicitly. In practice, it means the **Gateway** could not get a successful response from **any** of the decentralized indexers it tried (e.g. all “too far behind,” 400, `indexing_error`, etc.).
- **Fetch strategies (Graph Client):** The docs describe **retry**, **timeout**, **fallback**, and **race**:
  - **retry** / **timeout**: Help with transient network or indexing issues.
  - **fallback** / **race**: Use **multiple GraphQL endpoints** (e.g. Gateway + custom indexer, or multiple subgraph URLs). If one fails or is slow, the client tries the next or uses the first successful response.
- We already use **retry** and **timeout** in our fetcher. **Fallback** or **race** would require a **second endpoint** (e.g. another provider or custom indexer). There is no public Uniswap V3 Ethereum alternative we can use today (Goldsky’s `uniswap-v3-ethereum` returns 404), but the structure is in place to add a fallback when one becomes available.

### 4. Summary of what to do differently

| Area | Before | After (per docs) |
|------|--------|-------------------|
| **Auth** | API key in Gateway URL path | **Bearer** `Authorization: Bearer <KEY>` + **base URL** (no key in path) |
| **Subgraph errors** | N/A | `subgraphError: allow` / nonFatalErrors **not supported** on The Graph Network for Uniswap V3 |
| **Indexer failures** | Single Gateway URL, retry/timeout | Keep retry/timeout; add **fallback** or **race** when a second endpoint exists |
| **API response** | 200 + empty pools on failure | **503** + clear “Subgraph unavailable” message when we detect auth/indexer errors |

## References

- [The Graph Gateway](https://thegraph.com/docs/en/querying/gateway/)
- [Managing API keys](https://thegraph.com/docs/en/subgraphs/querying/managing-api-keys/) – Bearer vs key-in-URL
- [Graph Client – fetch strategies](https://thegraph.com/docs/en/subgraphs/querying/graph-client/) – retry, timeout, fallback, race
- [Non-fatal errors](https://thegraph.com/docs/en/subgraphs/developing/creating/advanced/) – not supported on The Graph Network
- [Uniswap V3 Subgraph](https://github.com/Uniswap/v3-subgraph)
- [POOL_FETCHING_FIX.md](./POOL_FETCHING_FIX.md) – API key and Gateway setup
- [GRAPH_SETUP.md](./GRAPH_SETUP.md) – Graph configuration
