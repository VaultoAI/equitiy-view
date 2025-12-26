# Vaulto Earn - Uniswap Liquidity Provider

A complete implementation of Uniswap's liquidity providing feature, allowing users to connect their wallet, discover pools for their tokens, view pool details, and add liquidity to earn fees.

## Features

- **Wallet Connection**: Connect wallet using RainbowKit
- **Token Balance Fetching**: Automatically fetch and display token balances from connected wallet
- **Pool Discovery**: Show all pools corresponding to tokens in user's wallet
- **Pool List Display**: Sortable table showing TVL, APR, volume, and other metrics
- **Pool Details**: Comprehensive pool information page
- **Add Liquidity**: Multi-step flow to create positions and add liquidity
- **Transaction Execution**: Handle token approvals and position creation

## Tech Stack

- **Next.js 14** - React framework
- **TypeScript** - Type safety
- **RainbowKit + Wagmi** - Wallet connection
- **Uniswap SDK** - Pool and position management
- **Apollo Client** - GraphQL client for Uniswap API
- **TanStack Query** - Data fetching and caching
- **Tailwind CSS** - Styling

## Setup

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
Create a `.env.local` file:
```
# The Graph API Key (required for Uniswap V3 subgraph)
# Get your API key from: https://thegraph.com/studio/apikeys/
NEXT_PUBLIC_THE_GRAPH_API_KEY=your_graph_api_key_here

# Optional: Custom GraphQL endpoint (if not using The Graph Gateway)
# NEXT_PUBLIC_UNISWAP_GRAPHQL_URL=https://your-custom-endpoint.com

NEXT_PUBLIC_CHAIN_ID=1
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id
NEXT_PUBLIC_ETHERSCAN_API_KEY=your_etherscan_api_key
```

**Important**: The old Uniswap V3 subgraph endpoint has been removed. You **must** get a free API key from [The Graph Studio](https://thegraph.com/studio/apikeys/) to query the Uniswap V3 subgraph.

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
├── app/                    # Next.js app directory
│   ├── pools/             # Pool listing and details pages
│   ├── positions/          # Position creation pages
│   └── layout.tsx         # Root layout with providers
├── components/             # React components
│   ├── Pools/             # Pool-related components
│   └── Liquidity/         # Liquidity position components
├── hooks/                  # Custom React hooks
│   ├── useTokenBalances.ts
│   ├── useWalletPools.ts
│   └── usePoolData.ts
├── lib/                    # Utility libraries
│   ├── graphql/           # GraphQL client and queries
│   ├── pools/             # Pool utilities (APR, sorting)
│   ├── uniswap/           # Uniswap SDK utilities
│   └── transactions/      # Transaction building
└── contexts/              # React contexts
    └── CreateLiquidityContext.tsx
```

## Usage

1. **Connect Wallet**: Click the "Connect Wallet" button and select your wallet
2. **View Pools**: Navigate to `/pools` to see all pools for tokens in your wallet
3. **Pool Details**: Click on any pool to view detailed information
4. **Add Liquidity**: Click "Add Liquidity" on a pool details page to create a position
5. **Create Position**: Select tokens, enter amounts, and confirm the transaction

## Routes

- `/` - Home page
- `/pools` - Pool listing page (shows pools for wallet tokens)
- `/pools/[chain]/[poolAddress]` - Pool details page
- `/positions/create` - Create position page (with query params for pre-filling)

## Notes

- The implementation uses Uniswap's public GraphQL API for fetching pool data
- Token approvals are handled automatically before position creation
- The transaction execution uses Uniswap V3 SDK for building calldata
- Pool discovery is filtered by tokens in the connected wallet

## Development

The project follows the exact implementation patterns from Uniswap's interface as documented in `UNISWAP_LIQUIDITY_IMPLEMENTATION_GUIDE.md`.

## License

MIT

