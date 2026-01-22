'use client';

import { useMemo, useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  Legend,
  CartesianGrid,
} from 'recharts';
import JSBI from 'jsbi';
import { LiquidityBand } from '@/lib/uniswap/activeLiquidity';

interface HorizontalLiquidityChartProps {
  bands: LiquidityBand[];
  currentTick: number;
  securitySymbol: string;
  usdcSymbol: string;
  isUSDC0: boolean;
  tvlUSD?: string;
  priceDomain?: [number, number];
  chartHeight?: number;
  loading?: boolean;
}

export function HorizontalLiquidityChart({
  bands,
  currentTick,
  securitySymbol,
  usdcSymbol,
  isUSDC0,
  tvlUSD,
  priceDomain,
  chartHeight = 300,
  loading,
}: HorizontalLiquidityChartProps) {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'));
    };
    
    checkDarkMode();
    
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    
    return () => observer.disconnect();
  }, []);

  // Calculate total liquidity
  const totalLiquidity = useMemo(() => {
    return bands.reduce((sum, band) => {
      const liquidityNum = parseFloat(band.liquidityActive.toString());
      return sum + liquidityNum;
    }, 0);
  }, [bands]);

  // Calculate scaling factor
  const scalingFactor = useMemo(() => {
    const tvlValue = tvlUSD ? parseFloat(tvlUSD) : totalLiquidity;
    return totalLiquidity > 0 ? tvlValue / totalLiquidity : 1;
  }, [tvlUSD, totalLiquidity]);

  // Prepare chart data - combine bands and filter by price domain
  const chartData = useMemo(() => {
    if (!priceDomain) return [];
    
    const [minPrice, maxPrice] = priceDomain;
    
    // Filter bands within price domain
    const filteredBands = bands.filter((band) => {
      const midPrice = (band.priceLowerUSD + band.priceUpperUSD) / 2;
      return midPrice >= minPrice && midPrice <= maxPrice;
    });
    
    // Combine bands into larger groups (reduce number of bars)
    const numBands = 20; // Target number of bands to display
    const priceRange = maxPrice - minPrice;
    const bandSize = priceRange / numBands;
    
    const combinedBands: Map<number, {
      priceLower: number;
      priceUpper: number;
      totalLiquidity: number;
      isCurrent: boolean;
      bands: typeof filteredBands;
    }> = new Map();
    
    filteredBands.forEach((band) => {
      const midPrice = (band.priceLowerUSD + band.priceUpperUSD) / 2;
      const bandIndex = Math.floor((midPrice - minPrice) / bandSize);
      const bandKey = Math.min(bandIndex, numBands - 1);
      
      if (!combinedBands.has(bandKey)) {
        combinedBands.set(bandKey, {
          priceLower: minPrice + bandKey * bandSize,
          priceUpper: minPrice + (bandKey + 1) * bandSize,
          totalLiquidity: 0,
          isCurrent: false,
          bands: [],
        });
      }
      
      const combined = combinedBands.get(bandKey)!;
      combined.totalLiquidity += parseFloat(band.liquidityActive.toString());
      combined.isCurrent = combined.isCurrent || (band.tickLower <= currentTick && band.tickUpper > currentTick);
      combined.bands.push(band);
    });
    
    // Convert to array and sort by price (descending)
    const sortedData = Array.from(combinedBands.entries())
      .map(([key, data]) => ({
        midPrice: (data.priceLower + data.priceUpper) / 2,
        priceLowerUSD: data.priceLower,
        priceUpperUSD: data.priceUpper,
        priceLabel: `$${((data.priceLower + data.priceUpper) / 2).toFixed(2)}`,
        isCurrent: data.isCurrent,
        liquidityActive: data.totalLiquidity * scalingFactor,
      }))
      .filter((band) => band.liquidityActive >= 0.50)
      .sort((a, b) => b.midPrice - a.midPrice);
    
    // Add unique IDs based on final array index to ensure no duplicates
    const finalData = sortedData.map((item, index) => ({
      ...item,
      id: `band-${index}`,
    }));
    
    // Debug: Check for duplicate IDs
    const ids = finalData.map(d => d.id);
    const uniqueIds = new Set(ids);
    if (ids.length !== uniqueIds.size) {
      console.warn('[HorizontalLiquidityChart] Duplicate IDs detected:', ids);
    }
    
    return finalData;
  }, [bands, currentTick, scalingFactor, priceDomain]);

  // Handle loading state after all hooks
  if (loading) {
    return (
      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg px-2 py-3 md:p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded w-48 mb-4"></div>
          <div className="bg-gray-300 dark:bg-gray-700 rounded" style={{ height: `${chartHeight + 7}px` }}></div>
        </div>
      </div>
    );
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload[0]) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-900 dark:bg-gray-800 border border-gray-700 dark:border-gray-600 rounded-lg p-3 shadow-xl">
          <p className="text-sm font-semibold text-white mb-1">
            ${data.priceLowerUSD.toFixed(2)} ↔ ${data.priceUpperUSD.toFixed(2)}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-300">
            Liquidity:{' '}
            <span className="text-white font-semibold">
              ${data.liquidityActive.toLocaleString('en-US', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </span>
          </p>
        </div>
      );
    }
    return null;
  };

  if (chartData.length === 0) {
    return (
      <div className="bg-gray-50 dark:bg-gray-900 rounded-lg px-2 py-3 md:p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Liquidity Distribution
        </h3>
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          No liquidity data available
        </div>
      </div>
    );
  }

  // Find current price for color determination
  const currentPriceEntry = chartData.find((e) => e.isCurrent);
  const currentPriceMid = currentPriceEntry?.midPrice;

  return (
    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg px-2 py-3 md:p-6">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Liquidity Distribution
      </h3>
      <div style={{ height: `${chartHeight + 7}px` }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 10, right: -35, left: -10, bottom: 15 }}
            barSize={16}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={isDarkMode ? '#374151' : '#e5e7eb'}
              horizontal={false}
              vertical={true}
            />
            <XAxis
              type="number"
              reversed={true}
              stroke={isDarkMode ? '#9ca3af' : '#6b7280'}
              style={{ fontSize: '12px' }}
              tick={{ fill: isDarkMode ? '#d1d5db' : '#4b5563' }}
              tickFormatter={(value) => {
                if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
                if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
                if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}k`;
                return `$${value.toFixed(0)}`;
              }}
            />
            <YAxis
              type="category"
              dataKey="priceLabel"
              orientation="right"
              stroke={isDarkMode ? '#9ca3af' : '#6b7280'}
              style={{ fontSize: '10px' }}
              tick={{ fill: isDarkMode ? '#d1d5db' : '#4b5563' }}
              width={80}
              domain={priceDomain ? [priceDomain[0], priceDomain[1]] : undefined}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="liquidityActive" radius={[8, 0, 0, 8]}>
              {chartData.map((entry) => {
                let fill = '#10B981'; // Green (above)
                if (entry.isCurrent) {
                  fill = '#F51E87'; // Pink (current)
                } else if (currentPriceMid && entry.midPrice < currentPriceMid) {
                  fill = '#2172E5'; // Blue (below)
                }

                return (
                  <Cell
                    key={entry.id}
                    fill={fill}
                    opacity={entry.isCurrent ? 1 : 0.8}
                    stroke={entry.isCurrent ? '#F51E87' : 'none'}
                    strokeWidth={entry.isCurrent ? 2 : 0}
                  />
                );
              })}
            </Bar>
            <Legend
              verticalAlign="bottom"
              align="center"
              height={36}
              content={() => (
                <div className="flex gap-4 justify-center items-center pt-2" style={{ marginLeft: '-50px', marginTop: '10px' }}>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-blue-600"></div>
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      {usdcSymbol}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-green-500"></div>
                    <span className="text-sm text-gray-600 dark:text-gray-300">
                      {securitySymbol}
                    </span>
                  </div>
                </div>
              )}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
