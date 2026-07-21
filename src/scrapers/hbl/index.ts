import { connectDatabase, disconnectDatabase } from '../../config/database';
import { HBL_LOCATION_TYPES, PAKISTAN_CITIES } from '../shared/cities';
import {
  createScraperContext,
  createStats,
  recordUpsert,
  upsertLocation,
} from '../shared/upsert';
import { createHblSession, fetchHblLocations } from './client';
import { normalizeHblLocation } from './normalize';

export interface ScrapeHblOptions {
  cities?: Array<(typeof PAKISTAN_CITIES)[number]['name']>;
  types?: (typeof HBL_LOCATION_TYPES)[number][];
}

export async function scrapeHbl(options: ScrapeHblOptions = {}): Promise<void> {
  const cities = options.cities ?? PAKISTAN_CITIES.map((city) => city.name);
  const types = options.types ?? [...HBL_LOCATION_TYPES];
  const ctx = await createScraperContext();
  const stats = createStats();

  console.log(`HBL scrape started — ${cities.length} cities × ${types.length} types`);

  const session = await createHblSession();

  try {
    for (const city of cities) {
      for (const type of types) {
        try {
          console.log(`Fetching HBL ${type} in ${city}...`);
          const rows = await fetchHblLocations(session.page, city, type);
          console.log(`  ${rows.length} records found`);

          for (const row of rows) {
            try {
              const input = normalizeHblLocation(row, city, type);
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

          await session.page.waitForTimeout(1500);
        } catch (err) {
          console.error(`Failed HBL ${type} in ${city}:`, err);
        }
      }
    }
  } finally {
    await session.close();
  }

  console.log('HBL scrape finished:', stats);
}

async function main(): Promise<void> {
  await connectDatabase();
  try {
    await scrapeHbl();
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
