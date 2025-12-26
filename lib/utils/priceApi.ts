/**
 * Price API utility for fetching token prices
 * Uses CoinGecko API for price data
 */

interface CoinGeckoPriceResponse {
  [tokenAddress: string]: {
    usd: number;
  };
}

interface PriceCacheEntry {
  price: number;
  timestamp: number;
}

// In-memory cache for prices (5 minute TTL)
const priceCache = new Map<string, PriceCacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Maximum retries for failed requests
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

/**
 * Maps chain ID to CoinGecko platform ID
 */
function getCoinGeckoNetworkId(chainId: number): string {
  // CoinGecko platform IDs
  const networkMap: { [key: number]: string } = {
    1: 'ethereum',
    56: 'binance-smart-chain',
    137: 'polygon-pos',
    250: 'fantom',
    43114: 'avalanche',
    42161: 'arbitrum-one',
    10: 'optimistic-ethereum',
    8453: 'base',
  };
  
  return networkMap[chainId] || 'ethereum'; // Default to ethereum
}

/**
 * Sleep helper for retries
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Validates Ethereum address format
 */
function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Fetches token prices from CoinGecko API with retry logic
 */
async function fetchFromCoinGecko(
  addresses: string[],
  networkId: string,
  retries = MAX_RETRIES
): Promise<CoinGeckoPriceResponse | null> {
  // Filter and validate addresses
  const validAddresses = addresses
    .map(addr => addr.toLowerCase())
    .filter(addr => isValidAddress(addr));

  if (validAddresses.length === 0) {
    console.warn('No valid token addresses provided for price fetch');
    return null;
  }

  const addressesParam = validAddresses.join(',');
  const url = `https://api.coingecko.com/api/v3/simple/token_price/${networkId}?contract_addresses=${addressesParam}&vs_currencies=usd`;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      // Handle rate limiting (429)
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : RETRY_DELAY * (attempt + 1);
        
        if (attempt < retries) {
          console.warn(`Rate limited by CoinGecko API. Retrying after ${waitTime}ms...`);
          await sleep(waitTime);
          continue;
        }
        
        console.error('CoinGecko API rate limit exceeded');
        return null;
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.warn(`CoinGecko API error (${response.status}): ${errorText}`);
        
        // Don't retry on 4xx errors (client errors like 400 Bad Request)
        if (response.status >= 400 && response.status < 500) {
          console.error(`CoinGecko API client error: ${errorText}`);
          return null;
        }
        
        // Retry on server errors (5xx)
        if (response.status >= 500 && attempt < retries) {
          await sleep(RETRY_DELAY * (attempt + 1));
          continue;
        }
        
        return null;
      }

      const data: CoinGeckoPriceResponse = await response.json();
      return data;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Error fetching from CoinGecko (attempt ${attempt + 1}/${retries + 1}):`, errorMessage);
      
      // Retry on network errors
      if (attempt < retries) {
        await sleep(RETRY_DELAY * (attempt + 1));
        continue;
      }
      
      return null;
    }
  }

  return null;
}

/**
 * Fetches USD price for a token by its contract address
 * @param tokenAddress - Token contract address (checksummed or lowercase)
 * @param chainId - Chain ID (default: 1 for Ethereum mainnet)
 * @returns USD price of the token, or null if fetch fails
 */
export async function fetchTokenPrice(
  tokenAddress: string,
  chainId: number = 1
): Promise<number | null> {
  if (!tokenAddress || !isValidAddress(tokenAddress)) {
    console.warn(`Invalid token address: ${tokenAddress}`);
    return null;
  }

  const normalizedAddress = tokenAddress.toLowerCase();
  const cacheKey = `${chainId}:${normalizedAddress}`;
  const cached = priceCache.get(cacheKey);

  // Return cached price if still valid
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.price;
  }

  const networkId = getCoinGeckoNetworkId(chainId);
  const data = await fetchFromCoinGecko([normalizedAddress], networkId);

  if (!data) {
    console.warn(`Failed to fetch price for token ${tokenAddress} on chain ${chainId}`);
    return null;
  }

  const priceData = data[normalizedAddress];

  if (!priceData || typeof priceData.usd !== 'number' || priceData.usd <= 0) {
    console.warn(`No valid price data found for token ${tokenAddress} on CoinGecko`);
    return null;
  }

  const price = priceData.usd;

  // Cache the price
  priceCache.set(cacheKey, {
    price,
    timestamp: Date.now(),
  });

  return price;
}

/**
 * Fetches USD prices for multiple tokens in a single call
 * @param tokenAddresses - Array of token contract addresses
 * @param chainId - Chain ID (default: 1 for Ethereum mainnet)
 * @returns Map of token address to USD price
 */
export async function fetchTokenPrices(
  tokenAddresses: string[],
  chainId: number = 1
): Promise<Map<string, number>> {
  const prices = new Map<string, number>();
  
  if (!tokenAddresses || tokenAddresses.length === 0) {
    return prices;
  }

  // Filter, validate, remove duplicates and normalize addresses
  const uniqueAddresses = Array.from(
    new Set(
      tokenAddresses
        .filter(addr => addr && isValidAddress(addr))
        .map(addr => addr.toLowerCase())
    )
  );

  if (uniqueAddresses.length === 0) {
    console.warn('No valid token addresses provided for price fetch');
    return prices;
  }

  // Check cache first
  const uncachedAddresses: string[] = [];
  for (const address of uniqueAddresses) {
    const cacheKey = `${chainId}:${address}`;
    const cached = priceCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      prices.set(address, cached.price);
    } else {
      uncachedAddresses.push(address);
    }
  }

  // Fetch uncached prices
  // CoinGecko free API only allows 1 contract address per request
  // Fetch prices one at a time to avoid exceeding the limit
  if (uncachedAddresses.length > 0) {
    const networkId = getCoinGeckoNetworkId(chainId);
    
    // Fetch prices sequentially (one address at a time) for free API tier
    for (const address of uncachedAddresses) {
      const data = await fetchFromCoinGecko([address], networkId);

      if (data) {
        const priceData = data[address];
        if (priceData && typeof priceData.usd === 'number' && priceData.usd > 0) {
          const price = priceData.usd;
          prices.set(address, price);
          
          // Cache the price
          const cacheKey = `${chainId}:${address}`;
          priceCache.set(cacheKey, {
            price,
            timestamp: Date.now(),
          });
        }
      }
      
      // Add a small delay between requests to avoid rate limiting
      if (uncachedAddresses.length > 1) {
        await sleep(200); // 200ms delay between requests
      }
    }
  }

  return prices;
}

/**
 * Clears the price cache
 */
export function clearPriceCache(): void {
  priceCache.clear();
}

