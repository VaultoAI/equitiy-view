'use client';

import { useState } from 'react';
import { useAccount, useWriteContract } from 'wagmi';
import { parseUnits } from 'viem';
import { PoolToken } from '@/lib/pools/types';
import { buildLiquidityTransaction } from '@/lib/transactions/liquidity';

interface UseLiquidityTransactionParams {
  tokenA: PoolToken;
  tokenB: PoolToken;
  amountA: string;
  amountB: string;
  feeTier?: number;
}

const ERC20_ABI = [
  {
    constant: false,
    inputs: [
      { name: '_spender', type: 'address' },
      { name: '_value', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [
      { name: '_owner', type: 'address' },
      { name: '_spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    type: 'function',
  },
] as const;

const NONFUNGIBLE_POSITION_MANAGER_ADDRESS = '0xC36442b4a4522E871399CD717aBDD847Ab11FE88' as const;

export function useLiquidityTransaction() {
  const { address, chainId } = useAccount();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const { writeContract } = useWriteContract();

  const executeTransaction = async (params: UseLiquidityTransactionParams) => {
    if (!address || !chainId) {
      throw new Error('Wallet not connected');
    }

    setIsPending(true);
    setError(null);

    try {
      // Step 1: Check and approve tokens if needed
      const tokenAAddress = params.tokenA.address as `0x${string}`;
      const tokenBAddress = params.tokenB.address as `0x${string}`;

      // Approve token A
      // Note: In wagmi v2, writeContract can be called directly
      // The actual implementation would await the transaction hash
      writeContract({
        address: tokenAAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [
          NONFUNGIBLE_POSITION_MANAGER_ADDRESS,
          parseUnits(params.amountA, params.tokenA.decimals),
        ],
      });

      // Approve token B
      writeContract({
        address: tokenBAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [
          NONFUNGIBLE_POSITION_MANAGER_ADDRESS,
          parseUnits(params.amountB, params.tokenB.decimals),
        ],
      });

      // Step 2: Build and execute position creation transaction
      const txData = await buildLiquidityTransaction(params, chainId, address);

      // In a real implementation, you would call the actual mint function
      // For now, this is a placeholder that shows the structure
      console.log('Transaction data:', txData);

      // Note: Actual position creation would require:
      // 1. Fetching or creating the pool
      // 2. Building the exact calldata using NonfungiblePositionManager
      // 3. Executing the transaction using writeContract with the calldata

      setIsPending(false);
    } catch (err) {
      setError(err as Error);
      setIsPending(false);
      throw err;
    }
  };

  return {
    executeTransaction,
    isPending,
    error,
  };
}

