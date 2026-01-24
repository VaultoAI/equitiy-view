/**
 * Find SLV Pool Script
 * Searches for the actual SLV-USDC pool address
 */

const SLV_TOKEN_ADDRESS = '0xf3e4872e6a4cf365888d93b6146a2baa7348f1a4'; // SLVon token
const USDC_ADDRESS = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'; // USDC

async function findSLVPool() {
  console.log('🔍 Searching for SLV-USDC Pool...\n');
  console.log(`SLV Token: ${SLV_TOKEN_ADDRESS}`);
  console.log(`USDC Token: ${USDC_ADDRESS}\n`);

  const query = `
    query FindSLVPools {
      pools(
        where: {
          or: [
            { token0: "${SLV_TOKEN_ADDRESS.toLowerCase()}", token1: "${USDC_ADDRESS.toLowerCase()}" },
            { token0: "${USDC_ADDRESS.toLowerCase()}", token1: "${SLV_TOKEN_ADDRESS.toLowerCase()}" }
          ]
        }
        orderBy: totalValueLockedUSD
        orderDirection: desc
        first: 10
      ) {
        id
        token0 {
          id
          symbol
          name
        }
        token1 {
          id
          symbol
          name
        }
        feeTier
        totalValueLockedUSD
        volumeUSD
        liquidity
      }
    }
  `;

  const graphqlUrl = 'https://gateway.thegraph.com/api/subgraphs/id/5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV';

  try {
    console.log(`📡 Querying The Graph...`);
    const response = await fetch(graphqlUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();

    if (result.errors) {
      console.error('❌ GraphQL errors:', result.errors);
      return;
    }

    const pools = result.data?.pools || [];
    console.log(`\n✅ Found ${pools.length} SLV-USDC pools:\n`);

    if (pools.length === 0) {
      console.log('⚠️  No pools found. The token might not have any Uniswap V3 pools yet.');
    } else {
      pools.forEach((pool: any, index: number) => {
        console.log(`Pool ${index + 1}:`);
        console.log(`  Address: ${pool.id}`);
        console.log(`  Tokens: ${pool.token0.symbol}/${pool.token1.symbol}`);
        console.log(`  Fee Tier: ${pool.feeTier / 10000}%`);
        console.log(`  TVL: $${parseFloat(pool.totalValueLockedUSD).toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
        console.log(`  Volume: $${parseFloat(pool.volumeUSD).toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
        console.log(`  Liquidity: ${pool.liquidity}`);
        console.log();
      });

      console.log(`\n🔗 To view in app, use:`);
      console.log(`http://localhost:3000/pools/ethereum/${pools[0].id}`);
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

findSLVPool();
