import { connectDatabase, disconnectDatabase } from '../../config/database';
import { getJsBankPeekabooPublicConfig } from '../peekaboo/client';
import { scrapePeekabooPublic } from '../peekaboo/scrape';
import { PEEKABOO_CITIES } from '../shared/cities';

export interface ScrapeJsBankOptions {
  cities?: readonly string[];
}

export async function scrapeJsBank(options: ScrapeJsBankOptions = {}): Promise<void> {
  await scrapePeekabooPublic({
    config: getJsBankPeekabooPublicConfig(),
    cities: options.cities ?? PEEKABOO_CITIES,
  });
}

async function main(): Promise<void> {
  await connectDatabase();
  try {
    await scrapeJsBank();
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
