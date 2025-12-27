import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { VerticalNav } from '@/components/Navigation/VerticalNav';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Vaulto Liquidity Provider',
  description: 'Provide liquidity to Uniswap pools and earn fees',
  icons: {
    icon: '/favicon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <VerticalNav />
          {children}
        </Providers>
      </body>
    </html>
  );
}


