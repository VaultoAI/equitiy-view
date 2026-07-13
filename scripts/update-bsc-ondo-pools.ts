/**
 * Generates a vendored snapshot of the deepest DEX pool per Ondo tokenized
 * equity on BNB Chain, written to `lib/pools/bscOndoPools.json`.
 *
 * BSC Ondo liquidity is spread across many DEXs (dnax, PancakeSwap v2/v3 &
 * Infinity, Uniswap v3/v4) with no single subgraph covering them. GeckoTerminal
 * aggregates all of them and reports each pool's USD reserve directly, so we use
 * its REST API here. It is rate-limited (~30 req/min, no key), so this runs as
 * an occasional generator (like `update:ondo-tokens`) rather than per request.
 * At runtime we only re-fetch live metrics for these specific pool addresses.
 *
 * Run: npx tsx scripts/update-bsc-ondo-pools.ts
 */
import * as fs from 'fs';
import * as path from 'path';
import { BSC_CHAIN_ID, ONDO_NON_EQUITY_ADDRESSES, type OndoTokenList } from '../lib/pools/ondoConfig';

const GT_BASE = 'https://api.geckoterminal.com/api/v2';
const NETWORK = 'bsc';
const REQ_DELAY_MS = 2200; // stay under ~30 req/min
const OUT_PATH = path.join(process.cwd(), 'lib/pools/bscOndoPools.json');
const TOKEN_LIST_PATH = path.join(process.cwd(), 'lib/pools/ondoTokenList.json');

// Real quote assets we accept, to keep the table trustworthy (excludes scam /
// junk pairs like ASX, STOCKIE, honeypots). Lowercased.
const QUOTE_WHITELIST: Record<string, string> = {
  '0x55d398326f99059ff775485246999027b3197955': 'USDT',
  '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d': 'USDC',
  '0x8d0d000ee44948fc98c9b98a4fa4921476f08b0d': 'USD1',
  '0x1f8955e640cbd9abc3c3bb408c9e2e1f5f20dfe6': 'USDon',
  '0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c': 'BTCB',
  '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c': 'WBNB',
  '0x2170ed0880ac9a755fd29b2688956bd959f933f8': 'ETH',
};

const MIN_RESERVE_USD = 100;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function gtFetch(url: string, attempt = 0): Promise<any> {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (res.status === 429 && attempt < 5) {
    const wait = 3000 * (attempt + 1);
    console.warn(`  429 rate-limited, waiting ${wait}ms...`);
    await sleep(wait);
    return gtFetch(url, attempt + 1);
  }
  if (!res.ok) throw new Error(`GT ${res.status} ${res.statusText} for ${url}`);
  return res.json();
}

interface GtPool {
  address: string;
  name: string;
  reserveUsd: number;
  volume24h: number;
  dex: string;
  quoteSymbol: string;
  quoteAddress: string;
  baseIsOndo: boolean;
}

function parsePool(p: any, ondoAddress: string): GtPool | null {
  const a = p.attributes || {};
  const rels = p.relationships || {};
  const dex = rels.dex?.data?.id || 'unknown';
  const baseId: string = (rels.base_token?.data?.id || '').replace(`${NETWORK}_`, '').toLowerCase();
  const quoteId: string = (rels.quote_token?.data?.id || '').replace(`${NETWORK}_`, '').toLowerCase();

  let quoteAddress: string | null = null;
  let baseIsOndo = false;
  if (baseId === ondoAddress && QUOTE_WHITELIST[quoteId]) {
    quoteAddress = quoteId;
    baseIsOndo = true;
  } else if (quoteId === ondoAddress && QUOTE_WHITELIST[baseId]) {
    quoteAddress = baseId;
    baseIsOndo = false;
  } else {
    return null;
  }

  return {
    address: (a.address || '').toLowerCase(),
    name: a.name || '',
    reserveUsd: parseFloat(a.reserve_in_usd || '0'),
    volume24h: parseFloat(a.volume_usd?.h24 || '0'),
    dex,
    quoteSymbol: QUOTE_WHITELIST[quoteAddress],
    quoteAddress,
    baseIsOndo,
  };
}

async function main() {
  const list = JSON.parse(fs.readFileSync(TOKEN_LIST_PATH, 'utf8')) as OndoTokenList;
  const tokens = (list.tokens || []).filter(
    (t) => t.chainId === BSC_CHAIN_ID && t.address && !ONDO_NON_EQUITY_ADDRESSES.has(t.address.toLowerCase())
  );
  console.log(`Scanning ${tokens.length} Ondo BSC equity tokens via GeckoTerminal...`);

  // Phase 1: cheap multi-token pass to find which tokens have ANY pool.
  const meta = new Map<string, { symbol: string; name: string }>();
  for (const t of tokens) meta.set(t.address.toLowerCase(), { symbol: t.symbol, name: t.name });

  const candidates: string[] = [];
  const chunks: string[][] = [];
  const addrs = tokens.map((t) => t.address);
  for (let i = 0; i < addrs.length; i += 30) chunks.push(addrs.slice(i, i + 30));

  for (let i = 0; i < chunks.length; i++) {
    const url = `${GT_BASE}/networks/${NETWORK}/tokens/multi/${chunks[i].join(',')}?include=top_pools`;
    try {
      const d = await gtFetch(url);
      for (const t of d.data || []) {
        const addr = (t.attributes?.address || '').toLowerCase();
        const hasPool = (t.relationships?.top_pools?.data || []).length > 0;
        if (addr && hasPool) candidates.push(addr);
      }
    } catch (e) {
      console.warn(`  phase1 chunk ${i} failed:`, (e as Error).message);
    }
    process.stdout.write(`\r  phase1 ${i + 1}/${chunks.length} — ${candidates.length} candidates`);
    await sleep(REQ_DELAY_MS);
  }
  console.log(`\nPhase 1 done: ${candidates.length} tokens have at least one pool.`);

  // Phase 2: per-candidate — fetch all pools, keep deepest whitelisted one.
  const results: any[] = [];
  for (let i = 0; i < candidates.length; i++) {
    const addr = candidates[i];
    const url = `${GT_BASE}/networks/${NETWORK}/tokens/${addr}/pools`;
    try {
      const d = await gtFetch(url);
      let best: GtPool | null = null;
      for (const p of d.data || []) {
        const parsed = parsePool(p, addr);
        if (!parsed || parsed.reserveUsd < MIN_RESERVE_USD) continue;
        if (!best || parsed.reserveUsd > best.reserveUsd) best = parsed;
      }
      if (best) {
        const m = meta.get(addr)!;
        results.push({
          ondoAddress: addr,
          ondoSymbol: m.symbol,
          ondoName: m.name,
          poolAddress: best.address,
          dex: best.dex,
          pairName: best.name,
          quoteSymbol: best.quoteSymbol,
          quoteAddress: best.quoteAddress,
          reserveUsd: best.reserveUsd,
          volume24h: best.volume24h,
        });
      }
    } catch (e) {
      console.warn(`  phase2 ${addr} failed:`, (e as Error).message);
    }
    process.stdout.write(`\r  phase2 ${i + 1}/${candidates.length} — ${results.length} pools kept`);
    await sleep(REQ_DELAY_MS);
  }
  console.log('');

  results.sort((a, b) => b.reserveUsd - a.reserveUsd);
  const out = {
    generatedAt: new Date().toISOString(),
    network: NETWORK,
    count: results.length,
    pools: results,
  };
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2));
  console.log(`\nWrote ${results.length} BSC Ondo pools to ${OUT_PATH}`);
  console.log('\nTop 15:');
  for (const r of results.slice(0, 15)) {
    console.log(
      `  ${r.ondoSymbol.padEnd(10)} $${r.reserveUsd.toFixed(0).padStart(9)}  vol24=$${r.volume24h.toFixed(0).padStart(8)}  ${r.dex}  (${r.pairName})`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
