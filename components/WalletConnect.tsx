'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import Image from 'next/image';

const PowerIcon = () => (
  <Image
    src="/nav-icons/Power-icon.png"
    alt="Wallet"
    width={20}
    height={20}
    className="filter brightness-0 invert"
  />
);

interface CompactWalletConnectProps {
  className?: string;
}

export function CompactWalletConnect({ className = '' }: CompactWalletConnectProps) {
  return (
    <div className={className}>
      <ConnectButton.Custom>
        {({
          account,
          chain,
          openAccountModal,
          openChainModal,
          openConnectModal,
          mounted,
        }) => {
          const ready = mounted;
          const connected = ready && account && chain;

          return (
            <div
              {...(!ready && {
                'aria-hidden': true,
                style: {
                  opacity: 0,
                  pointerEvents: 'none',
                  userSelect: 'none',
                },
              })}
            >
              {(() => {
                if (!connected) {
                  return (
                    <button
                      onClick={openConnectModal}
                      className="w-10 h-10 flex items-center justify-center rounded-full text-white hover:bg-gray-800 dark:hover:bg-gray-800 transition-colors"
                      title="Connect Wallet"
                    >
                      <PowerIcon />
                    </button>
                  );
                }

                if (chain.unsupported) {
                  return (
                    <button
                      onClick={openChainModal}
                      className="w-10 h-10 flex items-center justify-center rounded-full text-white hover:bg-gray-800 dark:hover:bg-gray-800 transition-colors"
                      title="Wrong Network"
                    >
                      <PowerIcon />
                    </button>
                  );
                }

                return (
                  <button
                    onClick={openAccountModal}
                    className="w-10 h-10 flex items-center justify-center rounded-full text-white hover:bg-gray-800 dark:hover:bg-gray-800 transition-colors"
                    title={account.displayName || account.address}
                  >
                    <PowerIcon />
                  </button>
                );
              })()}
            </div>
          );
        }}
      </ConnectButton.Custom>
    </div>
  );
}

export function WalletConnect() {
  return <ConnectButton showBalance={false} />;
}


