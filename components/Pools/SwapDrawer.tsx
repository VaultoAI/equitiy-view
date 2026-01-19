'use client';

import { useRef, forwardRef, useImperativeHandle } from 'react';
import type { WidgetConfig } from '@lifi/widget';
import { LiFiWidget, WidgetDrawer, WidgetSkeleton } from '@lifi/widget';
import { ClientOnly } from '@/components/ClientOnly';
import { Token } from '@/lib/pools/types';

interface SwapDrawerProps {
  token0: Token;
  token1: Token;
}

export interface SwapDrawerHandle {
  toggleDrawer: () => void;
}

export const SwapDrawer = forwardRef<SwapDrawerHandle, SwapDrawerProps>(
  ({ token0, token1 }, ref) => {
    const drawerRef = useRef<WidgetDrawer>(null);

    useImperativeHandle(ref, () => ({
      toggleDrawer: () => {
        drawerRef.current?.toggleDrawer();
      },
    }));

    // Calculate $100 worth of the from token based on its decimals
    const defaultAmount = (100).toString();

    const config: Partial<WidgetConfig> = {
      variant: 'drawer',
      subvariant: 'split',
      subvariantOptions: {
        split: 'swap',
      },
      fromChain: 1, // Ethereum mainnet
      toChain: 1, // Ethereum mainnet
      fromToken: token0.address,
      toToken: token1.address,
      fromAmount: defaultAmount,
      theme: {
        container: {
          boxShadow: '0px 8px 32px rgba(0, 0, 0, 0.08)',
          borderRadius: '16px',
        },
      },
    };

    return (
      <ClientOnly fallback={<WidgetSkeleton config={config} />}>
        <LiFiWidget
          ref={drawerRef}
          config={config}
          integrator="Vaulto-Earn"
        />
      </ClientOnly>
    );
  }
);

SwapDrawer.displayName = 'SwapDrawer';
