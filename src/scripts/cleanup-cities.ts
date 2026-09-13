import { connectDatabase, disconnectDatabase } from '../config/database';
import { City, Location } from '../models';
import { cleanAndNormalizeCity } from '../scrapers/shared/cities';

export async function cleanupDuplicateCities(): Promise<void> {
  console.log('--- Starting MongoDB City Deduplication & Migration ---');
  await connectDatabase();

  const totalLocations = await Location.countDocuments();
  const allCities = await City.find({ country: 'Pakistan' }).lean();

  console.log(`Found ${allCities.length} city records in DB across ${totalLocations} locations.`);

  // Group existing City documents by their normalized canonical name
  const groupedByCanonical = new Map<string, Array<{ _id: unknown; name: string }>>();

  for (const city of allCities) {
    const canonicalName = cleanAndNormalizeCity(city.name);
    if (!groupedByCanonical.has(canonicalName)) {
      groupedByCanonical.set(canonicalName, []);
    }
    groupedByCanonical.get(canonicalName)!.push({ _id: city._id, name: city.name });
  }

  let mergedCount = 0;
  let remappedLocationsCount = 0;

  for (const [canonicalName, records] of groupedByCanonical.entries()) {
    // 1. Ensure or create the canonical City document
    let primaryCity = await City.findOne({ name: canonicalName, country: 'Pakistan' });

    if (!primaryCity) {
      // Promote the first record to canonical name
      const firstId = records[0]._id;
      primaryCity = await City.findByIdAndUpdate(
        firstId,
        { $set: { name: canonicalName } },
        { new: true }
      );
    }

    if (!primaryCity) continue;

    const primaryId = primaryCity._id;
    const redundantIds = records
      .map((r) => String(r._id))
      .filter((id) => id !== String(primaryId));

    if (redundantIds.length > 0) {
      console.log(`Merging ${redundantIds.length} duplicate variations into canonical "${canonicalName}" (${primaryId})...`);

      // 2. Remap all Locations referencing duplicate city IDs
      const updateResult = await Location.updateMany(
        { cityId: { $in: redundantIds } },
        { $set: { cityId: primaryId } }
      );
      remappedLocationsCount += updateResult.modifiedCount;

      // 3. Delete redundant city documents
      const deleteResult = await City.deleteMany({ _id: { $in: redundantIds } });
      mergedCount += deleteResult.deletedCount;
    }
  }

  const finalCityCount = await City.countDocuments({ country: 'Pakistan' });
  console.log('======================================================');
  console.log(`✅ Cleanup Complete:`);
  console.log(`- Redundant City records deleted: ${mergedCount}`);
  console.log(`- Locations re-pointed to canonical cities: ${remappedLocationsCount}`);
  console.log(`- Total canonical cities remaining in DB: ${finalCityCount}`);
  console.log('======================================================');

  await disconnectDatabase();
}

if (require.main === module) {
  cleanupDuplicateCities().catch((err) => {
    console.error('Cleanup failed:', err);
    process.exit(1);
  });
}
