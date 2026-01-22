# Horizontal Liquidity Band Chart Integration Guide

## Table of Contents
1. [Overview](#overview)
2. [Core Concepts](#core-concepts)
3. [Data Structure & Types](#data-structure--types)
4. [Mathematical Foundation](#mathematical-foundation)
5. [Chart Architecture](#chart-architecture)
6. [Integration with Complex Multi-Chart Visualization](#integration-with-complex-multi-chart-visualization)
7. [Step-by-Step Implementation](#step-by-step-implementation)
8. [Advanced Customization](#advanced-customization)
9. [Performance Optimization](#performance-optimization)
10. [Troubleshooting](#troubleshooting)

---

## Overview

The **Horizontal Liquidity Band Chart** is a sophisticated visualization that displays liquidity distribution across price bands in a Uniswap V3 pool. Unlike traditional vertical bar charts, this chart uses **horizontal bars** where:

- Each bar represents a **price band** (tick range)
- Bar length represents **active liquidity in USD**
- Bars are sorted **vertically by price** (high to low, top to bottom)
- Color coding indicates position relative to current price
- The current price band is highlighted with a distinctive color and stroke

### Key Features
- **Vertical Layout**: Prices on Y-axis (right side), liquidity amounts on X-axis
- **Dynamic Coloring**: Green (above price), Pink (current price), Blue (below price)
- **Scaled Display**: Bars scaled to match TVL (Total Value Locked)
- **Interactive Tooltips**: Price range and liquidity details on hover
- **Responsive Height**: Dynamically adjusts based on number of bands

---

## Core Concepts

### 1. Liquidity Bands
A liquidity band represents a price range between two ticks in a Uniswap V3 pool:
- **tickLower**: Lower bound tick index
- **tickUpper**: Upper bound tick index
- **liquidityActive**: Active liquidity in this range (JSBI BigInt)
- **priceLowerUSD** / **priceUpperUSD**: Price bounds in USD or security per USDC

### 2. Tick Mechanics
- Ticks are discrete price points in Uniswap V3
- Tick spacing depends on fee tier (e.g., 0.05% = 10, 0.3% = 60, 1% = 200)
- Current tick determines which band contains the current price
- Liquidity accumulates and changes at initialized ticks

### 3. Active Liquidity Calculation
Active liquidity is computed using Uniswap's methodology:
1. Start with pool's total liquidity at current tick
2. Traverse ticks in ascending/descending order
3. Add/subtract `liquidityNet` when crossing initialized ticks
4. Result: liquidity available for swaps in each price band

### 4. Color Semantics
- **Green (#10B981)**: Bands above current price (out-of-range, will be USDC after price rises)
- **Pink (#F51E87)**: Current price band (actively trading)
- **Blue (#2172E5)**: Bands below current price (out-of-range, will be security token after price falls)

---

## Data Structure & Types

### TypeScript Interfaces

```typescript
import JSBI from 'jsbi'

// Raw tick data from subgraph
export interface GraphTick {
  tickIdx: string
  liquidityGross: string
  liquidityNet: string
}

// Processed tick with computed liquidity
export interface TickProcessed {
  tickIdx: number
  liquidityActive: JSBI
  liquidityNet: JSBI
  price0: number
  price1: number
  isCurrent: boolean
}

// Liquidity band for chart display
export interface LiquidityBand {
  tickLower: number
  tickUpper: number
  liquidityActive: JSBI
  priceLowerUSD: number
  priceUpperUSD: number
  amount0: string
  amount1: string
  liquidityUSD: number
}

// Component props
interface HorizontalLiquidityChartProps {
  bands: LiquidityBand[]
  currentTick: number
  securitySymbol: string
  usdcSymbol: string
  isUSDC0: boolean
  tvlUSD?: string
}
```

---

## Mathematical Foundation

### 1. Tick to Price Conversion
```typescript
import { tickToPrice } from '@uniswap/v3-sdk'
import { Token } from '@uniswap/sdk-core'

function tickToPriceNumber(
  token0: Token,
  token1: Token,
  tick: number
): number {
  const price = tickToPrice(token0, token1, tick)
  return parseFloat(price.toSignificant(18))
}
```

### 2. Locked Amount Calculation
Using canonical Uniswap V3 formulas:

```typescript
// amount0 = L * (√P_upper - √P_lower) / (√P_lower * √P_upper)
// amount1 = L * (√P_upper - √P_lower)

export function computeLockedAmounts(
  tickLower: number,
  tickUpper: number,
  liquidity: JSBI,
  token0: Token,
  token1: Token
): { amount0: string; amount1: string } {
  const sqrtA = TickMath.getSqrtRatioAtTick(tickLower)
  const sqrtB = TickMath.getSqrtRatioAtTick(tickUpper)
  
  const sqrtDiff = JSBI.subtract(sqrtB, sqrtA)
  const sqrtProduct = JSBI.multiply(sqrtA, sqrtB)
  
  // Calculate amounts using Q96 fixed-point arithmetic
  const amount0Raw = JSBI.divide(
    JSBI.multiply(liquidity, JSBI.multiply(sqrtDiff, Q96)),
    sqrtProduct
  )
  
  const amount1Raw = JSBI.divide(
    JSBI.multiply(liquidity, sqrtDiff),
    Q96
  )
  
  // Convert to decimal
  const amount0Decimal = parseFloat(amount0Raw.toString()) / 
    parseFloat(Q96.toString()) / Math.pow(10, token0.decimals)
  const amount1Decimal = parseFloat(amount1Raw.toString()) / 
    parseFloat(Q96.toString()) / Math.pow(10, token1.decimals)
  
  return {
    amount0: amount0Decimal.toFixed(6),
    amount1: amount1Decimal.toFixed(6)
  }
}
```

### 3. Liquidity USD Value
```typescript
// Determine which token is USDC
const usdcAmount = isUSDC0 ? amount0 : amount1
const securityAmount = isUSDC0 ? amount1 : amount0

// Compute mid-price in USD per security
const midPriceUSDPerSecurity = 
  (priceLowerUSDPerSecurity + priceUpperUSDPerSecurity) / 2

// Total USD value
const liquidityUSD = 
  parseFloat(usdcAmount) + 
  parseFloat(securityAmount) * midPriceUSDPerSecurity
```

### 4. TVL Scaling
```typescript
// Calculate total raw liquidity
const totalLiquidity = bands.reduce((sum, band) => {
  const liquidityNum = parseFloat(band.liquidityActive.toString())
  return sum + liquidityNum
}, 0)

// Scale factor to match TVL
const tvlValue = parseFloat(tvlUSD)
const scalingFactor = totalLiquidity > 0 ? tvlValue / totalLiquidity : 1

// Apply to each band
band.liquidityActive = liquidityActiveNum * scalingFactor
```

---

## Chart Architecture

### Component Structure
```
HorizontalLiquidityChart
├── Data Processing Layer
│   ├── Convert JSBI to numbers
│   ├── Calculate mid-prices
│   ├── Apply TVL scaling
│   ├── Filter negligible bands (< $0.50)
│   └── Sort by price (high to low)
│
├── Recharts Configuration
│   ├── ResponsiveContainer (dynamic height)
│   ├── BarChart (layout="vertical")
│   ├── XAxis (liquidity amounts)
│   ├── YAxis (price labels)
│   ├── CartesianGrid (vertical lines only)
│   ├── Tooltip (custom)
│   ├── Bar (with Cell coloring)
│   └── Legend (custom)
│
└── Styling & Interaction
    ├── Color determination logic
    ├── Current band highlighting
    └── Hover states
```

### Recharts Configuration Details

```typescript
<ResponsiveContainer width="100%" height={barHeight}>
  <BarChart
    data={chartData}
    layout="vertical"           // KEY: Horizontal bars
    margin={{ top: 10, right: 90, left: 10, bottom: 30 }}
    barSize={18}               // Fixed bar height
  >
    <CartesianGrid 
      strokeDasharray="3 3" 
      stroke="#374151" 
      horizontal={false}        // Only vertical grid lines
      vertical={true} 
    />
    
    <XAxis
      type="number"             // Numeric axis
      tick={{ fill: '#9ca3af', fontSize: 12 }}
      tickFormatter={(value) => formatCurrency(value)}
    />
    
    <YAxis
      type="category"           // Categorical axis (price labels)
      dataKey="priceLabel"
      orientation="right"       // Labels on right side
      tick={{ fill: '#9ca3af', fontSize: 10 }}
      width={80}
    />
    
    <Tooltip content={<CustomTooltip />} />
    
    <Bar dataKey="liquidityActive" radius={[0, 8, 8, 0]}>
      {chartData.map((entry, index) => (
        <Cell
          key={`cell-${index}`}
          fill={determineColor(entry)}
          opacity={entry.isCurrent ? 1 : 0.8}
          stroke={entry.isCurrent ? '#F51E87' : 'none'}
          strokeWidth={entry.isCurrent ? 2 : 0}
        />
      ))}
    </Bar>
  </BarChart>
</ResponsiveContainer>
```

---

## Integration with Complex Multi-Chart Visualization

### Scenario: Combining with Price, Volume, and TVL Charts

You want to create a dashboard with:
- **Line Chart**: Price over time
- **Vertical Bar Chart**: Volume over time
- **Line Chart**: TVL over time
- **Horizontal Bar Chart**: Liquidity bands (our focus)

### Integration Approaches

#### Approach 1: Separate Charts with Synchronized Interactions
Best for: Independent charts with occasional cross-interactions

```typescript
import { useState } from 'react'
import { 
  ComposedChart, 
  Line, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  ResponsiveContainer,
  BarChart // For horizontal chart
} from 'recharts'

export default function ComplexDashboard() {
  const [selectedTimestamp, setSelectedTimestamp] = useState<number | null>(null)
  const [hoveredBand, setHoveredBand] = useState<number | null>(null)
  
  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Top Left: Price & Volume Combined */}
      <div className="col-span-2">
        <ComposedChart data={timeSeriesData} height={300}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="timestamp" />
          <YAxis yAxisId="price" orientation="left" />
          <YAxis yAxisId="volume" orientation="right" />
          <Tooltip />
          <Legend />
          <Line 
            yAxisId="price"
            type="monotone" 
            dataKey="price" 
            stroke="#8884d8" 
            name="Price"
          />
          <Bar 
            yAxisId="volume"
            dataKey="volume" 
            fill="#82ca9d" 
            name="Volume"
            opacity={0.6}
          />
        </ComposedChart>
      </div>
      
      {/* Bottom Left: TVL Line Chart */}
      <div>
        <ResponsiveContainer width="100%" height={250}>
          <ComposedChart data={timeSeriesData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="timestamp" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line 
              type="monotone" 
              dataKey="tvl" 
              stroke="#ffc658" 
              name="TVL"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      
      {/* Bottom Right: Horizontal Liquidity Bands */}
      <div>
        <HorizontalLiquidityChart
          bands={liquidityBands}
          currentTick={currentTick}
          securitySymbol="SLVon"
          usdcSymbol="USDC"
          isUSDC0={true}
          tvlUSD={tvlUSD}
          onBandHover={setHoveredBand}
          highlightedBand={hoveredBand}
        />
      </div>
    </div>
  )
}
```

#### Approach 2: Embedded Horizontal Bands within ComposedChart
Best for: Tight integration with shared axes

⚠️ **Challenge**: Recharts doesn't natively support mixing horizontal and vertical charts in ComposedChart.

**Solution**: Use custom rendering or overlay approach:

```typescript
export default function UnifiedChart() {
  return (
    <div className="relative">
      {/* Main vertical chart */}
      <ResponsiveContainer width="70%" height={600}>
        <ComposedChart data={timeSeriesData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="timestamp" />
          <YAxis yAxisId="price" orientation="left" label="Price" />
          <YAxis yAxisId="volume" orientation="right" label="Volume" />
          <Tooltip />
          <Legend />
          <Line yAxisId="price" type="monotone" dataKey="price" stroke="#8884d8" />
          <Bar yAxisId="volume" dataKey="volume" fill="#82ca9d" />
        </ComposedChart>
      </ResponsiveContainer>
      
      {/* Horizontal liquidity overlay - positioned absolutely */}
      <div className="absolute right-0 top-0 w-[28%] h-full">
        <HorizontalLiquidityChart
          bands={liquidityBands}
          currentTick={currentTick}
          securitySymbol="SLVon"
          usdcSymbol="USDC"
          isUSDC0={true}
          tvlUSD={tvlUSD}
        />
      </div>
    </div>
  )
}
```

#### Approach 3: Custom Canvas/SVG Rendering
Best for: Maximum control and complex interactions

```typescript
import { useRef, useEffect } from 'react'

export default function CustomComplexChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    // Define layout regions
    const layout = {
      priceChart: { x: 0, y: 0, width: 800, height: 200 },
      volumeChart: { x: 0, y: 220, width: 800, height: 150 },
      liquidityChart: { x: 820, y: 0, width: 380, height: 400 }
    }
    
    // Render price line chart
    renderLineChart(ctx, layout.priceChart, priceData, '#8884d8')
    
    // Render volume bar chart (vertical)
    renderVerticalBars(ctx, layout.volumeChart, volumeData, '#82ca9d')
    
    // Render liquidity bands (horizontal)
    renderHorizontalBands(ctx, layout.liquidityChart, liquidityBands, currentTick)
    
  }, [priceData, volumeData, liquidityBands, currentTick])
  
  return <canvas ref={canvasRef} width={1200} height={400} />
}

function renderHorizontalBands(
  ctx: CanvasRenderingContext2D,
  layout: { x: number, y: number, width: number, height: number },
  bands: LiquidityBand[],
  currentTick: number
) {
  const { x, y, width, height } = layout
  const maxLiquidity = Math.max(...bands.map(b => parseFloat(b.liquidityActive.toString())))
  const barHeight = height / bands.length
  
  bands.forEach((band, index) => {
    const liquidityValue = parseFloat(band.liquidityActive.toString())
    const barWidth = (liquidityValue / maxLiquidity) * width
    const barY = y + index * barHeight
    
    // Determine color
    const isCurrent = band.tickLower <= currentTick && band.tickUpper > currentTick
    const color = isCurrent ? '#F51E87' : 
                  band.midPrice > currentPrice ? '#10B981' : '#2172E5'
    
    // Draw bar
    ctx.fillStyle = color
    ctx.fillRect(x, barY, barWidth, barHeight - 2)
    
    // Draw price label
    ctx.fillStyle = '#9ca3af'
    ctx.font = '10px sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(
      `$${band.priceLowerUSD.toFixed(2)}`, 
      x + width + 50, 
      barY + barHeight / 2
    )
  })
}
```

---

## Step-by-Step Implementation

### Step 1: Install Dependencies

```bash
npm install recharts @uniswap/v3-sdk @uniswap/sdk-core jsbi
```

### Step 2: Set Up Type Definitions

Create `lib/types.ts`:

```typescript
import JSBI from 'jsbi'

export interface GraphTick {
  tickIdx: string
  liquidityGross: string
  liquidityNet: string
}

export interface TickProcessed {
  tickIdx: number
  liquidityActive: JSBI
  liquidityNet: JSBI
  price0: number
  price1: number
  isCurrent: boolean
}

export interface LiquidityBand {
  tickLower: number
  tickUpper: number
  liquidityActive: JSBI
  priceLowerUSD: number
  priceUpperUSD: number
  amount0: string
  amount1: string
  liquidityUSD: number
}
```

### Step 3: Implement Core Liquidity Calculation

Create `lib/uniswap/activeLiquidity.ts`:

```typescript
import { FeeAmount, TickMath, tickToPrice } from '@uniswap/v3-sdk'
import { Token } from '@uniswap/sdk-core'
import JSBI from 'jsbi'
import { GraphTick, TickProcessed, LiquidityBand } from '../types'
import { tickToPriceNumber, computeLockedAmounts, convertToSecurityPerUSDC } from './math'

export function computeActiveLiquidityBands(
  tickCurrent: number,
  poolLiquidity: JSBI,
  tickSpacing: number,
  token0: Token,
  token1: Token,
  numSurroundingTicks: number,
  graphTicks: GraphTick[],
  isUSDC0: boolean
): LiquidityBand[] {
  // 1. Build tick dictionary
  const tickIdxToTickDictionary: Record<string | number, GraphTick> = {}
  graphTicks.forEach((graphTick) => {
    tickIdxToTickDictionary[String(graphTick.tickIdx)] = graphTick
    tickIdxToTickDictionary[Number(graphTick.tickIdx)] = graphTick
  })
  
  // 2. Calculate active tick
  let activeTickIdx = Math.floor(tickCurrent / tickSpacing) * tickSpacing
  if (activeTickIdx <= TickMath.MIN_TICK) {
    activeTickIdx = TickMath.MAX_TICK
  }
  
  // 3. Process ticks (see full implementation in source)
  const processedTicks = processTicks(
    activeTickIdx,
    tickCurrent,
    poolLiquidity,
    tickSpacing,
    token0,
    token1,
    numSurroundingTicks,
    tickIdxToTickDictionary
  )
  
  // 4. Convert to liquidity bands
  const bands: LiquidityBand[] = []
  for (let i = 0; i < processedTicks.length - 1; i++) {
    const tickLower = processedTicks[i].tickIdx
    const tickUpper = processedTicks[i + 1].tickIdx
    const liquidityActive = processedTicks[i].liquidityActive
    
    // Calculate prices
    const priceLower = tickToPriceNumber(token0, token1, tickLower)
    const priceUpper = tickToPriceNumber(token0, token1, tickUpper)
    const priceLowerUSD = convertToSecurityPerUSDC(priceLower, isUSDC0)
    const priceUpperUSD = convertToSecurityPerUSDC(priceUpper, isUSDC0)
    
    // Calculate amounts
    const { amount0, amount1 } = computeLockedAmounts(
      tickLower, tickUpper, liquidityActive, token0, token1
    )
    
    // Calculate USD value
    const usdcAmount = isUSDC0 ? amount0 : amount1
    const securityAmount = isUSDC0 ? amount1 : amount0
    const midPriceUSDPerSecurity = (priceLowerUSD + priceUpperUSD) / 2
    const liquidityUSD = parseFloat(usdcAmount) + 
      parseFloat(securityAmount) * midPriceUSDPerSecurity
    
    bands.push({
      tickLower,
      tickUpper,
      liquidityActive,
      priceLowerUSD,
      priceUpperUSD,
      amount0,
      amount1,
      liquidityUSD
    })
  }
  
  return bands
}

// See full processTicks implementation in source code
```

### Step 4: Implement Math Utilities

Create `lib/uniswap/math.ts`:

```typescript
import { TickMath, tickToPrice } from '@uniswap/v3-sdk'
import { Token } from '@uniswap/sdk-core'
import JSBI from 'jsbi'

const Q96 = JSBI.exponentiate(JSBI.BigInt(2), JSBI.BigInt(96))

export function tickToPriceNumber(
  token0: Token,
  token1: Token,
  tick: number
): number {
  const price = tickToPrice(token0, token1, tick)
  return parseFloat(price.toSignificant(18))
}

export function computeLockedAmounts(
  tickLower: number,
  tickUpper: number,
  liquidity: JSBI,
  token0: Token,
  token1: Token
): { amount0: string; amount1: string } {
  const sqrtA = TickMath.getSqrtRatioAtTick(tickLower)
  const sqrtB = TickMath.getSqrtRatioAtTick(tickUpper)
  
  const sqrtDiff = JSBI.subtract(
    JSBI.BigInt(String(sqrtB)), 
    JSBI.BigInt(String(sqrtA))
  )
  
  const sqrtProduct = JSBI.multiply(
    JSBI.BigInt(String(sqrtA)), 
    JSBI.BigInt(String(sqrtB))
  )
  
  const amount0Numerator = JSBI.multiply(
    liquidity, 
    JSBI.multiply(sqrtDiff, Q96)
  )
  const amount0Raw = JSBI.divide(amount0Numerator, sqrtProduct)
  const amount1Raw = JSBI.divide(JSBI.multiply(liquidity, sqrtDiff), Q96)
  
  const amount0Decimal = parseFloat(amount0Raw.toString()) / 
    parseFloat(Q96.toString()) / Math.pow(10, token0.decimals)
  const amount1Decimal = parseFloat(amount1Raw.toString()) / 
    parseFloat(Q96.toString()) / Math.pow(10, token1.decimals)
  
  return {
    amount0: Math.max(0, amount0Decimal).toFixed(6),
    amount1: Math.max(0, amount1Decimal).toFixed(6)
  }
}

export function convertToSecurityPerUSDC(
  priceToken0PerToken1: number,
  isUSDC0: boolean
): number {
  return isUSDC0 ? 1 / priceToken0PerToken1 : priceToken0PerToken1
}
```

### Step 5: Create the Horizontal Liquidity Chart Component

Create `components/HorizontalLiquidityChart.tsx`:

```typescript
'use client'

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
} from 'recharts'
import { LiquidityBand } from '@/lib/types'

interface HorizontalLiquidityChartProps {
  bands: LiquidityBand[]
  currentTick: number
  securitySymbol: string
  usdcSymbol: string
  isUSDC0: boolean
  tvlUSD?: string
}

export default function HorizontalLiquidityChart({
  bands,
  currentTick,
  securitySymbol,
  usdcSymbol,
  isUSDC0,
  tvlUSD,
}: HorizontalLiquidityChartProps) {
  // Calculate total liquidity
  const totalLiquidity = bands.reduce((sum, band) => {
    const liquidityNum = parseFloat(band.liquidityActive.toString())
    return sum + liquidityNum
  }, 0)
  
  // Calculate scaling factor
  const tvlValue = tvlUSD ? parseFloat(tvlUSD) : totalLiquidity
  const scalingFactor = totalLiquidity > 0 ? tvlValue / totalLiquidity : 1
  
  // Prepare chart data
  const chartData = bands
    .map((band, index) => {
      const liquidityActiveNum = parseFloat(band.liquidityActive.toString())
      return {
        ...band,
        midPrice: (band.priceLowerUSD + band.priceUpperUSD) / 2,
        priceLabel: `$${((band.priceLowerUSD + band.priceUpperUSD) / 2).toFixed(2)}`,
        isCurrent: band.tickLower <= currentTick && band.tickUpper > currentTick,
        liquidityActive: liquidityActiveNum * scalingFactor,
        id: `price-${index}`,
      }
    })
    .filter((band) => band.liquidityActive >= 0.50)
    .sort((a, b) => b.midPrice - a.midPrice)
  
  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload[0]) {
      const data = payload[0].payload
      return (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 shadow-xl">
          <p className="text-sm font-semibold text-white mb-1">
            ${data.priceLowerUSD.toFixed(2)} ↔ ${data.priceUpperUSD.toFixed(2)}
          </p>
          <p className="text-xs text-gray-400">
            Liquidity: <span className="text-white font-semibold">
              ${data.liquidityActive.toLocaleString('en-US', {
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              })}
            </span>
          </p>
        </div>
      )
    }
    return null
  }
  
  const barHeight = Math.max(500, chartData.length * 25)
  
  return (
    <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
      <h3 className="text-lg font-semibold text-white mb-4">
        Price-Weighted Liquidity View
      </h3>
      <div style={{ height: `${barHeight}px`, maxHeight: '800px', overflowY: 'auto' }}>
        <ResponsiveContainer width="100%" height={barHeight}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 10, right: 90, left: 10, bottom: 30 }}
            barSize={18}
          >
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="#374151" 
              horizontal={false} 
              vertical={true} 
            />
            <XAxis
              type="number"
              tick={{ fill: '#9ca3af', fontSize: 12 }}
              tickFormatter={(value) => {
                if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`
                if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`
                if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}k`
                return `$${value.toFixed(0)}`
              }}
            />
            <YAxis
              type="category"
              dataKey="priceLabel"
              orientation="right"
              tick={{ fill: '#9ca3af', fontSize: 10 }}
              width={80}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="liquidityActive" radius={[0, 8, 8, 0]}>
              {chartData.map((entry, index) => {
                const currentPriceEntry = chartData.find(e => e.isCurrent)
                const currentPriceMid = currentPriceEntry?.midPrice
                
                let fill = '#10B981' // Green (above)
                if (entry.isCurrent) {
                  fill = '#F51E87' // Pink (current)
                } else if (currentPriceMid && entry.midPrice < currentPriceMid) {
                  fill = '#2172E5' // Blue (below)
                }
                
                return (
                  <Cell
                    key={`cell-${index}`}
                    fill={fill}
                    opacity={entry.isCurrent ? 1 : 0.8}
                    stroke={entry.isCurrent ? '#F51E87' : 'none'}
                    strokeWidth={entry.isCurrent ? 2 : 0}
                  />
                )
              })}
            </Bar>
            <Legend 
              verticalAlign="top" 
              align="right"
              height={24}
              content={() => (
                <div className="flex gap-4 justify-end mr-4">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-blue-600"></div>
                    <span className="text-xs text-gray-300">USDC</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded bg-green-500"></div>
                    <span className="text-xs text-gray-300">{securitySymbol}</span>
                  </div>
                </div>
              )}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
```

### Step 6: Integrate with Multi-Chart Dashboard

Create `app/dashboard/page.tsx`:

```typescript
'use client'

import { useState, useEffect } from 'react'
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import HorizontalLiquidityChart from '@/components/HorizontalLiquidityChart'
import { LiquidityBand } from '@/lib/types'

interface TimeSeriesData {
  timestamp: number
  price: number
  volume: number
  tvl: number
}

export default function ComplexDashboard() {
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesData[]>([])
  const [liquidityBands, setLiquidityBands] = useState<LiquidityBand[]>([])
  const [currentTick, setCurrentTick] = useState(0)
  const [tvlUSD, setTvlUSD] = useState('0')
  
  useEffect(() => {
    // Fetch data from API or compute
    fetchPoolData()
  }, [])
  
  async function fetchPoolData() {
    // Implementation: fetch pool data, compute liquidity bands
    // See poolData.ts service for full implementation
  }
  
  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <h1 className="text-3xl font-bold text-white mb-6">
        Pool Analytics Dashboard
      </h1>
      
      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Top Section: Price & Volume Combined Chart */}
        <div className="lg:col-span-3 bg-gray-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4">
            Price & Volume History
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={timeSeriesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="timestamp" 
                tick={{ fill: '#9ca3af' }}
                tickFormatter={(ts) => new Date(ts).toLocaleDateString()}
              />
              <YAxis 
                yAxisId="price" 
                orientation="left" 
                tick={{ fill: '#9ca3af' }}
                label={{ value: 'Price (USD)', angle: -90, position: 'insideLeft', fill: '#9ca3af' }}
              />
              <YAxis 
                yAxisId="volume" 
                orientation="right" 
                tick={{ fill: '#9ca3af' }}
                label={{ value: 'Volume (USD)', angle: 90, position: 'insideRight', fill: '#9ca3af' }}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                labelStyle={{ color: '#fff' }}
              />
              <Legend />
              <Line 
                yAxisId="price"
                type="monotone" 
                dataKey="price" 
                stroke="#8b5cf6" 
                strokeWidth={2}
                dot={false}
                name="Price"
              />
              <Bar 
                yAxisId="volume"
                dataKey="volume" 
                fill="#10b981" 
                opacity={0.6}
                name="Volume"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        
        {/* Bottom Left: TVL Chart */}
        <div className="lg:col-span-2 bg-gray-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4">
            Total Value Locked (TVL)
          </h2>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={timeSeriesData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis 
                dataKey="timestamp" 
                tick={{ fill: '#9ca3af' }}
                tickFormatter={(ts) => new Date(ts).toLocaleDateString()}
              />
              <YAxis 
                tick={{ fill: '#9ca3af' }}
                tickFormatter={(value) => `$${(value / 1e6).toFixed(1)}M`}
              />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151' }}
                labelStyle={{ color: '#fff' }}
                formatter={(value: number) => [`$${value.toLocaleString()}`, 'TVL']}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="tvl" 
                stroke="#f59e0b" 
                strokeWidth={3}
                dot={false}
                name="TVL"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        
        {/* Bottom Right: Horizontal Liquidity Bands */}
        <div className="lg:col-span-1">
          <HorizontalLiquidityChart
            bands={liquidityBands}
            currentTick={currentTick}
            securitySymbol="TOKEN"
            usdcSymbol="USDC"
            isUSDC0={true}
            tvlUSD={tvlUSD}
          />
        </div>
        
      </div>
    </div>
  )
}
```

### Step 7: Add Synchronized Interactions (Optional)

Enhance with cross-chart interactions:

```typescript
export default function InteractiveDashboard() {
  const [selectedPrice, setSelectedPrice] = useState<number | null>(null)
  const [selectedBandIndex, setSelectedBandIndex] = useState<number | null>(null)
  
  // When hovering over price chart, highlight corresponding liquidity band
  const handlePriceHover = (data: any) => {
    if (data && data.activePayload) {
      const price = data.activePayload[0].payload.price
      setSelectedPrice(price)
      
      // Find corresponding band
      const bandIndex = liquidityBands.findIndex(band => 
        price >= band.priceLowerUSD && price <= band.priceUpperUSD
      )
      setSelectedBandIndex(bandIndex)
    }
  }
  
  // Pass down to components
  return (
    <div>
      <ComposedChart 
        data={timeSeriesData}
        onMouseMove={handlePriceHover}
        onMouseLeave={() => setSelectedPrice(null)}
      >
        {/* ... chart configuration ... */}
      </ComposedChart>
      
      <HorizontalLiquidityChart
        bands={liquidityBands}
        currentTick={currentTick}
        highlightedBandIndex={selectedBandIndex}
        {...otherProps}
      />
    </div>
  )
}
```

Then update `HorizontalLiquidityChart` to accept and use `highlightedBandIndex`:

```typescript
interface HorizontalLiquidityChartProps {
  // ... existing props
  highlightedBandIndex?: number | null
}

export default function HorizontalLiquidityChart({
  bands,
  currentTick,
  highlightedBandIndex,
  // ... other props
}: HorizontalLiquidityChartProps) {
  // ... existing code
  
  <Bar dataKey="liquidityActive" radius={[0, 8, 8, 0]}>
    {chartData.map((entry, index) => {
      // ... color determination logic
      
      // Add highlight effect
      const isHighlighted = highlightedBandIndex === index
      
      return (
        <Cell
          key={`cell-${index}`}
          fill={fill}
          opacity={isHighlighted ? 1 : entry.isCurrent ? 1 : 0.8}
          stroke={isHighlighted ? '#fff' : entry.isCurrent ? '#F51E87' : 'none'}
          strokeWidth={isHighlighted ? 3 : entry.isCurrent ? 2 : 0}
        />
      )
    })}
  </Bar>
}
```

---

## Advanced Customization

### 1. Custom Color Schemes

```typescript
// Define color scheme
const COLOR_SCHEME = {
  abovePrice: '#10B981',  // Green
  currentPrice: '#F51E87', // Pink
  belowPrice: '#2172E5',   // Blue
  // Or use gradients
  abovePriceGradient: ['#10B981', '#34D399'],
  belowPriceGradient: ['#2172E5', '#3B82F6']
}

// Apply gradient based on distance from current price
function getColorWithGradient(entry: any, currentPriceMid: number) {
  if (entry.isCurrent) return COLOR_SCHEME.currentPrice
  
  const priceDiff = Math.abs(entry.midPrice - currentPriceMid)
  const maxDiff = Math.max(...chartData.map(e => Math.abs(e.midPrice - currentPriceMid)))
  const intensity = priceDiff / maxDiff
  
  if (entry.midPrice > currentPriceMid) {
    // Interpolate between light and dark green
    return interpolateColor('#34D399', '#10B981', intensity)
  } else {
    // Interpolate between light and dark blue
    return interpolateColor('#3B82F6', '#2172E5', intensity)
  }
}
```

### 2. Logarithmic Scale for Large Value Ranges

```typescript
<XAxis
  type="number"
  scale="log"
  domain={['auto', 'auto']}
  tick={{ fill: '#9ca3af', fontSize: 12 }}
  tickFormatter={(value) => `$${(value / 1e6).toFixed(1)}M`}
/>
```

### 3. Animated Transitions

```typescript
import { motion } from 'framer-motion'

// Wrap bars with animation
<Bar dataKey="liquidityActive" radius={[0, 8, 8, 0]} isAnimationActive={true}>
  {chartData.map((entry, index) => (
    <Cell
      key={`cell-${index}`}
      fill={determineColor(entry)}
      // Recharts handles animation internally
    />
  ))}
</Bar>
```

### 4. Responsive Breakpoints

```typescript
const useResponsiveHeight = (numBands: number) => {
  const [isMobile, setIsMobile] = useState(false)
  
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])
  
  return isMobile 
    ? Math.max(300, numBands * 15) 
    : Math.max(500, numBands * 25)
}

// In component
const barHeight = useResponsiveHeight(chartData.length)
```

### 5. Export to Image

```typescript
import html2canvas from 'html2canvas'

async function exportChartAsImage(elementId: string) {
  const element = document.getElementById(elementId)
  if (!element) return
  
  const canvas = await html2canvas(element)
  const image = canvas.toDataURL('image/png')
  
  // Download
  const link = document.createElement('a')
  link.href = image
  link.download = 'liquidity-chart.png'
  link.click()
}

// Add button
<button onClick={() => exportChartAsImage('liquidity-chart')}>
  Export Chart
</button>
```

---

## Performance Optimization

### 1. Memoization

```typescript
import { useMemo } from 'react'

export default function HorizontalLiquidityChart({ bands, currentTick, ... }) {
  const chartData = useMemo(() => {
    return bands
      .map((band, index) => ({
        // ... transformation logic
      }))
      .filter(band => band.liquidityActive >= 0.50)
      .sort((a, b) => b.midPrice - a.midPrice)
  }, [bands, currentTick, tvlUSD])
  
  const barHeight = useMemo(() => {
    return Math.max(500, chartData.length * 25)
  }, [chartData.length])
  
  // ... rest of component
}
```

### 2. Virtualization for Large Datasets

For charts with 500+ bands:

```typescript
import { FixedSizeList as List } from 'react-window'

export default function VirtualizedLiquidityChart({ bands, ... }) {
  const Row = ({ index, style }: any) => {
    const band = chartData[index]
    return (
      <div style={style}>
        {/* Render individual bar */}
        <div 
          style={{
            width: `${(band.liquidityActive / maxLiquidity) * 100}%`,
            height: '20px',
            backgroundColor: determineColor(band)
          }}
        />
      </div>
    )
  }
  
  return (
    <List
      height={600}
      itemCount={chartData.length}
      itemSize={25}
      width="100%"
    >
      {Row}
    </List>
  )
}
```

### 3. Debounced Interactions

```typescript
import { useMemo, useCallback } from 'react'
import debounce from 'lodash/debounce'

const debouncedHandleHover = useMemo(
  () => debounce((data: any) => {
    // Handle hover logic
    console.log('Hovered:', data)
  }, 100),
  []
)
```

### 4. Lazy Loading

```typescript
import dynamic from 'next/dynamic'

const HorizontalLiquidityChart = dynamic(
  () => import('@/components/HorizontalLiquidityChart'),
  { 
    ssr: false,
    loading: () => <div>Loading chart...</div>
  }
)
```

---

## Troubleshooting

### Issue 1: JSBI Compatibility Errors

**Problem**: `TypeError: Cannot convert a Symbol value to a number`

**Solution**: Always convert JSBI to string first, then to number:

```typescript
// ❌ Wrong
const value = Number(jsbiValue)

// ✅ Correct
const value = parseFloat(jsbiValue.toString())
```

### Issue 2: Bars Not Displaying

**Problem**: Bars appear but have zero width

**Solution**: Check data format and ensure numeric values:

```typescript
// Verify data
console.log('Chart data sample:', chartData.slice(0, 3))
console.log('Data types:', typeof chartData[0].liquidityActive)

// Ensure numeric
liquidityActive: Number(liquidityActiveNum * scalingFactor)
```

### Issue 3: Y-axis Labels Overlapping

**Problem**: Price labels overlap when many bands exist

**Solution**: Adjust tick frequency or font size:

```typescript
<YAxis
  type="category"
  dataKey="priceLabel"
  orientation="right"
  tick={{ fill: '#9ca3af', fontSize: 8 }}  // Smaller font
  interval={Math.floor(chartData.length / 20)}  // Show fewer labels
  width={80}
/>
```

### Issue 4: Chart Not Responsive

**Problem**: Chart doesn't resize with window

**Solution**: Ensure ResponsiveContainer wraps chart:

```typescript
<div style={{ width: '100%', height: barHeight }}>
  <ResponsiveContainer width="100%" height="100%">
    <BarChart {...props}>
      {/* ... */}
    </BarChart>
  </ResponsiveContainer>
</div>
```

### Issue 5: Colors Not Matching Current Price

**Problem**: Color logic incorrect

**Solution**: Debug tick comparison:

```typescript
console.log('Current tick:', currentTick)
console.log('Band ticks:', band.tickLower, band.tickUpper)
console.log('Is current?', band.tickLower <= currentTick && band.tickUpper > currentTick)

// Ensure inclusive/exclusive boundaries are correct
const isCurrent = band.tickLower <= currentTick && band.tickUpper > currentTick
```

### Issue 6: Performance Degradation with Large Datasets

**Problem**: Chart lags with 1000+ bands

**Solutions**:
1. Filter more aggressively: `filter(band => band.liquidityActive >= 10)`
2. Limit displayed bands: `.slice(0, 200)`
3. Implement virtualization (see Performance section)
4. Use `isAnimationActive={false}` on Bar component

---

## Complete Integration Example

Here's a complete, production-ready example combining everything:

```typescript
'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import HorizontalLiquidityChart from '@/components/HorizontalLiquidityChart'
import { LiquidityBand } from '@/lib/types'
import { computeActiveLiquidityBands } from '@/lib/uniswap/activeLiquidity'

interface ComplexDashboardProps {
  poolAddress: string
  chainId: number
}

export default function ComplexDashboard({ 
  poolAddress, 
  chainId 
}: ComplexDashboardProps) {
  // State management
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timeSeriesData, setTimeSeriesData] = useState<any[]>([])
  const [liquidityBands, setLiquidityBands] = useState<LiquidityBand[]>([])
  const [currentTick, setCurrentTick] = useState(0)
  const [tvlUSD, setTvlUSD] = useState('0')
  const [selectedTimestamp, setSelectedTimestamp] = useState<number | null>(null)
  const [hoveredBandIndex, setHoveredBandIndex] = useState<number | null>(null)
  
  // Fetch and compute data
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)
        
        // Fetch pool data (price, volume, TVL history)
        const timeSeriesResponse = await fetch(
          `/api/pool/${poolAddress}/timeseries?chainId=${chainId}`
        )
        const timeSeries = await timeSeriesResponse.json()
        setTimeSeriesData(timeSeries)
        
        // Fetch current pool state for liquidity bands
        const poolStateResponse = await fetch(
          `/api/pool/${poolAddress}/state?chainId=${chainId}`
        )
        const poolState = await poolStateResponse.json()
        
        // Compute liquidity bands
        const bands = computeActiveLiquidityBands(
          poolState.tick,
          poolState.liquidity,
          poolState.tickSpacing,
          poolState.token0,
          poolState.token1,
          300, // numSurroundingTicks
          poolState.ticks,
          poolState.isUSDC0
        )
        
        setLiquidityBands(bands)
        setCurrentTick(poolState.tick)
        setTvlUSD(poolState.tvlUSD)
        setLoading(false)
      } catch (err) {
        console.error('Error fetching data:', err)
        setError(err.message)
        setLoading(false)
      }
    }
    
    fetchData()
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [poolAddress, chainId])
  
  // Memoized chart data
  const chartData = useMemo(() => {
    return timeSeriesData.map(d => ({
      ...d,
      timestamp: new Date(d.timestamp).getTime(),
    }))
  }, [timeSeriesData])
  
  // Cross-chart interaction handlers
  const handlePriceChartHover = useCallback((data: any) => {
    if (data && data.activePayload) {
      const timestamp = data.activePayload[0].payload.timestamp
      setSelectedTimestamp(timestamp)
    }
  }, [])
  
  const handleBandHover = useCallback((bandIndex: number | null) => {
    setHoveredBandIndex(bandIndex)
  }, [])
  
  // Loading and error states
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-white text-xl">Loading dashboard...</div>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-500 text-xl">Error: {error}</div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            Pool Analytics Dashboard
          </h1>
          <p className="text-gray-400">
            Real-time visualization of price, volume, TVL, and liquidity distribution
          </p>
        </div>
        
        {/* Chart Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          
          {/* Top: Price & Volume */}
          <div className="xl:col-span-3 bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50">
            <h2 className="text-2xl font-semibold text-white mb-4 flex items-center gap-2">
              <span className="w-1 h-6 bg-purple-500 rounded"></span>
              Price & Volume History
            </h2>
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart 
                data={chartData}
                onMouseMove={handlePriceChartHover}
                onMouseLeave={() => setSelectedTimestamp(null)}
              >
                <defs>
                  <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  dataKey="timestamp" 
                  tick={{ fill: '#9ca3af', fontSize: 11 }}
                  tickFormatter={(ts) => {
                    const date = new Date(ts)
                    return `${date.getMonth()+1}/${date.getDate()}`
                  }}
                />
                <YAxis 
                  yAxisId="price" 
                  orientation="left" 
                  tick={{ fill: '#9ca3af', fontSize: 11 }}
                  label={{ 
                    value: 'Price (USD)', 
                    angle: -90, 
                    position: 'insideLeft', 
                    fill: '#8b5cf6',
                    style: { fontWeight: 600 }
                  }}
                  tickFormatter={(val) => `$${val.toFixed(2)}`}
                />
                <YAxis 
                  yAxisId="volume" 
                  orientation="right" 
                  tick={{ fill: '#9ca3af', fontSize: 11 }}
                  label={{ 
                    value: 'Volume (USD)', 
                    angle: 90, 
                    position: 'insideRight', 
                    fill: '#10b981',
                    style: { fontWeight: 600 }
                  }}
                  tickFormatter={(val) => `$${(val/1e6).toFixed(1)}M`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1f2937', 
                    border: '1px solid #374151',
                    borderRadius: '8px'
                  }}
                  labelStyle={{ color: '#fff', fontWeight: 600 }}
                  formatter={(value: number, name: string) => {
                    if (name === 'Price') return [`$${value.toFixed(4)}`, name]
                    if (name === 'Volume') return [`$${value.toLocaleString()}`, name]
                    return [value, name]
                  }}
                  labelFormatter={(ts) => new Date(ts).toLocaleString()}
                />
                <Legend 
                  wrapperStyle={{ paddingTop: '20px' }}
                  iconType="line"
                />
                <Line 
                  yAxisId="price"
                  type="monotone" 
                  dataKey="price" 
                  stroke="#8b5cf6" 
                  strokeWidth={3}
                  dot={false}
                  name="Price"
                  fill="url(#priceGradient)"
                  fillOpacity={1}
                />
                <Bar 
                  yAxisId="volume"
                  dataKey="volume" 
                  fill="#10b981" 
                  opacity={0.5}
                  name="Volume"
                  radius={[4, 4, 0, 0]}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          
          {/* Bottom Left: TVL */}
          <div className="xl:col-span-2 bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 border border-gray-700/50">
            <h2 className="text-2xl font-semibold text-white mb-4 flex items-center gap-2">
              <span className="w-1 h-6 bg-yellow-500 rounded"></span>
              Total Value Locked
            </h2>
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={chartData}>
                <defs>
                  <linearGradient id="tvlGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis 
                  dataKey="timestamp" 
                  tick={{ fill: '#9ca3af', fontSize: 11 }}
                  tickFormatter={(ts) => {
                    const date = new Date(ts)
                    return `${date.getMonth()+1}/${date.getDate()}`
                  }}
                />
                <YAxis 
                  tick={{ fill: '#9ca3af', fontSize: 11 }}
                  tickFormatter={(value) => `$${(value / 1e6).toFixed(1)}M`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1f2937', 
                    border: '1px solid #374151',
                    borderRadius: '8px'
                  }}
                  labelStyle={{ color: '#fff', fontWeight: 600 }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, 'TVL']}
                  labelFormatter={(ts) => new Date(ts).toLocaleString()}
                />
                <Legend iconType="line" />
                <Line 
                  type="monotone" 
                  dataKey="tvl" 
                  stroke="#f59e0b" 
                  strokeWidth={4}
                  dot={false}
                  name="TVL"
                  fill="url(#tvlGradient)"
                  fillOpacity={1}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          
          {/* Bottom Right: Liquidity Bands */}
          <div className="xl:col-span-1">
            <HorizontalLiquidityChart
              bands={liquidityBands}
              currentTick={currentTick}
              securitySymbol="TOKEN"
              usdcSymbol="USDC"
              isUSDC0={true}
              tvlUSD={tvlUSD}
              onBandHover={handleBandHover}
              highlightedBandIndex={hoveredBandIndex}
            />
          </div>
          
        </div>
        
        {/* Footer Stats */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700/50">
            <p className="text-gray-400 text-sm">Current Price</p>
            <p className="text-white text-2xl font-bold">
              ${chartData[chartData.length - 1]?.price.toFixed(4) || '0.00'}
            </p>
          </div>
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700/50">
            <p className="text-gray-400 text-sm">24h Volume</p>
            <p className="text-white text-2xl font-bold">
              ${(chartData[chartData.length - 1]?.volume / 1e6).toFixed(2) || '0'}M
            </p>
          </div>
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700/50">
            <p className="text-gray-400 text-sm">TVL</p>
            <p className="text-white text-2xl font-bold">
              ${(parseFloat(tvlUSD) / 1e6).toFixed(2)}M
            </p>
          </div>
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-4 border border-gray-700/50">
            <p className="text-gray-400 text-sm">Liquidity Bands</p>
            <p className="text-white text-2xl font-bold">
              {liquidityBands.length}
            </p>
          </div>
        </div>
        
      </div>
    </div>
  )
}
```

---

## Summary

This guide provides a **complete, production-ready implementation** for integrating the horizontal liquidity band chart with complex multi-chart visualizations. Key takeaways:

1. **Unique Architecture**: Horizontal bar layout with price-based Y-axis
2. **Mathematical Foundation**: Uniswap V3 liquidity calculation with tick mechanics
3. **Flexible Integration**: Works standalone or alongside line/bar charts
4. **Rich Interactions**: Cross-chart hovering, highlighting, and synchronization
5. **Performance Optimized**: Memoization, virtualization, and lazy loading
6. **Production-Ready**: Error handling, loading states, responsive design

Use this guide as a **standalone reference** to implement the horizontal liquidity visualization in any React/Next.js application with Recharts.
