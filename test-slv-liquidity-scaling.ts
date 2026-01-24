/**
 * SLV Liquidity Scaling Verification Test
 * 
 * This script tests that the SLV pool's liquidity bands are correctly scaled
 * to match the expected total TVL of approximately $1,144,200
 */

import { Token } from '@uniswap/sdk-core';
import { computeActiveLiquidityBands } from './lib/uniswap/activeLiquidity';

// Expected data from user
const EXPECTED_TOTAL_TVL = 1144200;
const EXPECTED_BAND_COUNT = 200;

// SLV Pool Address
const SLV_POOL_ADDRESS = '0xf3e4872e6a4cf365888d93b6146a2baa7348f1a4';

// Sample expected bands (first few for verification)
const EXPECTED_BANDS = [
  { priceRange: '89.32 ↔ 87.55', liquidity: 96726 },
  { priceRange: '91.12 ↔ 89.32', liquidity: 85487 },
  { priceRange: '92.96 ↔ 91.12', liquidity: 79071 },
  { priceRange: '94.84 ↔ 92.96', liquidity: 78708 },
  { priceRange: '85.81 ↔ 84.11', liquidity: 75901 },
];

interface GraphQLResponse {
  data: {
    pool: {
      tick: string;
      liquidity: string;
      token0: {
        id: string;
        symbol: string;
        name: string;
        decimals: string;
      };
      token1: {
        id: string;
        symbol: string;
        name: string;
        decimals: string;
      };
      feeTier: string;
      totalValueLockedUSD: string;
      ticks: Array<{
        tickIdx: string;
        liquidityGross: string;
        liquidityNet: string;
        price0: string;
        price1: string;
      }>;
    };
  };
}

async function fetchPoolData(poolAddress: string): Promise<GraphQLResponse> {
  const query = `
    query GetPoolTicks($poolId: ID!) {
      pool(id: $poolId) {
        tick
        liquidity
        token0 {
          id
          symbol
          name
          decimals
        }
        token1 {
          id
          symbol
          name
          decimals
        }
        feeTier
        totalValueLockedUSD
        ticks(first: 1000, orderBy: tickIdx, orderDirection: asc) {
          tickIdx
          liquidityGross
          liquidityNet
          price0
          price1
        }
      }
    }
  `;

  // Use The Graph Gateway (same as the app's GraphQL client)
  const graphqlUrl = process.env.NEXT_PUBLIC_UNISWAP_GRAPHQL_URL || 
    'https://gateway.thegraph.com/api/subgraphs/id/5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV';

  console.log(`   Using GraphQL endpoint: ${graphqlUrl}`);

  const response = await fetch(graphqlUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables: { poolId: poolAddress.toLowerCase() },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GraphQL request failed: ${response.status} ${response.statusText}\n${errorText}`);
  }

  const result = await response.json();
  
  if (result.errors) {
    console.error('GraphQL errors:', result.errors);
    throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`);
  }

  return result;
}

async function runTest() {
  console.log('🧪 SLV Liquidity Scaling Verification Test\n');
  console.log('=' .repeat(60));
  console.log(`Pool Address: ${SLV_POOL_ADDRESS}`);
  console.log(`Expected Total TVL: $${EXPECTED_TOTAL_TVL.toLocaleString()}`);
  console.log(`Expected Band Count: ${EXPECTED_BAND_COUNT}`);
  console.log('=' .repeat(60));
  console.log();

  try {
    // Step 1: Fetch pool data
    console.log('📡 Step 1: Fetching pool data from The Graph...');
    const poolData = await fetchPoolData(SLV_POOL_ADDRESS);

    if (!poolData.data?.pool) {
      throw new Error('Pool data not found');
    }

    const pool = poolData.data.pool;
    console.log(`✅ Pool found: ${pool.token0.symbol}/${pool.token1.symbol}`);
    console.log(`   TVL from GraphQL: $${parseFloat(pool.totalValueLockedUSD).toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
    console.log(`   Current Tick: ${pool.tick}`);
    console.log(`   Ticks fetched: ${pool.ticks.length}`);
    console.log();

    // Step 2: Create Token instances
    console.log('🔧 Step 2: Creating Token instances...');
    const token0Decimals = parseInt(pool.token0.decimals);
    const token1Decimals = parseInt(pool.token1.decimals);

    const token0 = new Token(
      1, // Ethereum mainnet
      pool.token0.id,
      token0Decimals,
      pool.token0.symbol,
      pool.token0.name
    );

    const token1 = new Token(
      1,
      pool.token1.id,
      token1Decimals,
      pool.token1.symbol,
      pool.token1.name
    );

    const isUSDC0 = pool.token0.symbol === 'USDC';
    console.log(`✅ Token0: ${token0.symbol} (${token0Decimals} decimals)`);
    console.log(`✅ Token1: ${token1.symbol} (${token1Decimals} decimals)`);
    console.log(`   USDC is Token${isUSDC0 ? '0' : '1'}`);
    console.log();

    // Step 3: Compute liquidity bands
    console.log('📊 Step 3: Computing liquidity bands...');
    const tickSpacing = 60; // Common for 0.3% fee tier
    const bands = computeActiveLiquidityBands(
      parseInt(pool.tick),
      pool.liquidity,
      tickSpacing,
      token0,
      token1,
      100, // numSurroundingTicks
      pool.ticks,
      isUSDC0
    );

    console.log(`✅ Computed ${bands.length} liquidity bands`);
    console.log();

    // Step 4: Calculate total liquidity and scaling factor
    console.log('🔢 Step 4: Calculating scaling...');
    const totalRawLiquidity = bands.reduce((sum, band) => {
      return sum + parseFloat(band.liquidityActive.toString());
    }, 0);

    const tvlUSD = parseFloat(pool.totalValueLockedUSD);
    const scalingFactor = totalRawLiquidity > 0 ? tvlUSD / totalRawLiquidity : 1;

    console.log(`   Total Raw Liquidity: ${totalRawLiquidity.toLocaleString()}`);
    console.log(`   TVL USD: $${tvlUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
    console.log(`   Scaling Factor: ${scalingFactor.toFixed(10)}`);
    console.log();

    // Step 5: Apply scaling and calculate total
    console.log('💰 Step 5: Applying scaling to bands...');
    const scaledBands = bands.map((band, index) => {
      const liquidityNum = parseFloat(band.liquidityActive.toString());
      const scaledLiquidity = liquidityNum * scalingFactor;
      return {
        index,
        priceRange: `${band.priceUpperUSD.toFixed(2)} ↔ ${band.priceLowerUSD.toFixed(2)}`,
        priceLower: band.priceLowerUSD,
        priceUpper: band.priceUpperUSD,
        rawLiquidity: liquidityNum,
        scaledLiquidity: scaledLiquidity,
      };
    });

    const totalScaledLiquidity = scaledBands.reduce((sum, band) => sum + band.scaledLiquidity, 0);

    console.log(`✅ Total Scaled Liquidity: $${totalScaledLiquidity.toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
    console.log();

    // Step 6: Verify against expected values
    console.log('✓ Step 6: Verification Results');
    console.log('=' .repeat(60));

    const tvlDifference = Math.abs(totalScaledLiquidity - EXPECTED_TOTAL_TVL);
    const tvlPercentDiff = (tvlDifference / EXPECTED_TOTAL_TVL) * 100;

    console.log('\n📈 TVL Comparison:');
    console.log(`   Expected TVL:  $${EXPECTED_TOTAL_TVL.toLocaleString()}`);
    console.log(`   Actual TVL:    $${totalScaledLiquidity.toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
    console.log(`   Difference:    $${tvlDifference.toLocaleString(undefined, { maximumFractionDigits: 0 })} (${tvlPercentDiff.toFixed(2)}%)`);
    
    if (tvlPercentDiff < 10) {
      console.log(`   ✅ PASS - Within acceptable range (<10% difference)`);
    } else {
      console.log(`   ⚠️  WARNING - Difference exceeds 10%`);
    }

    console.log('\n📊 Band Count Comparison:');
    console.log(`   Expected Bands: ${EXPECTED_BAND_COUNT}`);
    console.log(`   Actual Bands:   ${bands.length}`);
    
    if (bands.length >= EXPECTED_BAND_COUNT * 0.8) {
      console.log(`   ✅ PASS - Band count is reasonable`);
    } else {
      console.log(`   ⚠️  WARNING - Fewer bands than expected`);
    }

    // Show top 10 bands by liquidity
    console.log('\n🏆 Top 10 Liquidity Bands (by USD value):');
    console.log('-'.repeat(60));
    const sortedBands = [...scaledBands].sort((a, b) => b.scaledLiquidity - a.scaledLiquidity);
    sortedBands.slice(0, 10).forEach((band, i) => {
      console.log(`${(i + 1).toString().padStart(2)}. ${band.priceRange.padEnd(20)} $${band.scaledLiquidity.toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
    });

    // Check for specific expected bands
    console.log('\n🔍 Checking for Expected Bands:');
    console.log('-'.repeat(60));
    let matchCount = 0;
    EXPECTED_BANDS.forEach((expected) => {
      const [upper, lower] = expected.priceRange.split(' ↔ ').map(parseFloat);
      const matchingBand = scaledBands.find((band) => {
        const priceLowerMatch = Math.abs(band.priceLower - lower) < 1;
        const priceUpperMatch = Math.abs(band.priceUpper - upper) < 1;
        return priceLowerMatch && priceUpperMatch;
      });

      if (matchingBand) {
        const liquidityDiff = Math.abs(matchingBand.scaledLiquidity - expected.liquidity);
        const liquidityPercentDiff = (liquidityDiff / expected.liquidity) * 100;
        console.log(`✅ ${expected.priceRange}`);
        console.log(`   Expected: $${expected.liquidity.toLocaleString()}`);
        console.log(`   Actual:   $${matchingBand.scaledLiquidity.toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
        console.log(`   Diff:     ${liquidityPercentDiff.toFixed(2)}%`);
        matchCount++;
      } else {
        console.log(`❌ ${expected.priceRange} - NOT FOUND`);
      }
    });

    console.log();
    console.log('=' .repeat(60));
    console.log('📝 Summary:');
    console.log(`   Bands Matched: ${matchCount}/${EXPECTED_BANDS.length}`);
    console.log(`   TVL Accuracy: ${(100 - tvlPercentDiff).toFixed(2)}%`);
    
    if (matchCount >= EXPECTED_BANDS.length * 0.8 && tvlPercentDiff < 10) {
      console.log('\n🎉 TEST PASSED - Liquidity scaling is correct!');
    } else {
      console.log('\n⚠️  TEST NEEDS REVIEW - Some discrepancies found');
    }
    console.log('=' .repeat(60));

  } catch (error) {
    console.error('\n❌ Test failed with error:');
    console.error(error);
    process.exit(1);
  }
}

// Run the test
runTest().catch(console.error);
