import { connectDatabase, disconnectDatabase } from '../../config/database';
import { getNbpPeekabooPublicConfig } from '../peekaboo/client';
import { scrapePeekabooPublic } from '../peekaboo/scrape';
import { PEEKABOO_CITIES } from '../shared/cities';

export interface ScrapeNbpOptions {
  cities?: readonly string[];
}

export async function scrapeNbp(options: ScrapeNbpOptions = {}): Promise<void> {
  await scrapePeekabooPublic({
    config: getNbpPeekabooPublicConfig(),
    cities: options.cities ?? PEEKABOO_CITIES,
  });
}

async function main(): Promise<void> {
  await connectDatabase();
  try {
    await scrapeNbp();
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
