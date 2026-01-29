/**
 * Comprehensive test for tokenized-stock-pools API and Pool Fetchers.
 * Reproduces "bad indexers" / indexing_error failures and documents root cause.
 *
 * Run: npx tsx scripts/test-tokenized-stock-pools-api.ts
 *
 * Loads .env.local when present (so THE_GRAPH_API_KEY is used if set).
 */

import * as fs from 'fs';
import * as path from 'path';

try {
  const p = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(p)) {
    fs.readFileSync(p, 'utf8')
      .split('\n')
      .forEach((line: string) => {
        const m = line.match(/^([^#=]+)=(.*)$/);
        if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
      });
  }
} catch {
  /* ignore */
}

const TOP_V3_POOLS_QUERY = `
  query TopV3Pools($first: Int!, $tokenAddress: String!) {
    pools(
      first: $first
      where: {
        or: [
          { token0_: { id: $tokenAddress } }
          { token1_: { id: $tokenAddress } }
        ]
      }
      orderBy: totalValueLockedUSD
      orderDirection: desc
    ) {
      id
      token0 { id symbol name decimals }
      token1 { id symbol name decimals }
      feeTier
      totalValueLockedUSD
      txCount
    }
  }
`;

const SLV_TOKEN = '0xf3e4872e6a4cf365888d93b6146a2baa7348f1a4';

interface TestResult {
  name: string;
  url: string;
  ok: boolean;
  status: number;
  statusText: string;
  hasData: boolean;
  dataPoolCount?: number;
  errors?: unknown[];
  errorMessage?: string;
  rawErrorPreview?: string;
}

async function queryGraphql(
  url: string,
  variables: { first: number; tokenAddress: string },
  headers: Record<string, string> = {}
): Promise<{ ok: boolean; status: number; statusText: string; body: unknown }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ query: TOP_V3_POOLS_QUERY, variables }),
  });
  const body = (await res.json()) as { data?: { pools?: unknown[] }; errors?: unknown[] };
  return { ok: res.ok, status: res.status, statusText: res.statusText, body };
}

function redactUrl(url: string): string {
  return url.replace(/\/api\/[^/]+\/subgraphs\//, '/api/***/subgraphs/');
}

function summarizeResult(
  name: string,
  url: string,
  res: { ok: boolean; status: number; statusText: string; body: unknown }
): TestResult {
  const b = res.body as { data?: { pools?: unknown[] }; errors?: unknown[] };
  const hasData = Boolean(b?.data?.pools);
  const dataPoolCount = b?.data?.pools?.length ?? 0;
  const errors = b?.errors;
  let errorMessage: string | undefined;
  let rawErrorPreview: string | undefined;

  if (errors?.length) {
    const first = errors[0] as { message?: string };
    errorMessage = typeof first?.message === 'string' ? first.message : JSON.stringify(first);
    rawErrorPreview = errorMessage.slice(0, 200);
  }

  return {
    name,
    url: redactUrl(url),
    ok: res.ok,
    status: res.status,
    statusText: res.statusText,
    hasData,
    dataPoolCount,
    errors: errors?.length ? errors : undefined,
    errorMessage,
    rawErrorPreview,
  };
}

async function runTests(): Promise<void> {
  console.log('=== Tokenized Stock Pools API – Comprehensive Tests ===\n');

  const graphApiKey = process.env.NEXT_PUBLIC_THE_GRAPH_API_KEY || process.env.THE_GRAPH_API_KEY;
  const customUrl = process.env.NEXT_PUBLIC_UNISWAP_GRAPHQL_URL;

  const gatewayBase = 'https://gateway.thegraph.com/api/subgraphs/id/5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV';
  const endpoints: { name: string; url: string; headers?: Record<string, string> }[] = [];

  if (customUrl) {
    endpoints.push({ name: 'Custom (NEXT_PUBLIC_UNISWAP_GRAPHQL_URL)', url: customUrl });
  }
  if (graphApiKey) {
    endpoints.push({
      name: 'The Graph Gateway (Bearer auth, docs-recommended)',
      url: gatewayBase,
      headers: { Authorization: `Bearer ${graphApiKey}` },
    });
  }
  endpoints.push({
    name: 'The Graph Gateway (public, no key)',
    url: gatewayBase,
  });

  const goldskyEthereum = 'https://api.goldsky.com/api/public/project_cl8ylkiw00krx0hvza0qw17vn/subgraphs/uniswap-v3-ethereum/prod/gn';
  endpoints.push({ name: 'Goldsky Uniswap V3 Ethereum (prod)', url: goldskyEthereum });

  const variables = { first: 5, tokenAddress: SLV_TOKEN.toLowerCase() };
  const results: TestResult[] = [];

  for (const { name, url, headers = {} } of endpoints) {
    process.stdout.write(`Testing ${name}... `);
    try {
      const res = await queryGraphql(url, variables, headers);
      const r = summarizeResult(name, url, res);
      results.push(r);
      if (r.hasData && r.dataPoolCount && r.dataPoolCount > 0) {
        console.log(`OK (${r.dataPoolCount} pools)`);
      } else if (r.errors?.length) {
        console.log(`FAIL (GraphQL errors: bad indexers / indexing_error)`);
      } else {
        console.log(`OK but no pools (${r.status})`);
      }
    } catch (e) {
      const err = e as Error;
      results.push({
        name,
        url: redactUrl(url),
        ok: false,
        status: -1,
        statusText: '',
        hasData: false,
        errorMessage: err.message,
        rawErrorPreview: err.message?.slice(0, 200),
      });
      console.log(`ERROR: ${err.message?.slice(0, 80)}...`);
    }
  }

  console.log('\n--- Summary ---\n');

  const withPools = results.filter((r) => r.hasData && (r.dataPoolCount ?? 0) > 0);
  const withErrors = results.filter((r) => r.errors?.length || r.errorMessage);
  const badIndexers = results.filter(
    (r) =>
      typeof r.errorMessage === 'string' &&
      (r.errorMessage.includes('bad indexers') || r.errorMessage.includes('indexing_error') || r.errorMessage.includes('too far behind'))
  );

  if (withPools.length > 0) {
    console.log('Working endpoint(s):');
    withPools.forEach((r) => console.log(`  - ${r.name}: ${r.dataPoolCount} pools`));
  } else {
    console.log('No endpoint returned any pools.');
  }

  if (badIndexers.length > 0) {
    console.log('\n"Bad indexers" / The Graph indexer failures:');
    badIndexers.forEach((r) => {
      console.log(`  - ${r.name}`);
      console.log(`    URL: ${r.url}`);
      if (r.rawErrorPreview) console.log(`    Error: ${r.rawErrorPreview}...`);
    });
  }

  if (withErrors.length > 0 && withPools.length === 0) {
    console.log('\nAll endpoints failed. Root cause:');
    console.log('  The Graph Gateway uses decentralized indexers. When every indexer fails');
    console.log('  (too far behind, BadResponse(400), indexing_error, etc.), the Gateway');
    console.log('  returns HTTP 200 with { data: null, errors: ["bad indexers: ..."] }.');
    console.log('  The tokenized-stock-pools API now returns 503 (not 200 + empty pools)');
    console.log('  when it detects subgraph failure. See TOKENIZED_STOCK_POOLS_API_FAILURE.md.');
  }

  console.log('\n--- Full results ---\n');
  results.forEach((r) => {
    console.log(JSON.stringify(r, null, 2));
    console.log('');
  });
}

runTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
