'use client';

import Image from 'next/image';
import { useTheme } from '@/hooks/useTheme';

interface VaultoLogoProps {
  width?: number;
  height?: number;
  className?: string;
  alt?: string;
}

/**
 * Vaulto logo component that switches between dark and light variants
 * based on the current theme:
 * - Light mode: displays vaultodark.png (dark logo on light background)
 * - Dark mode: displays vaultolight.png (light logo on dark background)
 */
export function VaultoLogo({
  width = 150,
  height = 50,
  className = '',
  alt = 'Vaulto',
}: VaultoLogoProps) {
  const { isDarkMode } = useTheme();
  
  // In light mode, use dark logo; in dark mode, use light logo
  const logoSrc = isDarkMode ? '/vaultolight.png' : '/vaultodark.png';

  return (
    <Image
      src={logoSrc}
      alt={alt}
      width={width}
      height={height}
      className={className}
    />
  );
}

