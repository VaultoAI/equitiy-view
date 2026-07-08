/**
 * Ondo Global Markets tokenized-equity address lookup.
 *
 * The address list is generated from the official Ondo "Tokenized Stocks List"
 * (see `ondoEquityAddresses.ts`, regenerated via `npm run update:ondo-tokens`).
 * This module exposes a synchronous, client-safe membership check used for
 * display logic (e.g. marking a pool token as a tokenized stock).
 */
import { ONDO_EQUITY_ADDRESSES } from './ondoEquityAddresses';

// Lowercased address set for O(1) case-insensitive lookups.
const TOKENIZED_STOCK_ADDRESSES = new Set<string>(ONDO_EQUITY_ADDRESSES);

/**
 * Checks if a given token address is an Ondo tokenized stock/ETF.
 * @param address - The token address to check (case-insensitive)
 * @returns true if the address is a known Ondo tokenized equity, false otherwise
 */
export function isTokenizedStock(address: string): boolean {
  if (!address) return false;
  return TOKENIZED_STOCK_ADDRESSES.has(address.toLowerCase());
}
