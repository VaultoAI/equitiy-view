'use client';

import Image from 'next/image';

interface VaultoLogoProps {
  width?: number;
  height?: number;
  className?: string;
  alt?: string;
}

/**
 * Vaulto logo component that switches between dark and light variants
 * based on the current theme using CSS:
 * - Light mode: displays vaultodark.png (dark logo on light background)
 * - Dark mode: displays vaultolight.png (light logo on dark background)
 * 
 * No JavaScript switching - uses CSS to show/hide the appropriate logo
 */
export function VaultoLogo({
  width = 150,
  height = 50,
  className = '',
  alt = 'Vaulto',
}: VaultoLogoProps) {
  return (
    <div className={`relative ${className}`} style={{ width, height }}>
      {/* Light mode logo (dark text) - hidden in dark mode */}
      <Image
        src="/vaultodark.png"
        alt={alt}
        width={width}
        height={height}
        className="block dark:hidden"
        priority
      />
      {/* Dark mode logo (light text) - hidden in light mode */}
      <Image
        src="/vaultolight.png"
        alt={alt}
        width={width}
        height={height}
        className="hidden dark:block"
        priority
      />
    </div>
  );
}

