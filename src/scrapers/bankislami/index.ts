import { connectDatabase, disconnectDatabase } from '../../config/database';
import { getBankIslamiPeekabooPublicConfig } from '../peekaboo/client';
import { scrapePeekabooPublic } from '../peekaboo/scrape';
import { PEEKABOO_CITIES } from '../shared/cities';

export interface ScrapeBankIslamiOptions {
  cities?: readonly string[];
}

export async function scrapeBankIslami(options: ScrapeBankIslamiOptions = {}): Promise<void> {
  await scrapePeekabooPublic({
    config: getBankIslamiPeekabooPublicConfig(),
    cities: options.cities ?? PEEKABOO_CITIES,
  });
}

async function main(): Promise<void> {
  await connectDatabase();
  try {
    await scrapeBankIslami();
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
