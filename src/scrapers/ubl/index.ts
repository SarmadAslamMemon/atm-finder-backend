import { connectDatabase, disconnectDatabase } from '../../config/database';
import { getUblPeekabooConfig } from '../peekaboo/client';
import { scrapePeekaboo } from '../peekaboo/scrape';
import { PEEKABOO_CITIES } from '../shared/cities';

export interface ScrapeUblOptions {
  cities?: readonly string[];
}

export async function scrapeUbl(options: ScrapeUblOptions = {}): Promise<void> {
  await scrapePeekaboo({
    config: getUblPeekabooConfig(),
    cities: options.cities ?? PEEKABOO_CITIES,
  });
}

async function main(): Promise<void> {
  await connectDatabase();
  try {
    await scrapeUbl();
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
