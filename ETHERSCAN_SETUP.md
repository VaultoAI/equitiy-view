# Etherscan V2 API Setup

## Overview
The application uses Etherscan V2 API to fetch token balances from wallet addresses. V2 provides a unified API across 50+ EVM chains with a single API key.

## Setup

1. **Get Etherscan API Key** (Free):
   - Go to https://etherscan.io/apis
   - Sign up for a free account
   - Generate an API key
   - Free tier allows 5 calls/second
   - **V2 API uses a single key for all chains!**

2. **Add API Key to Environment Variables**:
   Add to your `.env.local` file:
   ```
   NEXT_PUBLIC_ETHERSCAN_API_KEY=your_api_key_here
   ```

## V2 API Changes

### Base URL
- **V1**: `https://api.etherscan.io/api`
- **V2**: `https://api.etherscan.io/v2/api?chainid=1`

### Key Differences
- Add `/v2` to the base URL
- Add `chainid=1` parameter for Ethereum mainnet
- Single API key works across all supported chains
- Same module/action structure as V1

## How It Works

1. **Token Transfer History**: Fetches all ERC20 token transfers using `tokentx` action
2. **Unique Token Extraction**: Identifies all unique tokens the wallet has interacted with
3. **Balance Fetching**: For each unique token, fetches current balance using `tokenbalance` action
4. **Filtering**: Only includes tokens with non-zero balances

## API Endpoints Used (V2 Format)

### Get Token Transfers
```
GET /v2/api?chainid=1&module=account&action=tokentx&address={address}&startblock=0&endblock=99999999&sort=asc&apikey={key}
```

### Get Token Balance
```
GET /v2/api?chainid=1&module=account&action=tokenbalance&contractaddress={tokenAddress}&address={walletAddress}&tag=latest&apikey={key}
```

## Rate Limits

- Free tier: 5 calls/second
- The implementation fetches balances sequentially to avoid rate limit issues
- Results are cached for 1 minute to reduce API calls

## Notes

- The API proxy route (`/api/etherscan`) handles CORS and API key management
- Token balances are fetched one at a time (sequential) to respect rate limits
- Only tokens with non-zero balances are included in the results
- V2 API supports 50+ chains with the same API key (currently configured for Ethereum mainnet, chainid=1)

