import { connectDatabase, disconnectDatabase } from '../config/database';
import { Provider } from '../models';
import { deduplicateProvider } from './dedup-bank';

async function main() {
  await connectDatabase();
  const providers = await Provider.find({ isActive: true }).sort({ name: 1 });

  console.log('========================================================');
  console.log(`🚀 RUNNING GLOBAL DEDUPLICATION ACROSS ${providers.length} BANKS`);
  console.log('========================================================');

  const summary: any[] = [];

  for (const provider of providers) {
    const res = await deduplicateProvider(provider.slug);
    if (res) {
      summary.push({
        name: provider.name,
        slug: provider.slug,
        ...res
      });
    }
  }

  console.log('\n========================================================================');
  console.log('                 GLOBAL DEDUPLICATION COMPLETE SUMMARY                  ');
  console.log('========================================================================');
  console.log('Provider'.padEnd(28) + ' | ' + 'Before'.padStart(7) + ' | ' + 'Purged'.padStart(7) + ' | ' + 'Migrated'.padStart(9) + ' | ' + 'Final'.padStart(7));
  console.log('-'.repeat(72));

  let totalBefore = 0;
  let totalPurged = 0;
  let totalMigrated = 0;
  let totalFinal = 0;

  for (const row of summary) {
    totalBefore += row.initial;
    totalPurged += row.purged;
    totalMigrated += row.migrated;
    totalFinal += row.final;

    console.log(
      row.name.padEnd(28) + ' | ' +
      String(row.initial).padStart(7) + ' | ' +
      String(row.purged).padStart(7) + ' | ' +
      String(row.migrated).padStart(9) + ' | ' +
      String(row.final).padStart(7)
    );
  }

  console.log('-'.repeat(72));
  console.log(
    'TOTAL'.padEnd(28) + ' | ' +
    String(totalBefore).padStart(7) + ' | ' +
    String(totalPurged).padStart(7) + ' | ' +
    String(totalMigrated).padStart(9) + ' | ' +
    String(totalFinal).padStart(7)
  );
  console.log('========================================================================\n');

  await disconnectDatabase();
}

main().catch(console.error);
