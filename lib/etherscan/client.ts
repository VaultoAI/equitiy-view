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

// Use Next.js API route as proxy to avoid CORS issues
// V2 API: https://api.etherscan.io/v2/api?chainid=1&module=account&action=...
const ETHERSCAN_PROXY_URL = typeof window !== 'undefined' ? '/api/etherscan' : 'https://api.etherscan.io/v2/api';
const CHAIN_ID = 1; // Ethereum mainnet

export async function getTokenTransfers(address: string): Promise<EtherscanTokenTransfer[]> {
  try {
    // V2 API format: chainid=1&module=account&action=tokentx
    const url = `${ETHERSCAN_PROXY_URL}?chainid=${CHAIN_ID}&module=account&action=tokentx&address=${address}&startblock=0&endblock=99999999&sort=asc`;
    
    console.log(`🔍 [Etherscan V2] Fetching token transfers for ${address}`);
    const response = await fetch(url);
    const data: EtherscanResponse<EtherscanTokenTransfer[]> = await response.json();
    
    if (data.status === '1' && Array.isArray(data.result)) {
      console.log(`✅ [Etherscan V2] Found ${data.result.length} token transfers`);
      return data.result;
    } else {
      console.warn('⚠️ [Etherscan V2] API response:', data.message, data.result);
      return [];
    }
  } catch (error) {
    console.error('❌ [Etherscan V2] Error fetching token transfers:', error);
    return [];
  }
}

export async function getTokenBalance(
  tokenAddress: string,
  walletAddress: string
): Promise<string> {
  try {
    // V2 API format according to docs:
    // https://api.etherscan.io/v2/api?chainid=1&module=account&action=tokenbalance&contractaddress={token}&address={wallet}&tag=latest&apikey={key}
    const url = `${ETHERSCAN_PROXY_URL}?chainid=${CHAIN_ID}&module=account&action=tokenbalance&contractaddress=${tokenAddress}&address=${walletAddress}&tag=latest`;
    
    console.log(`  🔍 [Etherscan V2] Fetching balance for token ${tokenAddress}`);
    const response = await fetch(url);
    const data: EtherscanResponse<string> = await response.json();
    
    if (data.status === '1' && data.result !== undefined) {
      const balance = data.result;
      // Balance is returned as a string in the token's smallest decimal representation
      console.log(`  ✅ [Etherscan V2] Balance fetched: ${balance} (raw value)`);
      return balance;
    } else {
      console.warn(`  ⚠️ [Etherscan V2] Balance fetch failed for ${tokenAddress}: ${data.message || 'Unknown error'}`, data);
      return '0';
    }
  } catch (error) {
    console.error(`❌ [Etherscan V2] Error fetching balance for ${tokenAddress}:`, error);
    return '0';
  }
}

export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
}

export async function getUniqueTokensFromTransfers(
  transfers: EtherscanTokenTransfer[],
  walletAddress: string
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
    
    const balance = await getTokenBalance(address, walletAddress);
    
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
      });
      
      console.log(`  ✅ ${tokenSymbol} (${tokenName}): ${balanceNum.toFixed(4)} - INCLUDED`);
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

