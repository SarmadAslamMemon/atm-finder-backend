import { connectDatabase, disconnectDatabase } from '../../config/database';
import { createScraperContext, createStats, recordUpsert, upsertLocation } from '../shared/upsert';
import { createMcbSession, fetchMcbLocations } from './client';
import { normalizeMcbLocation } from './normalize';

export async function scrapeMcb(): Promise<void> {
  const ctx = await createScraperContext();
  const stats = createStats();

  console.log('MCB scrape started');

  const session = await createMcbSession();

  try {
    const rows = await fetchMcbLocations(session.page);
    console.log(`  ${rows.length} records found`);

    for (const row of rows) {
      try {
        const input = normalizeMcbLocation(row);
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
  } finally {
    await session.close();
  }

  console.log('MCB scrape finished:', stats);
}

async function main(): Promise<void> {
  await connectDatabase();
  try {
    await scrapeMcb();
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
