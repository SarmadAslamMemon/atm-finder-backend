import { connectDatabase, disconnectDatabase } from '../../config/database';
import { getSindhBankPeekabooPublicConfig } from '../peekaboo/client';
import { scrapePeekabooPublic } from '../peekaboo/scrape';
import { PEEKABOO_CITIES } from '../shared/cities';

export interface ScrapeSindhBankOptions {
  cities?: readonly string[];
}

export async function scrapeSindhBank(options: ScrapeSindhBankOptions = {}): Promise<void> {
  await scrapePeekabooPublic({
    config: getSindhBankPeekabooPublicConfig(),
    cities: options.cities ?? PEEKABOO_CITIES,
  });
}

async function main(): Promise<void> {
  await connectDatabase();
  try {
    await scrapeSindhBank();
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
