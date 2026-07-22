import { connectDatabase, disconnectDatabase } from '../../config/database';
import { getHabibMetroPeekabooPublicConfig } from '../peekaboo/client';
import { scrapePeekabooPublic } from '../peekaboo/scrape';
import { PEEKABOO_CITIES } from '../shared/cities';

export interface ScrapeHabibMetroOptions {
  cities?: readonly string[];
}

export async function scrapeHabibMetro(options: ScrapeHabibMetroOptions = {}): Promise<void> {
  await scrapePeekabooPublic({
    config: getHabibMetroPeekabooPublicConfig(),
    cities: options.cities ?? PEEKABOO_CITIES,
  });
}

async function main(): Promise<void> {
  await connectDatabase();
  try {
    await scrapeHabibMetro();
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
