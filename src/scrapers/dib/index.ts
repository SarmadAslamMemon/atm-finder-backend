import { connectDatabase, disconnectDatabase } from '../../config/database';
import { getDibPeekabooPublicConfig } from '../peekaboo/client';
import { scrapePeekabooPublic } from '../peekaboo/scrape';
import { PEEKABOO_CITIES } from '../shared/cities';

export interface ScrapeDibOptions {
  cities?: readonly string[];
}

export async function scrapeDib(options: ScrapeDibOptions = {}): Promise<void> {
  await scrapePeekabooPublic({
    config: getDibPeekabooPublicConfig(),
    cities: options.cities ?? PEEKABOO_CITIES,
  });
}

async function main(): Promise<void> {
  await connectDatabase();
  try {
    await scrapeDib();
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
