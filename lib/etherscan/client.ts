export interface EtherscanTokenTransfer {
  blockNumber: string;
  timeStamp: string;
  hash: string;
  nonce: string;
  blockHash: string;
  from: string;
  contractAddress: string;
  to: string;
  value: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimal: string;
  transactionIndex: string;
  gas: string;
  gasPrice: string;
  gasUsed: string;
  cumulativeGasUsed: string;
  input: string;
  confirmations: string;
}

export interface EtherscanResponse<T> {
  status: string;
  message: string;
  result: T;
}

// Supported chain IDs for Etherscan V2 API
// Based on Etherscan V2 documentation: https://docs.etherscan.io/etherscan-v2
export const SUPPORTED_CHAIN_IDS = [
  1,      // Ethereum
  10,     // Optimism
  56,     // BSC (Binance Smart Chain)
  137,    // Polygon
  8453,   // Base
  42161,  // Arbitrum
  43114,  // Avalanche
  534352, // Scroll
  81457,  // Blast
  59144,  // Linea
] as const;

export const CHAIN_NAMES: Record<number, string> = {
  1: 'ETHEREUM',
  10: 'OPTIMISM',
  56: 'BSC',
  137: 'POLYGON',
  8453: 'BASE',
  42161: 'ARBITRUM',
  43114: 'AVALANCHE',
  534352: 'SCROLL',
  81457: 'BLAST',
  59144: 'LINEA',
};

// Use Next.js API route as proxy to avoid CORS issues
// V2 API: https://api.etherscan.io/v2/api?chainid={chainId}&module=account&action=...
const ETHERSCAN_PROXY_URL = typeof window !== 'undefined' ? '/api/etherscan' : 'https://api.etherscan.io/v2/api';

export async function getTokenTransfers(address: string, chainId: number = 1): Promise<EtherscanTokenTransfer[]> {
  try {
    // V2 API format: chainid={chainId}&module=account&action=tokentx
    const url = `${ETHERSCAN_PROXY_URL}?chainid=${chainId}&module=account&action=tokentx&address=${address}&startblock=0&endblock=99999999&sort=asc`;
    
    console.log(`🔍 [Etherscan V2] Fetching token transfers for ${address} on chain ${chainId} (${CHAIN_NAMES[chainId] || 'UNKNOWN'})`);
    const response = await fetch(url);
    const data: EtherscanResponse<EtherscanTokenTransfer[]> = await response.json();
    
    if (data.status === '1' && Array.isArray(data.result)) {
      console.log(`✅ [Etherscan V2] Found ${data.result.length} token transfers on chain ${chainId}`);
      return data.result;
    } else {
      console.warn(`⚠️ [Etherscan V2] API response for chain ${chainId}:`, data.message, data.result);
      return [];
    }
  } catch (error) {
    console.error(`❌ [Etherscan V2] Error fetching token transfers for chain ${chainId}:`, error);
    return [];
  }
}

export async function getTokenBalance(
  tokenAddress: string,
  walletAddress: string,
  chainId: number = 1
): Promise<string> {
  try {
    // V2 API format according to docs:
    // https://api.etherscan.io/v2/api?chainid={chainId}&module=account&action=tokenbalance&contractaddress={token}&address={wallet}&tag=latest&apikey={key}
    const url = `${ETHERSCAN_PROXY_URL}?chainid=${chainId}&module=account&action=tokenbalance&contractaddress=${tokenAddress}&address=${walletAddress}&tag=latest`;
    
    console.log(`  🔍 [Etherscan V2] Fetching balance for token ${tokenAddress} on chain ${chainId}`);
    const response = await fetch(url);
    const data: EtherscanResponse<string> = await response.json();
    
    if (data.status === '1' && data.result !== undefined) {
      const balance = data.result;
      // Balance is returned as a string in the token's smallest decimal representation
      console.log(`  ✅ [Etherscan V2] Balance fetched: ${balance} (raw value) on chain ${chainId}`);
      return balance;
    } else {
      console.warn(`  ⚠️ [Etherscan V2] Balance fetch failed for ${tokenAddress} on chain ${chainId}: ${data.message || 'Unknown error'}`, data);
      return '0';
    }
  } catch (error) {
    console.error(`❌ [Etherscan V2] Error fetching balance for ${tokenAddress} on chain ${chainId}:`, error);
    return '0';
  }
}

/**
 * Fetches native balance (ETH, MATIC, BNB, etc.) for a wallet address
 * @param walletAddress - Wallet address to check
 * @param chainId - Chain ID (default: 1 for Ethereum)
 * @returns Native balance as a string in wei (or equivalent smallest unit)
 */
export async function getNativeBalance(
  walletAddress: string,
  chainId: number = 1
): Promise<string> {
  try {
    // V2 API format: chainid={chainId}&module=account&action=balance&address={wallet}&tag=latest
    const url = `${ETHERSCAN_PROXY_URL}?chainid=${chainId}&module=account&action=balance&address=${walletAddress}&tag=latest`;
    
    console.log(`  🔍 [Etherscan V2] Fetching native balance for ${walletAddress} on chain ${chainId} (${CHAIN_NAMES[chainId] || 'UNKNOWN'})`);
    const response = await fetch(url);
    const data: EtherscanResponse<string> = await response.json();
    
    if (data.status === '1' && data.result !== undefined) {
      const balance = data.result;
      console.log(`  ✅ [Etherscan V2] Native balance fetched: ${balance} (raw value in wei) on chain ${chainId}`);
      return balance;
    } else {
      console.warn(`  ⚠️ [Etherscan V2] Native balance fetch failed for chain ${chainId}: ${data.message || 'Unknown error'}`, data);
      return '0';
    }
  } catch (error) {
    console.error(`❌ [Etherscan V2] Error fetching native balance for chain ${chainId}:`, error);
    return '0';
  }
}

export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  chainId: number;
  chain: string;
}

/**
 * Response format for addresstokenbalance endpoint
 */
interface AddressTokenBalanceResponse {
  TokenAddress: string;
  TokenName: string;
  TokenSymbol: string;
  TokenQuantity: string;
  TokenDivisor: string;
}

/**
 * Fetches all ERC-20 tokens held by an address using Etherscan V2 API
 * Uses the addresstokenbalance endpoint which directly returns all tokens with balances
 * @param walletAddress - Wallet address to check
 * @param chainId - Chain ID (default: 1 for Ethereum)
 * @param page - Page number for pagination (default: 1)
 * @param offset - Number of records per page, max 1000 (default: 1000)
 * @returns Array of TokenInfo for tokens with non-zero balances
 */
export async function getAddressTokenBalances(
  walletAddress: string,
  chainId: number = 1,
  page: number = 1,
  offset: number = 1000
): Promise<TokenInfo[]> {
  try {
    // V2 API format: chainid={chainId}&module=account&action=addresstokenbalance&address={address}&page={page}&offset={offset}
    const url = `${ETHERSCAN_PROXY_URL}?chainid=${chainId}&module=account&action=addresstokenbalance&address=${walletAddress}&page=${page}&offset=${offset}`;
    
    console.log(`🔍 [Etherscan V2] Fetching token balances for ${walletAddress} on chain ${chainId} (${CHAIN_NAMES[chainId] || 'UNKNOWN'}), page ${page}`);
    const response = await fetch(url);
    const data: EtherscanResponse<AddressTokenBalanceResponse[]> = await response.json();
    
    // Check if this is an API Pro requirement error
    if (data.status === '0' && typeof data.result === 'string' && data.result.includes('API Pro')) {
      console.log(`  ⚠️ [Etherscan V2] addresstokenbalance requires API Pro. Falling back to transfer-based method.`);
      throw new Error('API_PRO_REQUIRED');
    }
    
    if (data.status === '1' && Array.isArray(data.result)) {
      const tokenInfos: TokenInfo[] = [];
      
      data.result.forEach((tokenData) => {
        const tokenAddress = tokenData.TokenAddress.toLowerCase();
        const tokenQuantity = tokenData.TokenQuantity || '0';
        const tokenDivisor = parseInt(tokenData.TokenDivisor || '18');
        
        // Parse balance - TokenQuantity is returned as a string in the token's smallest decimal representation
        const balanceBigInt = BigInt(tokenQuantity || '0');
        const divisor = BigInt(10 ** tokenDivisor);
        const wholePart = balanceBigInt / divisor;
        const fractionalPart = balanceBigInt % divisor;
        const balanceNum = Number(wholePart) + Number(fractionalPart) / Number(divisor);
        
        // Only include tokens with non-zero balance (with small threshold to avoid floating point issues)
        if (balanceNum > 0.0000001) {
          tokenInfos.push({
            address: tokenAddress,
            symbol: tokenData.TokenSymbol || 'UNKNOWN',
            name: tokenData.TokenName || 'Unknown Token',
            decimals: tokenDivisor,
            balance: tokenQuantity,
            chainId,
            chain: CHAIN_NAMES[chainId] || 'UNKNOWN',
          });
          
          console.log(`  ✅ ${tokenData.TokenSymbol} (${tokenData.TokenName}): ${balanceNum.toFixed(4)} on ${CHAIN_NAMES[chainId]}`);
        }
      });
      
      console.log(`✅ [Etherscan V2] Found ${tokenInfos.length} tokens with non-zero balance on chain ${chainId}, page ${page}`);
      
      // Check if there are more pages (if result length equals offset, there might be more)
      if (data.result.length === offset) {
        console.log(`  📄 [Etherscan V2] Full page returned (${offset} tokens), checking for more pages...`);
        // Fetch next page
        const nextPageTokens = await getAddressTokenBalances(walletAddress, chainId, page + 1, offset);
        tokenInfos.push(...nextPageTokens);
      }
      
      return tokenInfos;
    } else {
      // Handle empty result or error
      if (data.status === '0' && data.message === 'No transactions found') {
        console.log(`  ℹ️  [Etherscan V2] No tokens found for ${walletAddress} on chain ${chainId}`);
        return [];
      }
      console.warn(`⚠️ [Etherscan V2] API response for chain ${chainId}:`, data.message, data.result);
      return [];
    }
  } catch (error) {
    // Re-throw API Pro error so caller can handle fallback
    if (error instanceof Error && error.message === 'API_PRO_REQUIRED') {
      throw error;
    }
    console.error(`❌ [Etherscan V2] Error fetching token balances for chain ${chainId}:`, error);
    return [];
  }
}

export async function getUniqueTokensFromTransfers(
  transfers: EtherscanTokenTransfer[],
  walletAddress: string,
  chainId: number = 1
): Promise<TokenInfo[]> {
  // Get unique token addresses
  const uniqueTokens = new Map<string, EtherscanTokenTransfer>();
  
  transfers.forEach((transfer) => {
    const tokenAddress = transfer.contractAddress.toLowerCase();
    if (tokenAddress && tokenAddress !== '0x' && !uniqueTokens.has(tokenAddress)) {
      uniqueTokens.set(tokenAddress, transfer);
    }
  });

  console.log(`🔍 [Etherscan V2] Found ${uniqueTokens.size} unique tokens, fetching balances...`);

  // Get balances for each unique token
  const tokenInfos: TokenInfo[] = [];
  let processedCount = 0;
  
  for (const [address, transfer] of uniqueTokens.entries()) {
    processedCount++;
    const tokenSymbol = transfer.tokenSymbol || 'UNKNOWN';
    const tokenName = transfer.tokenName || 'Unknown Token';
    console.log(`🔍 [Etherscan V2] Fetching balance ${processedCount}/${uniqueTokens.size} for ${tokenSymbol} (${address})`);
    
    const balance = await getTokenBalance(address, walletAddress, chainId);
    
    // Parse balance - it's returned as a string in the token's smallest decimal representation
    // Example: "1000000000" for USDC (6 decimals) = 1000 USDC
    const balanceBigInt = BigInt(balance || '0');
    const decimals = parseInt(transfer.tokenDecimal || '18');
    const divisor = BigInt(10 ** decimals);
    const wholePart = balanceBigInt / divisor;
    const fractionalPart = balanceBigInt % divisor;
    const balanceNum = Number(wholePart) + Number(fractionalPart) / Number(divisor);
    
    console.log(`  📊 Raw balance: ${balance}, Decimals: ${decimals}, Calculated: ${balanceNum.toFixed(6)}`);
    console.log(`  📊 BigInt calculation: ${balanceBigInt.toString()} / 10^${decimals} = ${balanceNum}`);
    
    // Only include tokens with non-zero balance (with small threshold to avoid floating point issues)
    if (balanceNum > 0.0000001) {
      tokenInfos.push({
        address,
        symbol: tokenSymbol,
        name: tokenName,
        decimals,
        balance,
        chainId,
        chain: CHAIN_NAMES[chainId] || 'UNKNOWN',
      });
      
      console.log(`  ✅ ${tokenSymbol} (${tokenName}): ${balanceNum.toFixed(4)} on ${CHAIN_NAMES[chainId]} - INCLUDED`);
    } else {
      console.log(`  ⏭️  ${tokenSymbol}: Balance is zero (${balanceNum}), skipping`);
    }
    
    // Small delay to avoid rate limiting (5 calls/second limit)
    if (processedCount < uniqueTokens.size) {
      await new Promise(resolve => setTimeout(resolve, 250)); // 250ms delay = ~4 calls/second
    }
  }

  console.log(`✅ [Etherscan V2] Completed balance fetching. Found ${tokenInfos.length} tokens with non-zero balance out of ${uniqueTokens.size} unique tokens.`);

  return tokenInfos;
}

/**
 * Native token symbols and decimals for each chain
 */
const NATIVE_TOKEN_INFO: Record<number, { symbol: string; name: string; decimals: number }> = {
  1: { symbol: 'ETH', name: 'Ethereum', decimals: 18 },
  10: { symbol: 'ETH', name: 'Optimism', decimals: 18 },
  56: { symbol: 'BNB', name: 'BNB', decimals: 18 },
  137: { symbol: 'MATIC', name: 'Polygon', decimals: 18 },
  8453: { symbol: 'ETH', name: 'Base', decimals: 18 },
  42161: { symbol: 'ETH', name: 'Arbitrum', decimals: 18 },
  43114: { symbol: 'AVAX', name: 'Avalanche', decimals: 18 },
  534352: { symbol: 'ETH', name: 'Scroll', decimals: 18 },
  81457: { symbol: 'ETH', name: 'Blast', decimals: 18 },
  59144: { symbol: 'ETH', name: 'Linea', decimals: 18 },
};

/**
 * Special address to represent native tokens in price lookups
 */
export const NATIVE_TOKEN_ADDRESSES: Record<number, string> = {
  1: '0x0000000000000000000000000000000000000000', // ETH
  10: '0x0000000000000000000000000000000000000000', // ETH on Optimism
  56: '0x0000000000000000000000000000000000000000', // BNB
  137: '0x0000000000000000000000000000000000000000', // MATIC
  8453: '0x0000000000000000000000000000000000000000', // ETH on Base
  42161: '0x0000000000000000000000000000000000000000', // ETH on Arbitrum
  43114: '0x0000000000000000000000000000000000000000', // AVAX
  534352: '0x0000000000000000000000000000000000000000', // ETH on Scroll
  81457: '0x0000000000000000000000000000000000000000', // ETH on Blast
  59144: '0x0000000000000000000000000000000000000000', // ETH on Linea
};

/**
 * Fetches tokens and balances from all supported chains
 * Uses Etherscan V2 API to query multiple chains in parallel
 * Includes native balances (ETH, MATIC, BNB, etc.)
 */
export async function getTokensFromAllChains(address: string): Promise<TokenInfo[]> {
  console.log(`🔍 [Etherscan V2] Fetching tokens from all supported chains for ${address}`);
  
  // Fetch from all chains in parallel
  const chainPromises = SUPPORTED_CHAIN_IDS.map(async (chainId) => {
    try {
      const chainTokens: TokenInfo[] = [];
      
      // Step 1: Get native balance for this chain
      const nativeBalance = await getNativeBalance(address, chainId);
      const nativeBalanceBigInt = BigInt(nativeBalance || '0');
      const nativeInfo = NATIVE_TOKEN_INFO[chainId];
      
      if (nativeInfo && nativeBalanceBigInt > 0n) {
        const nativeBalanceNum = Number(nativeBalanceBigInt) / Math.pow(10, nativeInfo.decimals);
        if (nativeBalanceNum > 0.0000001) {
          chainTokens.push({
            address: NATIVE_TOKEN_ADDRESSES[chainId],
            symbol: nativeInfo.symbol,
            name: nativeInfo.name,
            decimals: nativeInfo.decimals,
            balance: nativeBalance,
            chainId,
            chain: CHAIN_NAMES[chainId] || 'UNKNOWN',
          });
          console.log(`  ✅ [Chain ${chainId}] Native ${nativeInfo.symbol} balance: ${nativeBalanceNum.toFixed(6)}`);
        }
      }
      
      // Step 2: Get all ERC-20 tokens held by the address
      // Try addresstokenbalance first (requires API Pro), fall back to transfer-based method
      let erc20Tokens: TokenInfo[] = [];
      try {
        erc20Tokens = await getAddressTokenBalances(address, chainId, 1, 1000);
        console.log(`  ✅ [Chain ${chainId}] Using addresstokenbalance endpoint (API Pro)`);
      } catch (error) {
        if (error instanceof Error && error.message === 'API_PRO_REQUIRED') {
          // Fall back to transfer-based method for free API keys
          console.log(`  ⚠️  [Chain ${chainId}] API Pro required, falling back to transfer-based method`);
          const transfers = await getTokenTransfers(address, chainId);
          if (transfers.length > 0) {
            erc20Tokens = await getUniqueTokensFromTransfers(transfers, address, chainId);
          }
        } else {
          throw error;
        }
      }
      
      chainTokens.push(...erc20Tokens);
      
      if (erc20Tokens.length === 0) {
        console.log(`  ⏭️  [Chain ${chainId}] No ERC-20 tokens found`);
      }
      
      console.log(`  ✅ [Chain ${chainId} (${CHAIN_NAMES[chainId]})] Found ${chainTokens.length} tokens with balance (${chainTokens.filter(t => t.address === NATIVE_TOKEN_ADDRESSES[chainId]).length} native, ${chainTokens.filter(t => t.address !== NATIVE_TOKEN_ADDRESSES[chainId]).length} ERC-20)`);
      return chainTokens;
    } catch (error) {
      console.error(`  ❌ [Chain ${chainId}] Error fetching tokens:`, error);
      return [];
    }
  });

  // Wait for all chains to complete
  const results = await Promise.all(chainPromises);
  
  // Flatten all tokens from all chains
  const allTokens = results.flat();
  
  console.log(`✅ [Etherscan V2] Total tokens found across all chains: ${allTokens.length}`);
  
  return allTokens;
}

