import Link from 'next/link';
import { WalletConnect } from '@/components/WalletConnect';

export default function Home() {
  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">Vaulto Earn</h1>
          <WalletConnect />
        </div>
        <div className="text-center py-12">
          <h2 className="text-2xl font-semibold mb-4">Uniswap Liquidity Provider</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-8">
            Provide liquidity to Uniswap pools and earn fees
          </p>
          <Link
            href="/pools"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            View Pools
          </Link>
        </div>
      </div>
    </div>
  );
}

