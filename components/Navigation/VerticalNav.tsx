'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { CompactWalletConnect } from '@/components/WalletConnect';
import { MobileCacheRefreshButton } from '@/components/CacheRefreshButton';

const HomeIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M10 2L3 7V18H7V12H13V18H17V7L10 2Z"
      fill="currentColor"
    />
  </svg>
);

const PoolsIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M10 2C6.5 2 3.5 5 3.5 8.5C3.5 12 6.5 15 10 15C13.5 15 16.5 12 16.5 8.5C16.5 5 13.5 2 10 2Z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <path
      d="M10 5V12"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
    <path
      d="M7 8.5H13"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

const EthIcon = () => (
  <Image
    src="/nav-icons/ethicon.png"
    alt="Ethereum"
    width={15}
    height={15}
    className="rounded-full"
  />
);

const SolIcon = () => (
  <Image
    src="/nav-icons/solicon.png"
    alt="Solana"
    width={20}
    height={20}
    className="rounded-full"
  />
);

export function MobileNavBar() {
  const pathname = usePathname();

  const navItems = [
    { href: '/wallet', label: 'My Wallet', icon: HomeIcon },
    { href: '/', label: 'Tokenized Stocks', icon: EthIcon },
  ];

  return (
    <nav className="md:hidden z-50">
      <div className="bg-gray-900 dark:bg-gray-950 rounded-full border border-gray-700 dark:border-gray-600 p-1.5 flex gap-1.5">
        {navItems.map((item) => {
          const isActive = pathname === item.href || 
            (item.href === '/' && pathname === '/') ||
            (item.href !== '/' && pathname?.startsWith(item.href));
          const IconComponent = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-white hover:bg-gray-800 dark:hover:bg-gray-800'
              }`}
              title={item.label}
            >
              <IconComponent />
            </Link>
          );
        })}
        <div className="w-10 h-10 flex items-center justify-center">
          <MobileCacheRefreshButton className="w-full h-full text-white hover:bg-gray-800 dark:hover:bg-gray-800 rounded-full" />
        </div>
        <CompactWalletConnect />
      </div>
    </nav>
  );
}

const NAV_ITEMS = [
  { href: '/wallet', label: 'My Wallet', icon: HomeIcon },
  { href: '/', label: 'Tokenized Stocks', icon: EthIcon },
];

/** Inline nav links for the page header (replaces side nav). */
export function HeaderNavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-4 md:gap-6">
      {NAV_ITEMS.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href === '/' && pathname === '/') ||
          (item.href !== '/' && pathname?.startsWith(item.href));
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`text-sm md:text-base font-medium transition-colors ${
              isActive
                ? 'text-blue-600 dark:text-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function VerticalNav() {
  return null;
}

