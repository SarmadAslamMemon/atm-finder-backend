import { connectDatabase, disconnectDatabase } from '../config/database';
import { scrapeAlfalah } from './alfalah';
import { scrapeUbl } from './ubl';

const MISSING_CITIES = ['Rahimyar Khan'] as const;

async function main(): Promise<void> {
  await connectDatabase();
  try {
    console.log('Scraping missing cities:', MISSING_CITIES.join(', '));
    await scrapeUbl({ cities: MISSING_CITIES });
    await scrapeAlfalah({ cities: MISSING_CITIES });
  } finally {
    await disconnectDatabase();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
