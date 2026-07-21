import { connectDatabase, disconnectDatabase } from '../../config/database';
import { getAlfalahPeekabooConfig } from '../peekaboo/client';
import { scrapePeekaboo } from '../peekaboo/scrape';
import { PEEKABOO_CITIES } from '../shared/cities';

export async function scrapeAlfalah(options: { cities?: readonly string[] } = {}): Promise<void> {
  await scrapePeekaboo({
    config: getAlfalahPeekabooConfig(),
    cities: options.cities ?? PEEKABOO_CITIES,
  });
}

async function main(): Promise<void> {
  await connectDatabase();
  try {
    await scrapeAlfalah();
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
