import { connectDatabase, disconnectDatabase } from '../../config/database';
import { getFaysalPeekabooPublicConfig } from '../peekaboo/client';
import { scrapePeekabooPublic } from '../peekaboo/scrape';
import { PEEKABOO_CITIES } from '../shared/cities';

export interface ScrapeFaysalOptions {
  cities?: readonly string[];
}

export async function scrapeFaysal(options: ScrapeFaysalOptions = {}): Promise<void> {
  await scrapePeekabooPublic({
    config: getFaysalPeekabooPublicConfig(),
    cities: options.cities ?? PEEKABOO_CITIES,
  });
}

async function main(): Promise<void> {
  await connectDatabase();
  try {
    await scrapeFaysal();
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
