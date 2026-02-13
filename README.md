# Equity View (Vaulto Earn)

Uniswap liquidity provider interface for discovering pools, viewing pool details, and adding liquidity to earn fees. Part of VaultoAI's DeFi product suite.

## Overview

This application implements Uniswap's liquidity providing flow end to end. Users connect a wallet, discover pools for their tokens, view pool metrics and details, and add liquidity through a multi-step flow. It supports Ethereum and Solana and integrates with tokenized stock pools, cache APIs, and external data sources. It is maintained by VaultoAI for internal and user-facing DeFi features.

## Features

- **Wallet connection** — Connect wallet via RainbowKit; token balances fetched from connected wallet
- **Pool discovery** — List pools corresponding to tokens in the user's wallet
- **Pool list** — Sortable table with TVL, APR, volume, and other metrics
- **Pool details** — Detailed pool information and charts per pool
- **Add liquidity** — Multi-step flow to create positions and add liquidity
- **Transaction execution** — Token approvals and position creation via Uniswap SDK

## Technology Stack

- **Languages:** TypeScript, HTML/CSS
- **Frameworks / libraries:** Next.js 14, React, RainbowKit, Wagmi, Uniswap SDK (v3), Apollo Client, TanStack Query, Tailwind CSS, Viem, Recharts

## Getting Started

### Prerequisites

- Node.js and npm (or equivalent)
- The Graph API key for Uniswap V3 subgraph (free at [The Graph Studio](https://thegraph.com/studio/apikeys/))
- WalletConnect project ID and Etherscan API key (optional, for full functionality)

### Installation

```bash
npm install
```

### Running

1. Create `.env.local` with at least:
   - `NEXT_PUBLIC_THE_GRAPH_API_KEY` (required for Uniswap V3)
   - `NEXT_PUBLIC_CHAIN_ID=1`
   - `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`
   - `NEXT_PUBLIC_ETHERSCAN_API_KEY` (optional)
2. Run the development server:

```bash
npm run dev
```

3. Open http://localhost:3000 in a browser.

## Configuration

See `.env.local` (or project docs). Key variables: `NEXT_PUBLIC_THE_GRAPH_API_KEY`, `NEXT_PUBLIC_CHAIN_ID`, `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`, `NEXT_PUBLIC_ETHERSCAN_API_KEY`. Optional: `NEXT_PUBLIC_UNISWAP_GRAPHQL_URL` for a custom GraphQL endpoint.

## Project Structure

- `app/` — Next.js app (pools, positions, wallet, API routes for cache, stock price, GraphQL, Etherscan, Meteora, etc.)
- `components/`, `contexts/`, `hooks/`, `lib/` — UI components, CreateLiquidity context, token/pool hooks, GraphQL and Uniswap utilities

## Contributing

See CONTRIBUTING.md for guidelines, or contact VaultoAI engineering.

## License

MIT

## Contact

VaultoAI Engineering. For support or questions, see the repository or organization documentation.
