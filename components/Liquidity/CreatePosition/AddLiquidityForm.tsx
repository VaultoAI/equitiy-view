'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useCreateLiquidity } from '@/contexts/CreateLiquidityContext';
import { DepositAmounts } from '@/components/Liquidity/CreatePosition/DepositAmounts';
import { PositionPreview } from '@/components/Liquidity/CreatePosition/PositionPreview';
import { useLiquidityTransaction } from '@/hooks/useLiquidityTransaction';
import { useTokenPrices } from '@/hooks/useTokenPrices';
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

  // Track initialized token addresses to prevent unnecessary re-initialization
  const initializedRef = useRef<{ token0Address?: string; token1Address?: string; feeTier?: number }>({});

  // Fetch token prices for USD calculation
  const tokenAddresses = useMemo(() => {
    const addresses: string[] = [];
    if (state.tokenA) addresses.push(state.tokenA.address);
    if (state.tokenB) addresses.push(state.tokenB.address);
    return addresses;
  }, [state.tokenA, state.tokenB]);

  const { prices } = useTokenPrices({
    tokenAddresses,
    enabled: !!state.tokenA && !!state.tokenB,
  });

  // Initialize tokens and fee tier when component mounts or props change
  // Compare addresses instead of object references to avoid infinite loops
  useEffect(() => {
    const token0Address = token0?.address;
    const token1Address = token1?.address;
    const needsUpdate =
      initializedRef.current.token0Address !== token0Address ||
      initializedRef.current.token1Address !== token1Address ||
      (feeTier !== undefined && initializedRef.current.feeTier !== feeTier);

    if (needsUpdate) {
      if (token0Address && token0Address !== initializedRef.current.token0Address) {
        setTokenA(token0);
        initializedRef.current.token0Address = token0Address;
      }
      if (token1Address && token1Address !== initializedRef.current.token1Address) {
        setTokenB(token1);
        initializedRef.current.token1Address = token1Address;
      }
      if (feeTier !== undefined && feeTier !== initializedRef.current.feeTier) {
        setFeeTierInContext(feeTier);
        initializedRef.current.feeTier = feeTier;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token0?.address, token1?.address, feeTier, setTokenA, setTokenB, setFeeTierInContext]);

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

  // Calculate estimated USD value using actual token prices
  const estimatedUSD = useMemo(() => {
    if (!state.tokenA || !state.tokenB || !state.amountA || !state.amountB) {
      return undefined;
    }

    const priceA = prices.get(state.tokenA.address.toLowerCase());
    const priceB = prices.get(state.tokenB.address.toLowerCase());

    if (!priceA || !priceB) {
      return undefined;
    }

    const amountA = parseFloat(state.amountA) || 0;
    const amountB = parseFloat(state.amountB) || 0;

    return amountA * priceA + amountB * priceB;
  }, [state.tokenA, state.tokenB, state.amountA, state.amountB, prices]);

  return (
    <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-lg mt-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">Add Liquidity</h2>
        <button
          onClick={handleCreate}
          disabled={
            !state.tokenA ||
            !state.tokenB ||
            !state.amountA ||
            !state.amountB ||
            isPending
          }
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors"
        >
          {isPending ? 'Creating Position...' : 'Create Position'}
        </button>
      </div>
      <DepositAmounts
        tokenA={state.tokenA || token0}
        tokenB={state.tokenB || token1}
        amountA={state.amountA}
        amountB={state.amountB}
        onAmountAChange={setAmountA}
        onAmountBChange={setAmountB}
      />
      <div className="mt-6">
        <PositionPreview
          tokenA={state.tokenA}
          tokenB={state.tokenB}
          amountA={state.amountA}
          amountB={state.amountB}
          feeTier={state.feeTier}
          estimatedUSD={estimatedUSD}
        />
      </div>
    </div>
  );
}


