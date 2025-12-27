/**
 * Solana token logo mapping
 * Maps token mint addresses to local logo file paths
 */

// Token mint address to logo path mapping
const SOLANA_TOKEN_LOGOS: Record<string, string> = {
  // Tracked tokens
  'PresTj4Yc2bAR197Er7wz4UUKSfqt6FryBEdAriBoQB': '/solana/anduril.webp',
  'PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF': '/solana/openai.webp',
  'PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh': '/solana/spacex.webp',
  'PreC1KtJ1sBPPqaeeqL6Qb15GTLCYVvyYEwxhdfTwfx': '/solana/xai.webp',
  'Pren1FvFX6J3E4kXhJuCiAD5aDmGEb7qJRncwA8Lkhw': '/solana/anthropic.webp',
  // Common tokens used in pairs
  'So11111111111111111111111111111111111111112': '/solana/solana-sol-logo-png_seeklogo-423095.png', // SOL
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': '/solana/USD_Coin_logo.png', // USDC
};

// Token mint address to name mapping
const SOLANA_TOKEN_NAMES: Record<string, string> = {
  'PresTj4Yc2bAR197Er7wz4UUKSfqt6FryBEdAriBoQB': 'ANDURIL',
  'PreweJYECqtQwBtpxHL171nL2K6umo692gTm7Q3rpgF': 'OPENAI',
  'PreANxuXjsy2pvisWWMNB6YaJNzr7681wJJr2rHsfTh': 'SPACEX',
  'PreC1KtJ1sBPPqaeeqL6Qb15GTLCYVvyYEwxhdfTwfx': 'xAI',
  'Pren1FvFX6J3E4kXhJuCiAD5aDmGEb7qJRncwA8Lkhw': 'ANTHROPIC',
};

/**
 * Gets the logo URL for a Solana token mint address
 * @param tokenMint - Solana token mint address
 * @returns Logo URL path if found, null otherwise
 */
export function getSolanaTokenLogoUrl(tokenMint: string): string | null {
  if (!tokenMint) {
    return null;
  }

  // Normalize the address (case-insensitive lookup)
  const normalizedMint = tokenMint.trim();
  
  return SOLANA_TOKEN_LOGOS[normalizedMint] || null;
}

/**
 * Gets the token name for a Solana token mint address
 * @param tokenMint - Solana token mint address
 * @returns Token name if found, null otherwise
 */
export function getSolanaTokenName(tokenMint: string): string | null {
  if (!tokenMint) {
    return null;
  }

  const normalizedMint = tokenMint.trim();
  
  return SOLANA_TOKEN_NAMES[normalizedMint] || null;
}

/**
 * Checks if a token mint address is one of the tracked Solana prestock tokens
 * (excludes common tokens like SOL, USDC, USDT)
 * @param tokenMint - Solana token mint address
 * @returns true if the token is a tracked prestock token, false otherwise
 */
export function isTrackedSolanaToken(tokenMint: string): boolean {
  if (!tokenMint) {
    return false;
  }

  const normalizedMint = tokenMint.trim();
  // Check against SOLANA_TOKEN_NAMES which only contains prestock tokens
  return normalizedMint in SOLANA_TOKEN_NAMES;
}

/**
 * Gets all tracked Solana prestock token mint addresses (excludes common tokens)
 * @returns Array of token mint addresses for prestock tokens
 */
export function getTrackedSolanaTokenMints(): string[] {
  return Object.keys(SOLANA_TOKEN_NAMES);
}

