'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { Token } from '@/lib/pools/types';

interface CreateLiquidityState {
  tokenA: Token | null;
  tokenB: Token | null;
  amountA: string;
  amountB: string;
  feeTier?: number;
  priceRange?: {
    lower: number;
    upper: number;
  };
}

interface CreateLiquidityContextType {
  state: CreateLiquidityState;
  setTokenA: (token: Token | null) => void;
  setTokenB: (token: Token | null) => void;
  setAmountA: (amount: string) => void;
  setAmountB: (amount: string) => void;
  setFeeTier: (feeTier: number | undefined) => void;
  setPriceRange: (range: { lower: number; upper: number } | undefined) => void;
  reset: () => void;
}

const CreateLiquidityContext = createContext<CreateLiquidityContextType | undefined>(undefined);

export function CreateLiquidityProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CreateLiquidityState>({
    tokenA: null,
    tokenB: null,
    amountA: '',
    amountB: '',
    feeTier: undefined,
    priceRange: undefined,
  });

  const setTokenA = (token: Token | null) => {
    setState((prev) => ({ ...prev, tokenA: token }));
  };

  const setTokenB = (token: Token | null) => {
    setState((prev) => ({ ...prev, tokenB: token }));
  };

  const setAmountA = (amount: string) => {
    setState((prev) => ({ ...prev, amountA: amount }));
  };

  const setAmountB = (amount: string) => {
    setState((prev) => ({ ...prev, amountB: amount }));
  };

  const setFeeTier = (feeTier: number | undefined) => {
    setState((prev) => ({ ...prev, feeTier }));
  };

  const setPriceRange = (priceRange: { lower: number; upper: number } | undefined) => {
    setState((prev) => ({ ...prev, priceRange }));
  };

  const reset = () => {
    setState({
      tokenA: null,
      tokenB: null,
      amountA: '',
      amountB: '',
      feeTier: undefined,
      priceRange: undefined,
    });
  };

  return (
    <CreateLiquidityContext.Provider
      value={{
        state,
        setTokenA,
        setTokenB,
        setAmountA,
        setAmountB,
        setFeeTier,
        setPriceRange,
        reset,
      }}
    >
      {children}
    </CreateLiquidityContext.Provider>
  );
}

export function useCreateLiquidity() {
  const context = useContext(CreateLiquidityContext);
  if (context === undefined) {
    throw new Error('useCreateLiquidity must be used within CreateLiquidityProvider');
  }
  return context;
}

