/**
 * Minimal script to run fetchTokenizedStockPools and verify throw-on-subgraph-failure.
 * Run: npx tsx scripts/run-fetcher.ts
 */

async function main() {
  const { fetchTokenizedStockPools } = await import('../lib/cache/poolFetchers');
  try {
    const pools = await fetchTokenizedStockPools();
    console.log('Pools:', pools.length);
  } catch (e: unknown) {
    const err = e as Error & { statusCode?: number };
    console.error('Error:', err.message, '| statusCode:', err.statusCode);
    process.exit(1);
  }
}

main();
