/**
 * Server-side cache system for pool data
 * Uses in-memory storage with TTL (Time To Live) validation
 */

const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour in milliseconds

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// In-memory cache store
const cacheStore = new Map<string, CacheEntry<any>>();

/**
 * Checks if a cache timestamp is still valid (less than 1 hour old)
 */
export function isCacheValid(timestamp: number): boolean {
  const now = Date.now();
  const age = now - timestamp;
  return age < CACHE_DURATION_MS;
}

/**
 * Retrieves cached data if it exists and is valid
 * @param key - Cache key
 * @returns Cached data if valid, null otherwise
 */
export function getCachedData<T>(key: string): T | null {
  try {
    const entry = cacheStore.get(key);
    
    if (!entry) {
      return null;
    }

    if (!isCacheValid(entry.timestamp)) {
      // Cache expired, remove it
      cacheStore.delete(key);
      return null;
    }

    return entry.data as T;
  } catch (error) {
    console.error(`[Server Cache] Error reading cache for key ${key}:`, error);
    return null;
  }
}

/**
 * Stores data in cache with current timestamp
 * @param key - Cache key
 * @param data - Data to cache
 */
export function setCachedData<T>(key: string, data: T): void {
  try {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
    };
    cacheStore.set(key, entry);
  } catch (error) {
    console.error(`[Server Cache] Error writing cache for key ${key}:`, error);
  }
}

/**
 * Clears cached data for a specific key
 * @param key - Cache key to clear
 */
export function clearCache(key: string): void {
  try {
    cacheStore.delete(key);
  } catch (error) {
    console.error(`[Server Cache] Error clearing cache for key ${key}:`, error);
  }
}

/**
 * Clears all cached data
 */
export function clearAllCache(): void {
  try {
    cacheStore.clear();
  } catch (error) {
    console.error('[Server Cache] Error clearing all cache:', error);
  }
}

/**
 * Gets the age of a cache entry in milliseconds
 * @param key - Cache key
 * @returns Age in milliseconds, or null if entry doesn't exist
 */
export function getCacheAge(key: string): number | null {
  const entry = cacheStore.get(key);
  if (!entry) {
    return null;
  }
  return Date.now() - entry.timestamp;
}

/**
 * Checks if a cache entry exists (regardless of validity)
 * @param key - Cache key
 * @returns True if entry exists, false otherwise
 */
export function cacheExists(key: string): boolean {
  return cacheStore.has(key);
}

/**
 * Retrieves cached data if it exists, regardless of validity
 * @param key - Cache key
 * @returns Cached data if exists, null otherwise
 */
export function getCachedDataIgnoringValidity<T>(key: string): T | null {
  try {
    const entry = cacheStore.get(key);
    if (!entry) {
      return null;
    }
    return entry.data as T;
  } catch (error) {
    console.error(`[Server Cache] Error reading cache for key ${key}:`, error);
    return null;
  }
}

/**
 * Gets the timestamp of a cache entry
 * @param key - Cache key
 * @returns Timestamp in milliseconds, or null if entry doesn't exist
 */
export function getCacheTimestamp(key: string): number | null {
  const entry = cacheStore.get(key);
  if (!entry) {
    return null;
  }
  return entry.timestamp;
}

