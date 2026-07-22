import { connectDatabase, disconnectDatabase } from '../../config/database';
import { getSoneriPeekabooPublicConfig } from '../peekaboo/client';
import { scrapePeekabooPublic } from '../peekaboo/scrape';
import { PEEKABOO_CITIES } from '../shared/cities';

export interface ScrapeSoneriOptions {
  cities?: readonly string[];
}

export async function scrapeSoneri(options: ScrapeSoneriOptions = {}): Promise<void> {
  await scrapePeekabooPublic({
    config: getSoneriPeekabooPublicConfig(),
    cities: options.cities ?? PEEKABOO_CITIES,
  });
}

async function main(): Promise<void> {
  await connectDatabase();
  try {
    await scrapeSoneri();
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
