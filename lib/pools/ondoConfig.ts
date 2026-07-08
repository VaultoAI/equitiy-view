/**
 * Shared configuration for the Ondo Global Markets token universe.
 *
 * The canonical, self-updating source of truth is the official Ondo
 * "Tokenized Stocks List" (uniswap/token-lists format), published at:
 *   https://github.com/ondoprotocol/ondo-global-markets-token-list
 *
 * This module is intentionally dependency-free so it can be imported by both
 * runtime code and the `scripts/update-ondo-token-list.ts` generator.
 */

/** Raw shape of a token entry in the Ondo token list JSON. */
export interface OndoListToken {
  chainId: number;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
  tags?: string[];
}

export interface OndoTokenList {
  name?: string;
  version?: { major: number; minor: number; patch: number };
  timestamp?: string;
  tokens: OndoListToken[];
}

/** Raw GitHub URL for the latest official Ondo Global Markets token list. */
export const ONDO_TOKEN_LIST_URL =
  'https://raw.githubusercontent.com/ondoprotocol/ondo-global-markets-token-list/main/tokenlist.json';

/**
 * Ethereum mainnet chain id — the only chain with a Uniswap subgraph wired up
 * in this project. The Ondo list also ships BNB Chain (56) addresses.
 */
export const ETHEREUM_CHAIN_ID = 1;

/**
 * Ondo tokens that are NOT public equities/ETFs and must be excluded from the
 * "Public Equities" list. These are cash / yield instruments, not tokenized
 * stocks. Addresses are lowercased for case-insensitive matching.
 */
export const ONDO_NON_EQUITY_ADDRESSES = new Set<string>([
  // Ethereum (chainId 1)
  '0xace8e719899f6e91831b18ae746c9a965c2119f1', // USDon - Ondo U.S. Dollar Token
  '0x96f6ef951840721adbf46ac996b59e0235cb985c', // USDY  - Ondo U.S. Dollar Yield
  // BNB Chain (chainId 56)
  '0x1f8955e640cbd9abc3c3bb408c9e2e1f5f20dfe6', // USDon - Ondo U.S. Dollar Token
  '0x608593d17a2decbbc4399e4185be4922f97ed32e', // USDY  - Ondo U.S. Dollar Yield
]);

/**
 * Extracts the set of Ondo tokenized-equity addresses for a given chain from a
 * parsed token list, excluding non-equity (cash/yield) tokens.
 * @returns lowercased, de-duplicated, sorted addresses
 */
export function parseOndoEquityAddresses(
  list: OndoTokenList | null | undefined,
  chainId: number
): string[] {
  const tokens = list?.tokens ?? [];
  const seen = new Set<string>();
  for (const token of tokens) {
    if (!token || token.chainId !== chainId || !token.address) continue;
    const address = String(token.address).toLowerCase();
    if (ONDO_NON_EQUITY_ADDRESSES.has(address)) continue;
    seen.add(address);
  }
  return Array.from(seen).sort();
}
