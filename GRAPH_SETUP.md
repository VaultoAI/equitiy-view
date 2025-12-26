# The Graph API Setup

## Overview

The Uniswap V3 subgraph has migrated to The Graph's decentralized network. The old hosted endpoint (`https://api.thegraph.com/subgraphs/name/uniswap/uniswap-v3`) has been removed and is no longer available.

## Getting Your API Key

1. **Visit The Graph Studio**: Go to [https://thegraph.com/studio/apikeys/](https://thegraph.com/studio/apikeys/)

2. **Sign up or Log in**: Create an account or sign in with your existing account

3. **Create an API Key**: 
   - Click "Create API Key"
   - Give it a name (e.g., "Vaulto Earn")
   - Copy the API key

4. **Add to Environment Variables**:
   ```bash
   NEXT_PUBLIC_THE_GRAPH_API_KEY=your_api_key_here
   ```

## Subgraph Information

- **Subgraph ID**: `5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV`
- **Network**: Ethereum Mainnet
- **Endpoint Format**: `https://gateway.thegraph.com/api/{API_KEY}/subgraphs/id/{SUBGRAPH_ID}`

## Free Tier

The Graph offers a free tier with generous rate limits for development and small-scale applications. The free tier should be sufficient for most use cases.

## Troubleshooting

If you see the error: "This endpoint has been removed"
- Make sure you've added `NEXT_PUBLIC_THE_GRAPH_API_KEY` to your `.env.local` file
- Verify the API key is correct
- Restart your development server after adding the environment variable

## Alternative Options

If you prefer not to use The Graph API, you can:
1. Deploy your own subgraph indexer
2. Use a different data provider
3. Query the blockchain directly (slower, more complex)

## Resources

- [The Graph Studio](https://thegraph.com/studio/)
- [The Graph Documentation](https://thegraph.com/docs/)
- [Uniswap Subgraph Documentation](https://docs.uniswap.org/api/subgraph/overview)


