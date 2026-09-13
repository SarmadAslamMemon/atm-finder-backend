import { connectDatabase, disconnectDatabase } from '../../config/database';
import { getSindhBankPeekabooPublicConfig } from '../peekaboo/client';
import { scrapePeekabooPublic } from '../peekaboo/scrape';
import { PEEKABOO_CITIES } from '../shared/cities';

export { scrapeSindhBankDirect } from './scrape-sindhbank-direct';
import { scrapeSindhBankDirect } from './scrape-sindhbank-direct';

export interface ScrapeSindhBankOptions {
  cities?: readonly string[];
}

export async function scrapeSindhBank(options: ScrapeSindhBankOptions = {}): Promise<void> {
  await scrapeSindhBankDirect();
}

async function main(): Promise<void> {
  await scrapeSindhBankDirect();
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
