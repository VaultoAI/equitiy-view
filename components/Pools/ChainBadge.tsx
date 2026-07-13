'use client';

/**
 * Small pill indicating which chain a pool lives on. Rendered next to the pool
 * pair so users can tell Ethereum / BNB Chain / Solana rows apart at a glance.
 */
interface ChainBadgeProps {
  chain: string;
  className?: string;
}

const CHAIN_STYLES: Record<string, { label: string; classes: string }> = {
  ETHEREUM: {
    label: 'ETH',
    classes: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300',
  },
  BSC: {
    label: 'BNB',
    classes: 'bg-yellow-50 text-yellow-800 dark:bg-yellow-950/50 dark:text-yellow-300',
  },
  SOLANA: {
    label: 'SOL',
    classes: 'bg-purple-50 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300',
  },
};

export function ChainBadge({ chain, className = '' }: ChainBadgeProps) {
  const style = CHAIN_STYLES[chain?.toUpperCase()] ?? {
    label: chain || '—',
    classes: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  };

  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] md:text-xs font-semibold leading-none ${style.classes} ${className}`}
      title={chain}
    >
      {style.label}
    </span>
  );
}
