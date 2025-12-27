'use client';

import { useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CreateLiquidityProvider, useCreateLiquidity } from '@/contexts/CreateLiquidityContext';
import { TokenSelector } from '@/components/Liquidity/CreatePosition/TokenSelector';
import { DepositAmounts } from '@/components/Liquidity/CreatePosition/DepositAmounts';
import { PositionPreview } from '@/components/Liquidity/CreatePosition/PositionPreview';
import { WalletConnect } from '@/components/WalletConnect';
import { useAccount } from 'wagmi';
import { useTokenBalances } from '@/hooks/useTokenBalances';
import { Token } from '@/lib/pools/types';
import { useLiquidityTransaction } from '@/hooks/useLiquidityTransaction';

function CreatePositionContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isConnected } = useAccount();
  const { balanceList } = useTokenBalances();
  const {
    state,
    setTokenA,
    setTokenB,
    setAmountA,
    setAmountB,
    setFeeTier,
  } = useCreateLiquidity();

  const { executeTransaction, isPending } = useLiquidityTransaction();

  // Initialize from URL params
  useEffect(() => {
    const currencyA = searchParams.get('currencyA');
    const currencyB = searchParams.get('currencyB');
    const feeTierParam = searchParams.get('feeTier');

    if (currencyA && balanceList.length > 0) {
      const tokenA = balanceList
        .map((b) => b.currencyInfo.currency)
        .find((t) => t.address.toLowerCase() === currencyA.toLowerCase());
      if (tokenA) setTokenA(tokenA);
    }

    if (currencyB && balanceList.length > 0) {
      const tokenB = balanceList
        .map((b) => b.currencyInfo.currency)
        .find((t) => t.address.toLowerCase() === currencyB.toLowerCase());
      if (tokenB) setTokenB(tokenB);
    }

    if (feeTierParam) {
      setFeeTier(parseInt(feeTierParam));
    }
  }, [searchParams, balanceList, setTokenA, setTokenB, setFeeTier]);

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
    <div className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Create Position</h1>
          <WalletConnect />
        </div>

        {!isConnected ? (
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Connect your wallet to create a position
            </p>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg">
            <TokenSelector
              label="Token A"
              selectedToken={state.tokenA}
              onSelect={setTokenA}
              excludeToken={state.tokenB}
            />
            <TokenSelector
              label="Token B"
              selectedToken={state.tokenB}
              onSelect={setTokenB}
              excludeToken={state.tokenA}
            />
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
        )}
      </div>
    </div>
  );
}

export default function CreatePositionPage() {
  return (
    <CreateLiquidityProvider>
      <Suspense fallback={
        <div className="min-h-screen p-8">
          <div className="max-w-2xl mx-auto">
            <div className="flex justify-between items-center mb-8">
              <div className="animate-pulse">
                <div className="h-9 bg-gray-300 dark:bg-gray-700 rounded w-48"></div>
              </div>
              <div className="animate-pulse">
                <div className="h-10 bg-gray-300 dark:bg-gray-700 rounded w-32"></div>
              </div>
            </div>
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-lg space-y-6">
              <div className="animate-pulse">
                <div className="h-5 bg-gray-300 dark:bg-gray-700 rounded w-20 mb-4"></div>
                <div className="h-12 bg-gray-300 dark:bg-gray-700 rounded"></div>
              </div>
              <div className="animate-pulse">
                <div className="h-5 bg-gray-300 dark:bg-gray-700 rounded w-20 mb-4"></div>
                <div className="h-12 bg-gray-300 dark:bg-gray-700 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      }>
        <CreatePositionContent />
      </Suspense>
    </CreateLiquidityProvider>
  );
}

