'use client';

import { Token } from '@/lib/pools/types';

interface FixedTokenDisplayProps {
  label: string;
  token: Token;
}

export function FixedTokenDisplay({ label, token }: FixedTokenDisplayProps) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium mb-2">{label}</label>
      <div className="w-full px-4 py-3 border rounded-lg bg-gray-50 dark:bg-gray-900 flex items-center justify-between">
        <div>
          <div className="font-medium">{token.symbol}</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">{token.name}</div>
          <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            {token.address.slice(0, 6)}...{token.address.slice(-4)}
          </div>
        </div>
      </div>
    </div>
  );
}


