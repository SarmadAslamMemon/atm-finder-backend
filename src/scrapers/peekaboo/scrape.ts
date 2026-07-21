import {
  createScraperContext,
  createStats,
  recordUpsert,
  upsertLocation,
} from '../shared/upsert';
import { fetchAllPeekabooBranchesForCity } from './client';
import { normalizePeekabooBranch } from './normalize';
import { fetchAllPeekabooPublicBranchesForCity, PeekabooPublicBankConfig } from './publicClient';
import { PeekabooBankConfig } from './types';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface ScrapePeekabooOptions {
  cities: readonly string[];
  config: PeekabooBankConfig;
}

export async function scrapePeekaboo(options: ScrapePeekabooOptions): Promise<void> {
  const { cities, config } = options;
  const ctx = await createScraperContext();
  const stats = createStats();

  console.log(`${config.merchantName} scrape started — ${cities.length} cities`);

  for (const city of cities) {
    try {
      console.log(`Fetching ${config.merchantName} branches for ${city}...`);
      const branches = await fetchAllPeekabooBranchesForCity(config, city);
      console.log(`  ${branches.length} branches found`);

      for (const branch of branches) {
        try {
          const input = normalizePeekabooBranch(branch, config.providerSlug);
          const result = await upsertLocation(ctx, input);
          recordUpsert(stats, result);
        } catch (err) {
          stats.failed += 1;
          console.error(`  Failed branch ${branch.id}:`, err);
        }
      }
    } catch (err) {
      console.error(`Failed city ${city}:`, err);
    }

    await delay(350);
  }

  console.log(`${config.merchantName} scrape finished:`, stats);
}

export interface ScrapePeekabooPublicOptions {
  cities: readonly string[];
  config: PeekabooPublicBankConfig;
}

export async function scrapePeekabooPublic(options: ScrapePeekabooPublicOptions): Promise<void> {
  const { cities, config } = options;
  const ctx = await createScraperContext();
  const stats = createStats();

  console.log(`${config.merchantName} scrape started — ${cities.length} cities`);

  for (const city of cities) {
    try {
      console.log(`Fetching ${config.merchantName} branches for ${city}...`);
      const branches = await fetchAllPeekabooPublicBranchesForCity(config, city);
      console.log(`  ${branches.length} branches found`);

      for (const branch of branches) {
        try {
          const input = normalizePeekabooBranch(branch, config.providerSlug);
          const result = await upsertLocation(ctx, input);
          recordUpsert(stats, result);
        } catch (err) {
          stats.failed += 1;
          console.error(`  Failed branch ${branch.id}:`, err);
        }
      }
    } catch (err) {
      console.error(`Failed city ${city}:`, err);
    }

    await delay(350);
  }

  console.log(`${config.merchantName} scrape finished:`, stats);
}
