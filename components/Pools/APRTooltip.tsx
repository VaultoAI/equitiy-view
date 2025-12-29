'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';

interface APRTooltipProps {
  apr: number | string;
  className?: string;
  showLowTvlWarning?: boolean;
}

export function APRTooltip({ apr, className = '', showLowTvlWarning = false }: APRTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLSpanElement>(null);

  const formula = '\\text{APR} = \\frac{\\text{Fees}_{30d} \\times 365}{\\text{TVL} \\times 30} \\times 100\\%';

  const updatePosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const tooltipWidth = 320; // w-80 = 20rem = 320px
      const spacing = 8; // mb-2 = 0.5rem = 8px

      // Calculate position below the element, centered horizontally
      let left = rect.left + rect.width / 2 - tooltipWidth / 2;
      const top = rect.bottom + spacing;

      // Adjust if tooltip would go off the left edge
      if (left < 10) {
        left = 10;
      }

      // Adjust if tooltip would go off the right edge
      if (left + tooltipWidth > window.innerWidth - 10) {
        left = window.innerWidth - tooltipWidth - 10;
      }

      setPosition({ top, left });
    }
  };

  useEffect(() => {
    if (isVisible) {
      updatePosition();

      // Update position on scroll and resize
      window.addEventListener('scroll', updatePosition, true);
      window.addEventListener('resize', updatePosition);

      return () => {
        window.removeEventListener('scroll', updatePosition, true);
        window.removeEventListener('resize', updatePosition);
      };
    }
  }, [isVisible]);

  const tooltipContent = isVisible ? (
    <div
      className="fixed z-[9999] w-80 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
      role="tooltip"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {showLowTvlWarning ? (
        <div className="flex items-start gap-2 text-sm text-amber-600 dark:text-amber-400">
          <svg
            className="w-5 h-5 mt-0.5 flex-shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <div>
            TVL too small for accurate APR calculation
          </div>
        </div>
      ) : (
        <>
          <div className="mb-4 overflow-x-auto">
            <BlockMath math={formula} />
          </div>
          <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400">
              <svg
                className="w-4 h-4 mt-0.5 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                TVL changes frequently and can lead to misleading APR values.
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  ) : null;

  return (
    <>
      <span
        ref={triggerRef}
        className={`inline-block ${className}`}
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
      >
        {apr}
      </span>
      {typeof window !== 'undefined' && createPortal(tooltipContent, document.body)}
    </>
  );
}
