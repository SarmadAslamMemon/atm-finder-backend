import { connectDatabase, disconnectDatabase } from '../../config/database';
import {
  createScraperContext,
  createStats,
  recordUpsert,
  upsertLocation,
} from '../shared/upsert';
import { fetchZtblHtml } from './client';
import { normalizeZtblLocation, parseZtblLocations } from './normalize';

export async function scrapeZtbl(): Promise<void> {
  const ctx = await createScraperContext();
  const stats = createStats();

  console.log('ZTBL scrape started');

  const html = await fetchZtblHtml();
  const rows = parseZtblLocations(html);
  console.log(`  ${rows.length} raw rows found`);

  for (const row of rows) {
    try {
      const input = normalizeZtblLocation(row);
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

  console.log('ZTBL scrape finished:', stats);
}

async function main(): Promise<void> {
  await connectDatabase();
  try {
    await scrapeZtbl();
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
