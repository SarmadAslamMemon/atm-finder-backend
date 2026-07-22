import { connectDatabase, disconnectDatabase } from '../../config/database';
import { getAskariPeekabooPublicConfig } from '../peekaboo/client';
import { scrapePeekabooPublic } from '../peekaboo/scrape';
import { PEEKABOO_CITIES } from '../shared/cities';

export interface ScrapeAskariOptions {
  cities?: readonly string[];
}

export async function scrapeAskari(options: ScrapeAskariOptions = {}): Promise<void> {
  await scrapePeekabooPublic({
    config: getAskariPeekabooPublicConfig(),
    cities: options.cities ?? PEEKABOO_CITIES,
  });
}

async function main(): Promise<void> {
  await connectDatabase();
  try {
    await scrapeAskari();
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
