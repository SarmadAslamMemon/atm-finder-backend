import { connectDatabase, disconnectDatabase } from '../config/database';
import { scrapeAlfalah } from './alfalah';
import { scrapeAlHabib } from './alhabib';
import { scrapeAlBaraka } from './albaraka';
import { scrapeAllied } from './allied';
import { scrapeAskari } from './askari';
import { scrapeBankIslami } from './bankislami';
import { scrapeBok } from './bok';
import { scrapeBop } from './bop';
import { scrapeDib } from './dib';
import { scrapeFaysal } from './faysal';
import { scrapeFwbl } from './fwbl';
import { scrapeHabibMetro } from './habibmetro';
import { scrapeHbl } from './hbl';
import { scrapeJsBank } from './jsbank';
import { scrapeMcb } from './mcb';
import { scrapeMeezan } from './meezan';
import { scrapeNbp } from './nbp';
import { scrapeSindhBank } from './sindhbank';
import { scrapeSoneri } from './soneri';
import { scrapeUbl } from './ubl';
import { scrapeZtbl } from './ztbl';

type Target =
  | 'ubl'
  | 'alfalah'
  | 'hbl'
  | 'mcb'
  | 'allied'
  | 'meezan'
  | 'alhabib'
  | 'faysal'
  | 'askari'
  | 'jsbank'
  | 'soneri'
  | 'bop'
  | 'nbp'
  | 'sindhbank'
  | 'dib'
  | 'bankislami'
  | 'albaraka'
  | 'habibmetro'
  | 'bok'
  | 'ztbl'
  | 'fwbl'
  | 'all';

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
    if (target === 'faysal' || target === 'all') {
      await runScraper('faysal', scrapeFaysal);
    }
    if (target === 'askari' || target === 'all') {
      await runScraper('askari', scrapeAskari);
    }
    if (target === 'jsbank' || target === 'all') {
      await runScraper('jsbank', scrapeJsBank);
    }
    if (target === 'soneri' || target === 'all') {
      await runScraper('soneri', scrapeSoneri);
    }
    if (target === 'bop' || target === 'all') {
      await runScraper('bop', scrapeBop);
    }
    if (target === 'nbp' || target === 'all') {
      await runScraper('nbp', scrapeNbp);
    }
    if (target === 'sindhbank' || target === 'all') {
      await runScraper('sindhbank', scrapeSindhBank);
    }
    if (target === 'dib' || target === 'all') {
      await runScraper('dib', scrapeDib);
    }
    if (target === 'bankislami' || target === 'all') {
      await runScraper('bankislami', scrapeBankIslami);
    }
    if (target === 'albaraka' || target === 'all') {
      await runScraper('albaraka', scrapeAlBaraka);
    }
    if (target === 'habibmetro' || target === 'all') {
      await runScraper('habibmetro', scrapeHabibMetro);
    }
    if (target === 'bok' || target === 'all') {
      await runScraper('bok', scrapeBok);
    }
    if (target === 'ztbl' || target === 'all') {
      await runScraper('ztbl', scrapeZtbl);
    }
    if (target === 'fwbl' || target === 'all') {
      await runScraper('fwbl', scrapeFwbl);
    }
  } finally {
    await disconnectDatabase();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
