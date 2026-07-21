import { connectDatabase, disconnectDatabase } from '../../config/database';
import { getMeezanPeekabooPublicConfig } from '../peekaboo/client';
import { scrapePeekabooPublic } from '../peekaboo/scrape';
import { PEEKABOO_CITIES } from '../shared/cities';

export interface ScrapeMeezanOptions {
  cities?: readonly string[];
}

export async function scrapeMeezan(options: ScrapeMeezanOptions = {}): Promise<void> {
  await scrapePeekabooPublic({
    config: getMeezanPeekabooPublicConfig(),
    cities: options.cities ?? PEEKABOO_CITIES,
  });
}

async function main(): Promise<void> {
  await connectDatabase();
  try {
    await scrapeMeezan();
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
