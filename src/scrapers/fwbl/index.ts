import { connectDatabase, disconnectDatabase } from '../../config/database';
import {
  createScraperContext,
  createStats,
  recordUpsert,
  upsertLocation,
} from '../shared/upsert';
import { fetchFwblLocations } from './client';
import { normalizeFwblLocation } from './normalize';

export async function scrapeFwbl(): Promise<void> {
  const ctx = await createScraperContext();
  const stats = createStats();

  console.log('First Women Bank scrape started');

  const response = await fetchFwblLocations();
  const rows = response.objects || [];
  console.log(`  ${rows.length} raw rows found`);

  for (const row of rows) {
    try {
      const input = normalizeFwblLocation(row);
      if (!input) {
        stats.skipped += 1;
        continue;
      }
      const result = await upsertLocation(ctx, input);
      recordUpsert(stats, result);
    } catch (err) {
      stats.failed += 1;
      console.error('  Failed record:', err);
    }
  }

  console.log('First Women Bank scrape finished:', stats);
}

async function main(): Promise<void> {
  await connectDatabase();
  try {
    await scrapeFwbl();
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
