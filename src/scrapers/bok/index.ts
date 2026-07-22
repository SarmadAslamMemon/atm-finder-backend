import { connectDatabase, disconnectDatabase } from '../../config/database';
import {
  createScraperContext,
  createStats,
  recordUpsert,
  upsertLocation,
} from '../shared/upsert';
import { fetchBokHtml } from './client';
import { normalizeBokLocation, parseBokLocations } from './normalize';

export async function scrapeBok(): Promise<void> {
  const ctx = await createScraperContext();
  const stats = createStats();

  console.log('Bank of Khyber scrape started');

  const html = await fetchBokHtml();
  const rows = parseBokLocations(html);
  console.log(`  ${rows.length} raw rows found`);

  for (const row of rows) {
    try {
      const input = normalizeBokLocation(row);
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

  console.log('Bank of Khyber scrape finished:', stats);
}

async function main(): Promise<void> {
  await connectDatabase();
  try {
    await scrapeBok();
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
