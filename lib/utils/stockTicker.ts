/**
 * Utility functions for extracting stock tickers from tokenized stock symbols
 */

/**
 * Extracts stock ticker from tokenized stock symbol
 * Examples:
 * - "AAPLon" -> "AAPL"
 * - "TSLAon" -> "TSLA"
 * - "NVDAon" -> "NVDA"
 * - "SPYon" -> "SPY"
 * 
 * @param symbol - Token symbol (e.g., "AAPLon", "TSLAon")
 * @returns Stock ticker (e.g., "AAPL", "TSLA") or null if not a tokenized stock symbol
 */
export function extractStockTicker(symbol: string): string | null {
  if (!symbol || typeof symbol !== 'string') {
    return null;
  }

  // Most tokenized stocks end with "on" suffix
  // Remove the "on" suffix to get the stock ticker
  if (symbol.endsWith('on')) {
    return symbol.slice(0, -2).toUpperCase();
  }

  // Handle special cases or symbols without "on" suffix
  // For now, return null if no "on" suffix found
  return null;
}

/**
 * Maps token address to stock ticker for known tokenized stocks
 * This is a fallback for cases where symbol extraction might not work
 */
const TOKEN_ADDRESS_TO_TICKER: Record<string, string> = {
  '0x14c3abf95cb9c93a8b82c1cdcb76d72cb87b2d4c': 'AAPL', // AAPLon
  '0xf6b1117ec07684d3958cad8beb1b302bfd21103f': 'TSLA', // TSLAon
  '0x2d1f7226bd1f780af6b9a49dcc0ae00e8df4bdee': 'NVDA', // NVDAon
  '0xba47214edd2bb43099611b208f75e4b42fdcfedc': 'GOOGL', // GOOGLon
  '0xb812837b81a3a6b81d7cd74cfb19a7f2784555e5': 'MSFT', // MSFTon
  '0xfedc5f4a6c38211c1338aa411018dfaf26612c08': 'SPY', // SPYon
  '0x0e397938c1aa0680954093495b70a9f5e2249aba': 'QQQ', // QQQon
  '0x41765f0fcddc276309195166c7a62ae522fa09ef': 'BABA', // BABAon
  '0x992651bfeb9a0dcc4457610e284ba66d86489d4d': 'TLT', // TLTon
  '0xf042cfa86cf1d598a75bdb55c3507a1f39f9493b': 'COIN', // COINon
  '0x998f02a9e343ef6e3e6f28700d5a20f839fd74e6': 'HOOD', // HOODon
  '0xcabd955322dfbf94c084929ac5e9eca3feb5556f': 'MSTR', // MSTRon
  '0xd8e26fcc879b30cb0a0b543925a2b3500f074d81': 'NKE', // NKEon
  '0xbc843b147db4c7e00721d76037b8b92e13afe13f': 'SPGI', // SPGIon
};

/**
 * Gets stock ticker from token address (fallback method)
 * @param address - Token address
 * @returns Stock ticker or null
 */
export function getTickerFromAddress(address: string): string | null {
  if (!address) return null;
  return TOKEN_ADDRESS_TO_TICKER[address.toLowerCase()] || null;
}

/**
 * Gets stock ticker from token symbol or address
 * Tries symbol extraction first, then falls back to address mapping
 * @param symbol - Token symbol
 * @param address - Token address (optional)
 * @returns Stock ticker or null
 */
export function getStockTicker(symbol: string, address?: string): string | null {
  // Try extracting from symbol first
  const tickerFromSymbol = extractStockTicker(symbol);
  if (tickerFromSymbol) {
    return tickerFromSymbol;
  }

  // Fallback to address mapping if address provided
  if (address) {
    return getTickerFromAddress(address);
  }

  return null;
}
