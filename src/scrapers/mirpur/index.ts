import { connectDatabase, disconnectDatabase } from '../../config/database';
import { getAlfalahPeekabooConfig, getUblPeekabooConfig } from '../peekaboo/client';
import { fetchAllPeekabooBranchesForCity } from '../peekaboo/client';
import { normalizePeekabooBranch } from '../peekaboo/normalize';
import { PeekabooBankConfig } from '../peekaboo/types';
import { dedupeBranches, isMirpurBranch, MIRPUR_PROXY_CITIES } from '../shared/mirpur';
import {
  createScraperContext,
  createStats,
  recordUpsert,
  upsertLocation,
} from '../shared/upsert';

async function scrapeMirpurForProvider(config: PeekabooBankConfig) {
  const ctx = await createScraperContext();
  const stats = createStats();
  const collected: Awaited<ReturnType<typeof fetchAllPeekabooBranchesForCity>> = [];

  console.log(`${config.merchantName} — Mirpur via proxy cities`);

  for (const city of MIRPUR_PROXY_CITIES) {
    try {
      const branches = await fetchAllPeekabooBranchesForCity(config, city);
      const mirpur = branches.filter(isMirpurBranch);
      console.log(`  ${city}: ${mirpur.length} mirpur-related`);
      collected.push(...mirpur);
    } catch (err) {
      console.error(`  Failed ${city}:`, err);
    }
  }

  const unique = dedupeBranches(collected);
  console.log(`  Upserting ${unique.length} unique Mirpur branches`);

  for (const branch of unique) {
    try {
      const input = normalizePeekabooBranch(branch, config.providerSlug);
      input.cityName = 'Mirpur';
      const result = await upsertLocation(ctx, input);
      recordUpsert(stats, result);
    } catch (err) {
      stats.failed += 1;
      console.error(`  Failed branch ${branch.id}:`, err);
    }
  }

  console.log(`${config.merchantName} Mirpur scrape finished:`, stats);
}

export async function scrapeMirpur(): Promise<void> {
  await scrapeMirpurForProvider(getUblPeekabooConfig());
  await scrapeMirpurForProvider(getAlfalahPeekabooConfig());
}

async function main(): Promise<void> {
  await connectDatabase();
  try {
    await scrapeMirpur();
  } finally {
    await disconnectDatabase();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
