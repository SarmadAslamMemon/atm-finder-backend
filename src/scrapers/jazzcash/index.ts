import { scrapeJazzCashDirect } from './scrape-jazzcash-direct';

export async function scrapeJazzCash(): Promise<void> {
  await scrapeJazzCashDirect();
}

if (require.main === module) {
  scrapeJazzCash().catch((err) => {
    console.error('JazzCash scraper failed:', err);
    process.exit(1);
  });
}
