import { TokenInfo } from '@/lib/etherscan/client';

const CACHE_KEY_PREFIX = 'wallet_tokens_';
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

export interface CachedWalletTokens {
  tokens: TokenInfo[];
  timestamp: number;
}

/**
 * Generates a cache key for a wallet address
 */
function getCacheKey(walletAddress: string): string {
  return `${CACHE_KEY_PREFIX}${walletAddress.toLowerCase()}`;
}

/**
 * Checks if a cache timestamp is still valid (less than 24 hours old)
 */
export function isCacheValid(timestamp: number): boolean {
  const now = Date.now();
  const age = now - timestamp;
  return age < CACHE_DURATION_MS;
}

/**
 * Retrieves cached token data for a wallet address if it exists and is valid
 * @returns Cached tokens if valid, null otherwise
 */
export function getWalletTokensCache(walletAddress: string): TokenInfo[] | null {
  if (typeof window === 'undefined') {
    // Server-side rendering - no localStorage available
    return null;
  }

  try {
    const cacheKey = getCacheKey(walletAddress);
    const cachedData = localStorage.getItem(cacheKey);

    if (!cachedData) {
      return null;
    }

    const parsed: CachedWalletTokens = JSON.parse(cachedData);

    if (!parsed.tokens || !parsed.timestamp) {
      // Invalid cache structure
      return null;
    }

    if (!isCacheValid(parsed.timestamp)) {
      // Cache expired, remove it
      localStorage.removeItem(cacheKey);
      return null;
    }

    // Migrate old cache entries: add default chainId and chain if missing
    const migratedTokens = parsed.tokens.map(token => {
      if (!('chainId' in token) || !('chain' in token)) {
        // Old cache entry - default to Ethereum
        return {
          ...token,
          chainId: 1,
          chain: 'ETHEREUM',
        };
      }
      return token;
    });

    return migratedTokens;
  } catch (error) {
    console.error('Error reading wallet tokens cache:', error);
    // If cache is corrupted, remove it
    try {
      const cacheKey = getCacheKey(walletAddress);
      localStorage.removeItem(cacheKey);
    } catch (removeError) {
      console.error('Error removing corrupted cache:', removeError);
    }
    return null;
  }
}

/**
 * Stores token data for a wallet address in localStorage with current timestamp
 */
export function setWalletTokensCache(walletAddress: string, tokens: TokenInfo[]): void {
  if (typeof window === 'undefined') {
    // Server-side rendering - no localStorage available
    return;
  }

  try {
    const cacheKey = getCacheKey(walletAddress);
    const cacheData: CachedWalletTokens = {
      tokens,
      timestamp: Date.now(),
    };

    localStorage.setItem(cacheKey, JSON.stringify(cacheData));
  } catch (error) {
    console.error('Error writing wallet tokens cache:', error);
    // localStorage might be full or unavailable, but don't throw
  }
}

/**
 * Clears cached token data for a specific wallet address
 */
export function clearWalletTokensCache(walletAddress: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const cacheKey = getCacheKey(walletAddress);
    localStorage.removeItem(cacheKey);
  } catch (error) {
    console.error('Error clearing wallet tokens cache:', error);
  }
}

