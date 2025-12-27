/**
 * Price API utility for fetching token prices from CoinGecko
 */

interface PriceCacheEntry {
  price: number;
  timestamp: number;
}

// In-memory cache for prices (5 minute TTL)
const priceCache = new Map<string, PriceCacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Native token CoinGecko IDs by chain ID
 */
const NATIVE_TOKEN_COINGECKO_IDS: Record<number, string> = {
  1: 'ethereum', // ETH
  10: 'ethereum', // ETH on Optimism
  56: 'binancecoin', // BNB
  137: 'matic-network', // MATIC
  8453: 'ethereum', // ETH on Base
  42161: 'ethereum', // ETH on Arbitrum
  43114: 'avalanche-2', // AVAX
  534352: 'ethereum', // ETH on Scroll
  81457: 'ethereum', // ETH on Blast
  59144: 'ethereum', // ETH on Linea
};

/**
 * Common token addresses mapped to CoinGecko coin IDs
 * This mapping is primarily for Ethereum mainnet (chainId: 1)
 * Some tokens may exist on other chains with the same address
 */
const TOKEN_TO_COINGECKO_ID: Record<string, string> = {
  // Stablecoins
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 'usd-coin', // USDC
  '0xdac17f958d2ee523a2206206994597c13d831ec7': 'tether', // USDT
  '0x6b175474e89094c44da98b954eedeac495271d0f': 'dai', // DAI
  '0x4fabb145d64652a948d72533023f6e7a623c7c53': 'binance-usd', // BUSD
  
  // Wrapped tokens
  '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': 'weth', // WETH
  '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': 'wrapped-bitcoin', // WBTC
  
  // Popular tokens
  '0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0': 'matic-network', // MATIC
  '0x514910771af9ca656af840dff83e8264ecf986ca': 'chainlink', // LINK
  '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984': 'uniswap', // UNI
  '0x0bc529c00c6401aef6d220be8c6e1661f2299d24': 'yearn-finance', // YFI
  '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2': 'maker', // MKR
  '0x0f5d2fb29fb7d3cfee444a200298f468908cc942': 'decentraland', // MANA
  '0xe41d2489571d322189246dafa5ebde1f4699f498': '0x', // ZRX
  '0xdd974d5c2e2928de5f17b5082b16e3d0bdd10e03': 'kyber-network-crystal', // KNC
  '0x408e41876cccdc0f92210600ef50372656052a38': 'republic-protocol', // REN
  '0x6810e776880c02933d47db1b9fc05908e5386b96': 'gnosis', // GNO
  '0x0d8775f648430679a709e98d2b0cb6250d2887ef': 'basic-attention-token', // BAT
  '0x4e15361fd6b4bb609fa63c81a2be19d873717870': 'fantom', // FTM
  '0x6f259637dcd74c767781e37bc6133cd6a68aa161': 'huobi-token', // HT
  '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9': 'aave', // AAVE
  '0xba11d00c5f74255f56a5e366f4f77f5a186d7f55': 'band-protocol', // BAND
  '0x0f2d719407fdbeff09d87557abb7232601fd9f29': 'synthetix-network-token', // SNX
  '0x767fe9edc9e0df98e07454847909b5e959d7ca0e': 'illuvium', // ILV
  '0x4d224452801aced8b2f0aebe155379bb5d594381': 'apecoin', // APE
  '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce': 'shiba-inu', // SHIB
  '0x6982508145454ce325ddbe47a25d4ec3d2311933': 'pepe', // PEPE
};

/**
 * Chain ID to CoinGecko chain identifier mapping
 */
const CHAIN_ID_TO_COINGECKO_CHAIN: Record<number, string> = {
  1: 'ethereum',
  10: 'optimistic-ethereum',
  56: 'binance-smart-chain',
  137: 'polygon-pos',
  8453: 'base',
  42161: 'arbitrum-one',
  43114: 'avalanche',
  534352: 'scroll',
  81457: 'blast',
  59144: 'linea',
};

/**
 * Checks if an address is a native token address (all zeros)
 */
function isNativeTokenAddress(address: string): boolean {
  return address.toLowerCase() === '0x0000000000000000000000000000000000000000';
}

/**
 * Validates Ethereum address format
 */
function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Gets CoinGecko chain identifier from chain ID
 */
function getCoinGeckoChain(chainId: number): string {
  return CHAIN_ID_TO_COINGECKO_CHAIN[chainId] || 'ethereum';
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
  if (!isValidAddress(tokenAddress)) {
    console.warn(`⚠️ [Price API] Invalid address format: ${tokenAddress}`);
    return null;
  }

  const normalizedAddress = tokenAddress.toLowerCase();
  
  // Check cache first
  const cacheKey = `${normalizedAddress}-${chainId}`;
  const cached = priceCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.price;
  }

  try {
    const coinGeckoChain = getCoinGeckoChain(chainId);
    let coinGeckoId = TOKEN_TO_COINGECKO_ID[normalizedAddress];
    
    // Handle native tokens (0x0000...)
    if (isNativeTokenAddress(normalizedAddress)) {
      coinGeckoId = NATIVE_TOKEN_COINGECKO_IDS[chainId] || 'ethereum';
    }
    
    let price: number | null = null;
    
    if (coinGeckoId) {
      // Use coin ID if available
      const response = await fetch(
        `/api/coingecko?coinId=${coinGeckoId}`,
        { next: { revalidate: 60 } }
      );
      
      if (response.ok) {
        const data = await response.json();
        price = data.price || null;
      }
    }
    
    // If coin ID lookup failed or not available, try contract address
    // Skip for native tokens as they're already handled above
    if (price === null && !isNativeTokenAddress(normalizedAddress)) {
      const response = await fetch(
        `/api/coingecko?contract=${normalizedAddress}&chainId=${coinGeckoChain}`,
        { next: { revalidate: 60 } }
      );
      
      if (response.ok) {
        const data = await response.json();
        price = data.price || null;
      }
    }
    
    if (price !== null) {
      // Cache the result
      priceCache.set(cacheKey, { price, timestamp: Date.now() });
      return price;
    }
    
    return null;
  } catch (error) {
    console.error(`❌ [Price API] Error fetching price for ${normalizedAddress}:`, error);
    return null;
  }
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
  if (!tokenAddresses || tokenAddresses.length === 0) {
    return new Map<string, number>();
  }

  const priceMap = new Map<string, number>();
  const coinGeckoChain = getCoinGeckoChain(chainId);
  
  // Separate tokens into those with known coin IDs and those without
  const tokensWithCoinIds: string[] = [];
  const tokensWithoutCoinIds: string[] = [];
  const coinIdMap = new Map<string, string>(); // address -> coinId
  
  tokenAddresses.forEach((address) => {
    if (!isValidAddress(address)) {
      console.warn(`⚠️ [Price API] Invalid address format: ${address}`);
      return;
    }
    
    const normalizedAddress = address.toLowerCase();
    
    // Check cache first
    const cacheKey = `${normalizedAddress}-${chainId}`;
    const cached = priceCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      priceMap.set(normalizedAddress, cached.price);
      return;
    }
    
    // Handle native tokens
    let coinId = TOKEN_TO_COINGECKO_ID[normalizedAddress];
    if (isNativeTokenAddress(normalizedAddress)) {
      coinId = NATIVE_TOKEN_COINGECKO_IDS[chainId] || 'ethereum';
    }
    
    if (coinId) {
      tokensWithCoinIds.push(normalizedAddress);
      coinIdMap.set(normalizedAddress, coinId);
    } else {
      tokensWithoutCoinIds.push(normalizedAddress);
    }
  });
  
  try {
    // Fetch prices for tokens with known coin IDs in batch
    if (tokensWithCoinIds.length > 0) {
      const coinIds = Array.from(new Set(Array.from(coinIdMap.values())));
      const response = await fetch(
        `/api/coingecko?coinIds=${coinIds.join(',')}`,
        { next: { revalidate: 60 } }
      );
      
      if (response.ok) {
        const data = await response.json();
        const prices = data.prices || {};
        
        tokensWithCoinIds.forEach((address) => {
          const coinId = coinIdMap.get(address);
          if (coinId && prices[coinId]?.usd) {
            const price = prices[coinId].usd;
            priceMap.set(address, price);
            // Cache the result
            const cacheKey = `${address}-${chainId}`;
            priceCache.set(cacheKey, { price, timestamp: Date.now() });
          }
        });
      }
    }
    
    // Fetch prices for tokens without known coin IDs using contract addresses
    if (tokensWithoutCoinIds.length > 0) {
      const response = await fetch(
        `/api/coingecko?contracts=${tokensWithoutCoinIds.join(',')}&chainId=${coinGeckoChain}`,
        { next: { revalidate: 60 } }
      );
      
      if (response.ok) {
        const data = await response.json();
        const prices = data.prices || {};
        
        tokensWithoutCoinIds.forEach((address) => {
          if (prices[address] !== undefined && prices[address] !== null) {
            const price = prices[address];
            priceMap.set(address, price);
            // Cache the result
            const cacheKey = `${address}-${chainId}`;
            priceCache.set(cacheKey, { price, timestamp: Date.now() });
          }
        });
      }
    }
  } catch (error) {
    console.error('❌ [Price API] Error fetching token prices:', error);
  }
  
  return priceMap;
}

/**
 * Clears the price cache
 */
export function clearPriceCache(): void {
  priceCache.clear();
}
