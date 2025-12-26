'use client';

import { useState } from 'react';
import { Token } from '@/lib/pools/types';
import { useTokenBalances } from '@/hooks/useTokenBalances';

interface TokenSelectorProps {
  label: string;
  selectedToken: Token | null;
  onSelect: (token: Token | null) => void;
  excludeToken?: Token | null;
}

export function TokenSelector({ label, selectedToken, onSelect, excludeToken }: TokenSelectorProps) {
  const { balanceList } = useTokenBalances();
  const [isOpen, setIsOpen] = useState(false);

  const availableTokens = balanceList
    .map((b) => b.currencyInfo.currency)
    .filter((token) => token.address !== excludeToken?.address);

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium mb-2">{label}</label>
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-4 py-3 border rounded-lg flex items-center justify-between hover:border-blue-500"
        >
          <span>{selectedToken ? `${selectedToken.symbol} - ${selectedToken.name}` : 'Select token'}</span>
          <span>▼</span>
        </button>
        {isOpen && (
          <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border rounded-lg shadow-lg max-h-60 overflow-auto">
            {availableTokens.map((token) => (
              <button
                key={token.address}
                onClick={() => {
                  onSelect(token);
                  setIsOpen(false);
                }}
                className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <div className="font-medium">{token.symbol}</div>
                <div className="text-sm text-gray-600 dark:text-gray-400">{token.name}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

