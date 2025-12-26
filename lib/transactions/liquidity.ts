import { Token, CurrencyAmount, Percent } from '@uniswap/sdk-core';
import { Pool, Position, MintOptions } from '@uniswap/v3-sdk';
import { Token as PoolToken } from '@/lib/pools/types';
import { createPoolToken, getFeeAmount, calculateTicks } from '@/lib/uniswap/poolFactory';

export interface LiquidityTransactionParams {
  tokenA: PoolToken;
  tokenB: PoolToken;
  amountA: string;
  amountB: string;
  feeTier?: number;
  priceRange?: {
    lower: number;
    upper: number;
  };
}

export interface TransactionCalldata {
  to: string;
  data: string;
  value?: bigint;
}

const NONFUNGIBLE_POSITION_MANAGER_ADDRESS = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88';

export async function buildLiquidityTransaction(
  params: LiquidityTransactionParams,
  chainId: number,
  account: string
): Promise<TransactionCalldata> {
  const { tokenA, tokenB, amountA, amountB, feeTier } = params;

  // Create SDK tokens
  const sdkTokenA = createPoolToken(tokenA, chainId);
  const sdkTokenB = createPoolToken(tokenB, chainId);

  // Determine token order (token0 < token1)
  const [token0, token1] = sdkTokenA.sortsBefore(sdkTokenB)
    ? [sdkTokenA, sdkTokenB]
    : [sdkTokenB, sdkTokenA];

  const [amount0, amount1] = sdkTokenA.sortsBefore(sdkTokenB)
    ? [amountA, amountB]
    : [amountB, amountA];

  // Create currency amounts
  const currencyAmount0 = CurrencyAmount.fromRawAmount(
    token0,
    BigInt(Math.floor(parseFloat(amount0) * 10 ** token0.decimals)).toString()
  );
  const currencyAmount1 = CurrencyAmount.fromRawAmount(
    token1,
    BigInt(Math.floor(parseFloat(amount1) * 10 ** token1.decimals)).toString()
  );

  const feeAmount = getFeeAmount(feeTier);
  const { tickLower, tickUpper } = calculateTicks(1); // Simplified - use current price in production

  // Create position
  const position = Position.fromAmounts({
    pool: {} as Pool, // In production, fetch or create the pool
    tickLower,
    tickUpper,
    amount0: currencyAmount0.quotient,
    amount1: currencyAmount1.quotient,
    useFullPrecision: true,
  });

  // Build mint calldata
  const mintOptions: MintOptions = {
    recipient: account,
    deadline: Math.floor(Date.now() / 1000) + 60 * 20, // 20 minutes
    slippageTolerance: new Percent(50, 10_000), // 0.5%
  };

  // In production, you would use the actual NonfungiblePositionManager contract
  // For now, return a placeholder structure
  return {
    to: NONFUNGIBLE_POSITION_MANAGER_ADDRESS,
    data: '0x', // Placeholder - would contain actual calldata
    value: undefined,
  };
}

