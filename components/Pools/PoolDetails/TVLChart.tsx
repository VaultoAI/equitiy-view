'use client';

import { useMemo, useEffect, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { PoolData } from '@/lib/pools/types';
import { formatCurrency } from '@/lib/utils/formatting';

interface TVLChartProps {
  poolData: PoolData;
  loading?: boolean;
}

interface ChartDataPoint {
  date: string;
  tvl: number;
  timestamp: number;
}

export function TVLChart({ poolData, loading }: TVLChartProps) {
  const [isDarkMode, setIsDarkMode] = useState(false);

  useEffect(() => {
    // Check if dark mode is active
    const checkDarkMode = () => {
      if (typeof window !== 'undefined') {
        const isDark = document.documentElement.classList.contains('dark') ||
          window.matchMedia('(prefers-color-scheme: dark)').matches;
        setIsDarkMode(isDark);
      }
    };

    checkDarkMode();

    // Watch for theme changes
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

  const chartData = useMemo<ChartDataPoint[]>(() => {
    if (!poolData?.tvlHistory || poolData.tvlHistory.length === 0) {
      return [];
    }

    return poolData.tvlHistory.map((point) => {
      const date = new Date(point.date * 1000);
      return {
        date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        tvl: point.tvlUSD,
        timestamp: point.date,
      };
    });
  }, [poolData?.tvlHistory]);

  // Calculate which dates should be shown on x-axis (every 2 days)
  const xAxisTicks = useMemo(() => {
    if (!chartData || chartData.length === 0) return [];
    
    // Sort chartData by timestamp to ensure chronological order
    const sortedData = [...chartData].sort((a, b) => a.timestamp - b.timestamp);
    
    if (sortedData.length === 0) return [];
    
    const ticks: string[] = [];
    let lastShownTimestamp = sortedData[0].timestamp;
    
    // Always show the first date
    ticks.push(sortedData[0].date);
    
    // Then show every date that is at least 2 days (172800 seconds) after the last shown date
    for (let i = 1; i < sortedData.length; i++) {
      const daysDiff = (sortedData[i].timestamp - lastShownTimestamp) / (24 * 60 * 60);
      if (daysDiff >= 2) {
        ticks.push(sortedData[i].date);
        lastShownTimestamp = sortedData[i].timestamp;
      }
    }
    
    return ticks;
  }, [chartData]);

  if (loading || !poolData) {
    return (
      <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-lg mb-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-32 mb-4"></div>
          <div className="h-64 bg-gray-300 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (!chartData || chartData.length === 0) {
    return (
      <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-lg mb-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
          TVL Over Time
        </h3>
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          No TVL data available
        </div>
      </div>
    );
  }

  // Custom tooltip component
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
            {payload[0].payload.date}
          </p>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            TVL: {formatCurrency(payload[0].value)}
          </p>
        </div>
      );
    }
    return null;
  };

  // Format Y-axis values
  const formatYAxis = (value: number) => {
    if (value >= 1e9) {
      return `$${(value / 1e9).toFixed(1)}B`;
    }
    if (value >= 1e6) {
      return `$${(value / 1e6).toFixed(1)}M`;
    }
    if (value >= 1e3) {
      return `$${(value / 1e3).toFixed(1)}K`;
    }
    return `$${value.toFixed(0)}`;
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-lg mb-6">
      <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
        TVL Over Time
      </h3>
      <div className="w-full" style={{ height: '300px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
          >
            <defs>
              <linearGradient id="colorTvl" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="#3b82f6"
                  stopOpacity={0.3}
                />
                <stop
                  offset="95%"
                  stopColor="#3b82f6"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={isDarkMode ? '#374151' : '#e5e7eb'}
            />
            <XAxis
              dataKey="date"
              stroke={isDarkMode ? '#9ca3af' : '#6b7280'}
              style={{ fontSize: '12px' }}
              tick={{ fill: isDarkMode ? '#d1d5db' : '#4b5563' }}
              ticks={xAxisTicks}
            />
            <YAxis
              stroke={isDarkMode ? '#9ca3af' : '#6b7280'}
              style={{ fontSize: '12px' }}
              tick={{ fill: isDarkMode ? '#d1d5db' : '#4b5563' }}
              tickFormatter={formatYAxis}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="tvl"
              stroke="#3b82f6"
              strokeWidth={2}
              fill="url(#colorTvl)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

