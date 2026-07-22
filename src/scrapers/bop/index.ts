import { connectDatabase, disconnectDatabase } from '../../config/database';
import { getBopPeekabooPublicConfig } from '../peekaboo/client';
import { scrapePeekabooPublic } from '../peekaboo/scrape';
import { PEEKABOO_CITIES } from '../shared/cities';

export interface ScrapeBopOptions {
  cities?: readonly string[];
}

export async function scrapeBop(options: ScrapeBopOptions = {}): Promise<void> {
  await scrapePeekabooPublic({
    config: getBopPeekabooPublicConfig(),
    cities: options.cities ?? PEEKABOO_CITIES,
  });
}

async function main(): Promise<void> {
  await connectDatabase();
  try {
    await scrapeBop();
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
