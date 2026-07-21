import { connectDatabase, disconnectDatabase } from '../../config/database';
import { getAlliedPeekabooConfig } from '../peekaboo/client';
import { scrapePeekaboo } from '../peekaboo/scrape';
import { PEEKABOO_CITIES } from '../shared/cities';

export interface ScrapeAlliedOptions {
  cities?: readonly string[];
}

export async function scrapeAllied(options: ScrapeAlliedOptions = {}): Promise<void> {
  await scrapePeekaboo({
    config: getAlliedPeekabooConfig(),
    cities: options.cities ?? PEEKABOO_CITIES,
  });
}

async function main(): Promise<void> {
  await connectDatabase();
  try {
    await scrapeAllied();
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
