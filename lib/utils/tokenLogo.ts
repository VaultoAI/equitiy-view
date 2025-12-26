import { getAddress, isAddress } from 'viem';

/**
 * Chain ID to TrustWallet chain name mapping
 */
const CHAIN_NAME_MAP: Record<number, string> = {
  1: 'ethereum',
  137: 'polygon',
  56: 'smartchain',
  43114: 'avalanche',
  250: 'fantom',
  42161: 'arbitrum',
  10: 'optimism',
  8453: 'base',
};

/**
 * In-memory cache for logo URLs to avoid repeated lookups
 */
const logoCache = new Map<string, string | null>();

/**
 * Checks if an address is valid
 */
function isValidAddress(address: string): boolean {
  try {
    return isAddress(address);
  } catch {
    return false;
  }
}

/**
 * Gets the TrustWallet chain name for a given chain ID
 */
function getChainName(chainId: number): string {
  return CHAIN_NAME_MAP[chainId] || 'ethereum';
}

/**
 * Generates TrustWallet assets URL for a token logo
 * @param tokenAddress - Token contract address
 * @param chainId - Chain ID (default: 1 for Ethereum mainnet)
 * @returns TrustWallet logo URL
 */
function getTrustWalletLogoUrl(tokenAddress: string, chainId: number = 1): string {
  if (!isValidAddress(tokenAddress)) {
    throw new Error(`Invalid token address: ${tokenAddress}`);
  }

  const checksummedAddress = getAddress(tokenAddress);
  const chainName = getChainName(chainId);
  
  return `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/${chainName}/assets/${checksummedAddress}/logo.png`;
}

/**
 * Fetches token logo URL from TrustWallet assets repository
 * @param tokenAddress - Token contract address
 * @param chainId - Chain ID (default: 1 for Ethereum mainnet)
 * @returns Logo URL if found, null otherwise
 */
async function fetchTrustWalletLogo(
  tokenAddress: string,
  chainId: number = 1
): Promise<string | null> {
  const cacheKey = `${chainId}:${tokenAddress.toLowerCase()}`;
  
  // Check cache first
  if (logoCache.has(cacheKey)) {
    return logoCache.get(cacheKey) || null;
  }

  try {
    const logoUrl = getTrustWalletLogoUrl(tokenAddress, chainId);
    
    // Verify the logo exists by making a HEAD request
    const response = await fetch(logoUrl, { method: 'HEAD' });
    
    if (response.ok) {
      logoCache.set(cacheKey, logoUrl);
      return logoUrl;
    } else {
      // Logo doesn't exist, cache null to avoid repeated requests
      logoCache.set(cacheKey, null);
      return null;
    }
  } catch (error) {
    // Network error or invalid address, cache null
    logoCache.set(cacheKey, null);
    return null;
  }
}

/**
 * Gets token logo URL with fallback mechanisms
 * Primary source: TrustWallet assets repository
 * 
 * @param tokenAddress - Token contract address
 * @param chainId - Chain ID (default: 1 for Ethereum mainnet)
 * @returns Logo URL string (always returns a URL, uses TrustWallet format even if not verified)
 */
export function getTokenLogoUrl(tokenAddress: string, chainId: number = 1): string {
  if (!isValidAddress(tokenAddress)) {
    // Return a placeholder URL for invalid addresses
    return '';
  }

  // Always return TrustWallet URL format
  // The component will handle 404s and show fallback
  return getTrustWalletLogoUrl(tokenAddress, chainId);
}

/**
 * Verifies if a token logo exists at the given URL
 * @param logoUrl - Logo URL to verify
 * @returns Promise that resolves to true if logo exists, false otherwise
 */
export async function verifyLogoExists(logoUrl: string): Promise<boolean> {
  if (!logoUrl) {
    return false;
  }

  try {
    const response = await fetch(logoUrl, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Fetches and verifies token logo URL
 * @param tokenAddress - Token contract address
 * @param chainId - Chain ID (default: 1 for Ethereum mainnet)
 * @returns Promise that resolves to logo URL if found, null otherwise
 */
export async function fetchTokenLogoUrl(
  tokenAddress: string,
  chainId: number = 1
): Promise<string | null> {
  return fetchTrustWalletLogo(tokenAddress, chainId);
}

/**
 * Clears the logo cache (useful for testing or forced refresh)
 */
export function clearLogoCache(): void {
  logoCache.clear();
}

