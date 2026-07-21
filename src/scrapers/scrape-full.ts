import { connectDatabase, disconnectDatabase } from '../config/database';
import { scrapeAlfalah } from './alfalah';
import { scrapeMirpur } from './mirpur';
import { PEEKABOO_CITIES_FULL } from './shared/peekaboo-cities';
import { scrapeUbl } from './ubl';

async function main(): Promise<void> {
  console.log(`Full Peekaboo scrape — ${PEEKABOO_CITIES_FULL.length} cities per bank`);

  await connectDatabase();
  try {
    await scrapeUbl({ cities: PEEKABOO_CITIES_FULL });
    await scrapeAlfalah({ cities: PEEKABOO_CITIES_FULL });
    await scrapeMirpur();
  } finally {
    await disconnectDatabase();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
