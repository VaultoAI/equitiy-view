'use client';

import { useMemo, useEffect, useState } from 'react';
import {
  ComposedChart,
  Area,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
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
  volume: number;
  price: number;
  timestamp: number;
}

export function TVLChart({ poolData, loading }: TVLChartProps) {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    // Check if dark mode is active
    const checkDarkMode = () => {
      if (typeof window !== 'undefined') {
        const isDark = document.documentElement.classList.contains('dark') ||
          window.matchMedia('(prefers-color-scheme: dark)').matches;
        setIsDarkMode(isDark);
      }
    };

    // Check if mobile
    const checkMobile = () => {
      if (typeof window !== 'undefined') {
        setIsMobile(window.innerWidth < 768); // md breakpoint
      }
    };

    checkDarkMode();
    checkMobile();

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

    // Watch for window resize
    window.addEventListener('resize', checkMobile);

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener('change', checkDarkMode);
      window.removeEventListener('resize', checkMobile);
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
        volume: point.volumeUSD,
        price: point.price,
        timestamp: point.date,
      };
    });
  }, [poolData?.tvlHistory]);

  // Calculate which dates should be shown on x-axis
  // For mobile: evenly spaced ticks for consistent grid lines
  // For desktop: ticks based on time intervals (every 2 days)
  const xAxisTicks = useMemo(() => {
    if (!chartData || chartData.length === 0) return [];
    
    // Sort chartData by timestamp to ensure chronological order
    const sortedData = [...chartData].sort((a, b) => a.timestamp - b.timestamp);
    
    if (sortedData.length === 0) return [];
    
    // For mobile: create evenly spaced ticks (4-5 ticks)
    if (isMobile) {
      const numTicks = Math.min(5, sortedData.length);
      const ticks: string[] = [];
      const step = Math.max(1, Math.floor((sortedData.length - 1) / (numTicks - 1)));
      
      for (let i = 0; i < sortedData.length; i += step) {
        ticks.push(sortedData[i].date);
        if (ticks.length >= numTicks) break;
      }
      
      // Always include the last data point
      if (ticks[ticks.length - 1] !== sortedData[sortedData.length - 1].date) {
        ticks[ticks.length - 1] = sortedData[sortedData.length - 1].date;
      }
      
      return ticks;
    }
    
    // For desktop: show ticks based on time intervals (every 2 days)
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
  }, [chartData, isMobile]);

  // Calculate Y-axis domains to use most of the chart height for better visibility of fluctuations
  const usdDomain = useMemo(() => {
    if (!chartData || chartData.length === 0) return ['auto', 'auto'];
    
    // Get all TVL and Volume values
    const tvlValues = chartData.map(d => d.tvl).filter(v => v > 0);
    const volumeValues = chartData.map(d => d.volume).filter(v => v > 0);
    const allUSDValues = [...tvlValues, ...volumeValues];
    
    if (allUSDValues.length === 0) return ['auto', 'auto'];
    
    const min = Math.min(...allUSDValues);
    const max = Math.max(...allUSDValues);
    const range = max - min;
    
    // Add 10% padding on top and bottom, but ensure we don't go below 0
    const padding = range * 0.1;
    const domainMin = Math.max(0, min - padding);
    const domainMax = max + padding;
    
    return [domainMin, domainMax];
  }, [chartData]);

  const priceDomain = useMemo(() => {
    if (!chartData || chartData.length === 0) return ['auto', 'auto'];
    
    // Get all price values (filter out zeros and invalid prices)
    const priceValues = chartData.map(d => d.price).filter(p => p > 0);
    
    if (priceValues.length === 0) return ['auto', 'auto'];
    
    const min = Math.min(...priceValues);
    const max = Math.max(...priceValues);
    const range = max - min;
    
    // If range is very small (less than 1% of max), use a percentage-based padding
    // Otherwise use 10% padding
    const padding = range < max * 0.01 ? max * 0.05 : range * 0.1;
    const domainMin = Math.max(0, min - padding);
    const domainMax = max + padding;
    
    return [domainMin, domainMax];
  }, [chartData]);

  if (loading || !poolData) {
    return (
      <div className="bg-gray-50 dark:bg-gray-900 p-3 md:p-6 rounded-lg mb-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-32 mb-4"></div>
          <div className="h-64 bg-gray-300 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (!chartData || chartData.length === 0) {
    return (
      <div className="bg-gray-50 dark:bg-gray-900 p-3 md:p-6 rounded-lg mb-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
          TVL, Volume & Price
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
      const data = payload[0].payload;
      return (
        <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 font-medium">
            {data.date}
          </p>
          <div className="space-y-1">
            <p className="text-sm text-gray-900 dark:text-gray-100">
              <span className="text-blue-600 dark:text-blue-400">TVL:</span>{' '}
              <span className="font-semibold">{formatCurrency(data.tvl)}</span>
            </p>
            <p className="text-sm text-gray-900 dark:text-gray-100">
              <span className="text-green-600 dark:text-green-400">Volume:</span>{' '}
              <span className="font-semibold">{formatCurrency(data.volume)}</span>
            </p>
            <p className="text-sm text-gray-900 dark:text-gray-100">
              <span className="text-orange-600 dark:text-orange-400">Price:</span>{' '}
              <span className="font-semibold">
                {data.price > 0 ? formatCurrency(data.price) : 'N/A'}
              </span>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };

  // Format Y-axis values for USD (TVL and Volume)
  const formatYAxisUSD = (value: number) => {
    // Hide "$0" label on mobile
    if (isMobile && value === 0) {
      return '';
    }
    
    // For mobile: round to nearest 1000 and remove decimals
    if (isMobile) {
      const roundedValue = Math.round(value / 1000) * 1000;
      if (roundedValue >= 1e9) {
        return `$${Math.round(roundedValue / 1e9)}B`;
      }
      if (roundedValue >= 1e6) {
        return `$${Math.round(roundedValue / 1e6)}M`;
      }
      if (roundedValue >= 1e3) {
        return `$${Math.round(roundedValue / 1e3)}K`;
      }
      return `$${roundedValue}`;
    }
    
    // For desktop: keep decimals
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

  // Format Y-axis values for Price
  const formatYAxisPrice = (value: number) => {
    if (value === 0) return '';
    
    // For very small prices, show more decimals
    if (value < 0.01) {
      return `$${value.toFixed(6)}`;
    }
    if (value < 1) {
      return `$${value.toFixed(4)}`;
    }
    if (value < 1000) {
      return `$${value.toFixed(2)}`;
    }
    if (value >= 1e9) {
      return `$${(value / 1e9).toFixed(2)}B`;
    }
    if (value >= 1e6) {
      return `$${(value / 1e6).toFixed(2)}M`;
    }
    if (value >= 1e3) {
      return `$${(value / 1e3).toFixed(2)}K`;
    }
    return `$${value.toFixed(2)}`;
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-900 px-2 py-3 md:p-6 rounded-lg mb-6">
      <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
        TVL, Volume & Price
      </h3>
      <div className="w-full" style={{ height: '300px' }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ 
              top: 10, 
              right: isMobile ? 5 : 30, 
              left: isMobile ? -5 : -10, 
              bottom: 10 
            }}
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
            {!isMobile && (
              <CartesianGrid
                strokeDasharray="3 3"
                stroke={isDarkMode ? '#374151' : '#e5e7eb'}
              />
            )}
            <XAxis
              dataKey="date"
              stroke={isDarkMode ? '#9ca3af' : '#6b7280'}
              style={{ fontSize: '12px' }}
              tick={{ fill: isDarkMode ? '#d1d5db' : '#4b5563' }}
              ticks={xAxisTicks}
            />
            <YAxis
              yAxisId="left"
              domain={usdDomain}
              stroke={isDarkMode ? '#9ca3af' : '#6b7280'}
              style={{ fontSize: '12px' }}
              tick={{ fill: isDarkMode ? '#d1d5db' : '#4b5563' }}
              tickFormatter={formatYAxisUSD}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={priceDomain}
              stroke={isDarkMode ? '#9ca3af' : '#6b7280'}
              style={{ fontSize: '12px' }}
              tick={{ fill: isDarkMode ? '#d1d5db' : '#4b5563' }}
              tickFormatter={formatYAxisPrice}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="tvl"
              stroke="#3b82f6"
              strokeWidth={2}
              fill="url(#colorTvl)"
              name="TVL"
            />
            <Bar
              yAxisId="left"
              dataKey="volume"
              fill="#10b981"
              fillOpacity={0.6}
              name="Volume"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="price"
              stroke="#f97316"
              strokeWidth={2}
              dot={false}
              name="Price"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

