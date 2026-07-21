import { connectDatabase, disconnectDatabase } from '../config/database';
import { scrapeAlfalah } from './alfalah';
import { scrapeAlHabib } from './alhabib';
import { scrapeAllied } from './allied';
import { scrapeHbl } from './hbl';
import { scrapeMcb } from './mcb';
import { scrapeMeezan } from './meezan';
import { scrapeUbl } from './ubl';

type Target = 'ubl' | 'alfalah' | 'hbl' | 'mcb' | 'allied' | 'meezan' | 'alhabib' | 'all';

async function runScraper(label: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    console.error(`[${label}] scrape crashed — skipping to next bank:`, err);
  }
}

async function main(): Promise<void> {
  const target = (process.argv[2] ?? 'all') as Target;

  await connectDatabase();
  try {
    if (target === 'ubl' || target === 'all') {
      await runScraper('ubl', scrapeUbl);
    }
    if (target === 'alfalah' || target === 'all') {
      await runScraper('alfalah', scrapeAlfalah);
    }
    if (target === 'hbl' || target === 'all') {
      await runScraper('hbl', scrapeHbl);
    }
    if (target === 'mcb' || target === 'all') {
      await runScraper('mcb', scrapeMcb);
    }
    if (target === 'allied' || target === 'all') {
      await runScraper('allied', scrapeAllied);
    }
    if (target === 'meezan' || target === 'all') {
      await runScraper('meezan', scrapeMeezan);
    }
    if (target === 'alhabib' || target === 'all') {
      await runScraper('alhabib', scrapeAlHabib);
    }
  } finally {
    await disconnectDatabase();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
