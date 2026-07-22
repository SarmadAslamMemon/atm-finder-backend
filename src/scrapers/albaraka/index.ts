import { connectDatabase, disconnectDatabase } from '../../config/database';
import { getAlBarakaPeekabooPublicConfig } from '../peekaboo/client';
import { scrapePeekabooPublic } from '../peekaboo/scrape';
import { PEEKABOO_CITIES } from '../shared/cities';

export interface ScrapeAlBarakaOptions {
  cities?: readonly string[];
}

export async function scrapeAlBaraka(options: ScrapeAlBarakaOptions = {}): Promise<void> {
  await scrapePeekabooPublic({
    config: getAlBarakaPeekabooPublicConfig(),
    cities: options.cities ?? PEEKABOO_CITIES,
  });
}

async function main(): Promise<void> {
  await connectDatabase();
  try {
    await scrapeAlBaraka();
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
