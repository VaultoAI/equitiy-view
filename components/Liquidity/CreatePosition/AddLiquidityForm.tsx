'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCreateLiquidity } from '@/contexts/CreateLiquidityContext';
import { FixedTokenDisplay } from '@/components/Liquidity/CreatePosition/FixedTokenDisplay';
import { DepositAmounts } from '@/components/Liquidity/CreatePosition/DepositAmounts';
import { PositionPreview } from '@/components/Liquidity/CreatePosition/PositionPreview';
import { useLiquidityTransaction } from '@/hooks/useLiquidityTransaction';
import { Token } from '@/lib/pools/types';

interface AddLiquidityFormProps {
  token0: Token;
  token1: Token;
  feeTier?: number;
}

export function AddLiquidityForm({ token0, token1, feeTier }: AddLiquidityFormProps) {
  const router = useRouter();
  const {
    state,
    setTokenA,
    setTokenB,
    setAmountA,
    setAmountB,
    setFeeTier: setFeeTierInContext,
  } = useCreateLiquidity();

  const { executeTransaction, isPending } = useLiquidityTransaction();

  // Initialize tokens and fee tier when component mounts or props change
  useEffect(() => {
    setTokenA(token0);
    setTokenB(token1);
    if (feeTier) {
      setFeeTierInContext(feeTier);
    }
  }, [token0, token1, feeTier, setTokenA, setTokenB, setFeeTierInContext]);

  const handleCreate = async () => {
    if (!state.tokenA || !state.tokenB || !state.amountA || !state.amountB) {
      return;
    }

    try {
      await executeTransaction({
        tokenA: state.tokenA,
        tokenB: state.tokenB,
        amountA: state.amountA,
        amountB: state.amountB,
        feeTier: state.feeTier,
      });
      router.push('/pools');
    } catch (error) {
      console.error('Transaction failed:', error);
    }
  };

  const estimatedUSD = state.tokenA && state.tokenB && state.amountA && state.amountB
    ? parseFloat(state.amountA) * 1000 + parseFloat(state.amountB) * 1000 // Simplified calculation
    : undefined;

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg mt-8">
      <h2 className="text-2xl font-bold mb-6">Add Liquidity</h2>
      <FixedTokenDisplay label="Token A" token={token0} />
      <FixedTokenDisplay label="Token B" token={token1} />
      <DepositAmounts
        tokenA={state.tokenA}
        tokenB={state.tokenB}
        amountA={state.amountA}
        amountB={state.amountB}
        onAmountAChange={setAmountA}
        onAmountBChange={setAmountB}
      />
      <PositionPreview
        tokenA={state.tokenA}
        tokenB={state.tokenB}
        amountA={state.amountA}
        amountB={state.amountB}
        feeTier={state.feeTier}
        estimatedUSD={estimatedUSD}
      />
      <button
        onClick={handleCreate}
        disabled={
          !state.tokenA ||
          !state.tokenB ||
          !state.amountA ||
          !state.amountB ||
          isPending
        }
        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors"
      >
        {isPending ? 'Creating Position...' : 'Create Position'}
      </button>
    </div>
  );
}

