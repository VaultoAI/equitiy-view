'use client';

import { useState, useEffect } from 'react';

/**
 * Hook to detect the current theme (dark/light mode)
 * Checks both document class and system preference
 * Initializes by immediately checking the theme to avoid logo flash
 */
export function useTheme() {
  // Initialize by checking the theme immediately to avoid flash
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return (
        document.documentElement.classList.contains('dark') ||
        window.matchMedia('(prefers-color-scheme: dark)').matches
      );
    }
    // Default to dark mode for SSR
    return true;
  });

  useEffect(() => {
    // Check if dark mode is active
    const checkDarkMode = () => {
      if (typeof window !== 'undefined') {
        const isDark =
          document.documentElement.classList.contains('dark') ||
          window.matchMedia('(prefers-color-scheme: dark)').matches;
        setIsDarkMode(isDark);
      }
    };

    // Initial check (in case state wasn't initialized properly)
    checkDarkMode();

    // Watch for theme changes via class changes
    const observer = new MutationObserver(checkDarkMode);
    if (typeof window !== 'undefined') {
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['class'],
      });
    }

    // Watch for system theme changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', checkDarkMode);

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener('change', checkDarkMode);
    };
  }, []);

  return { isDarkMode };
}

