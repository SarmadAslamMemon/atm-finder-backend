import { connectDatabase, disconnectDatabase } from '../../config/database';
import { getAlHabibPeekabooPublicConfig } from '../peekaboo/client';
import { scrapePeekabooPublic } from '../peekaboo/scrape';
import { PEEKABOO_CITIES } from '../shared/cities';

export interface ScrapeAlHabibOptions {
  cities?: readonly string[];
}

export async function scrapeAlHabib(options: ScrapeAlHabibOptions = {}): Promise<void> {
  await scrapePeekabooPublic({
    config: getAlHabibPeekabooPublicConfig(),
    cities: options.cities ?? PEEKABOO_CITIES,
  });
}

async function main(): Promise<void> {
  await connectDatabase();
  try {
    await scrapeAlHabib();
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
