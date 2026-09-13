import { connectDatabase, disconnectDatabase } from '../../config/database';
import { getFaysalPeekabooPublicConfig } from '../peekaboo/client';
import { scrapePeekabooPublic } from '../peekaboo/scrape';
import { PEEKABOO_CITIES } from '../shared/cities';

export { scrapeFaysalDirect } from './scrape-faysal-direct';
import { scrapeFaysalDirect } from './scrape-faysal-direct';

export interface ScrapeFaysalOptions {
  cities?: readonly string[];
}

export async function scrapeFaysal(options: ScrapeFaysalOptions = {}): Promise<void> {
  await scrapeFaysalDirect();
}

async function main(): Promise<void> {
  await scrapeFaysalDirect();
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
