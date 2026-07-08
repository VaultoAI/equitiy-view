/**
 * Server-side accessor for the live Ondo tokenized-equity universe.
 *
 * The list of Ondo Global Markets tokens grows frequently, so this refreshes
 * the address set from the official token list at runtime (cached in-process),
 * falling back to the vendored/generated snapshot when the network is
 * unavailable. This keeps the "Public Equities" list tracking *all* Ondo tokens
 * without requiring a redeploy each time Ondo lists a new stock.
 *
 * Server-only: it performs network I/O and must not be imported into client
 * bundles. Client code should use `isTokenizedStock` from `./tokenizedStocks`.
 */
import {
  ONDO_TOKEN_LIST_URL,
  ETHEREUM_CHAIN_ID,
  parseOndoEquityAddresses,
  type OndoTokenList,
} from './ondoConfig';
import { ONDO_EQUITY_ADDRESSES_BY_CHAIN } from './ondoEquityAddresses';

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const FETCH_TIMEOUT_MS = 8000;

interface AddressCacheEntry {
  addresses: string[];
  fetchedAt: number;
}

const cacheByChain = new Map<number, AddressCacheEntry>();
// In-flight refreshes, keyed by chain, so concurrent cache misses share a
// single network fetch instead of each hitting the token list URL.
const pendingByChain = new Map<number, Promise<string[]>>();

function snapshotAddresses(chainId: number): string[] {
  return [...(ONDO_EQUITY_ADDRESSES_BY_CHAIN[chainId] ?? [])];
}

async function refreshEquityAddresses(chainId: number): Promise<string[]> {
  const list = await fetchOndoTokenList();
  const fetched = list ? parseOndoEquityAddresses(list, chainId) : [];

  // Use freshly fetched addresses when present; otherwise fall back to the
  // vendored snapshot so a transient network failure never empties the list.
  const addresses = fetched.length > 0 ? fetched : snapshotAddresses(chainId);

  if (addresses.length > 0) {
    cacheByChain.set(chainId, { addresses, fetchedAt: Date.now() });
  }
  return addresses;
}

async function fetchOndoTokenList(): Promise<OndoTokenList | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(ONDO_TOKEN_LIST_URL, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn(`⚠️ [Ondo Tokens] Token list fetch failed: ${res.status} ${res.statusText}`);
      return null;
    }
    return (await res.json()) as OndoTokenList;
  } catch (err) {
    console.warn('⚠️ [Ondo Tokens] Token list fetch error, using vendored snapshot:', err);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Returns the lowercased Ondo tokenized-equity token addresses for a chain,
 * refreshing from the official list when the in-process cache is stale.
 * Always returns a usable list (falls back to the vendored snapshot).
 */
export async function getOndoEquityAddresses(
  chainId: number = ETHEREUM_CHAIN_ID
): Promise<string[]> {
  const cached = cacheByChain.get(chainId);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.addresses;
  }

  let pending = pendingByChain.get(chainId);
  if (!pending) {
    pending = refreshEquityAddresses(chainId).finally(() => pendingByChain.delete(chainId));
    pendingByChain.set(chainId, pending);
  }
  return pending;
}
