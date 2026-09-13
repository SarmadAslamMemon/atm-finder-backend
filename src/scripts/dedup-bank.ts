import { connectDatabase, disconnectDatabase } from '../config/database';
import { Location, Provider } from '../models';

export async function deduplicateProvider(slug: string) {
  const provider = await Provider.findOne({ slug }).lean();
  if (!provider) {
    console.error(`❌ Provider with slug "${slug}" not found.`);
    return;
  }

  const prefix = `${slug}_`;
  const initialLocations = await Location.find({ providerId: provider._id }).lean();
  console.log(`\n========================================================`);
  console.log(`🚀 STARTING DEDUPLICATION FOR: ${provider.name} (${slug})`);
  console.log(`   Initial DB Locations: ${initialLocations.length}`);
  console.log(`========================================================`);

  const prefixedDocs = new Map<string, any>();
  const unprefixedDocs: any[] = [];

  for (const loc of initialLocations) {
    const ext = String(loc.externalId || '').trim();
    if (ext.startsWith(prefix)) {
      prefixedDocs.set(ext, loc);
    } else {
      unprefixedDocs.push(loc);
    }
  }

  console.log(`   • Prefixed records (${prefix}*):  ${prefixedDocs.size}`);
  console.log(`   • Unprefixed records:             ${unprefixedDocs.length}`);

  const toDeleteIds: any[] = [];
  const updateOps: any[] = [];
  let purgedCount = 0;
  let migratedCount = 0;

  for (const legacyDoc of unprefixedDocs) {
    const ext = String(legacyDoc.externalId || '').trim();
    const twinExternalId = `${prefix}${ext}`;

    const existingTwin = prefixedDocs.get(twinExternalId);

    if (existingTwin) {
      // Twin already exists in DB with prefix.
      // Check if legacy has anything to merge (e.g. phone)
      const updates: Record<string, any> = {};
      let needsUpdate = false;

      if (!existingTwin.phone && legacyDoc.phone) {
        updates.phone = legacyDoc.phone;
        needsUpdate = true;
      }

      if (legacyDoc.amenities && typeof legacyDoc.amenities === 'object') {
        const twinAmenities = existingTwin.amenities || {};
        const merged = { ...twinAmenities };
        for (const [k, v] of Object.entries(legacyDoc.amenities)) {
          if (v && !twinAmenities[k]) {
            merged[k] = true;
            needsUpdate = true;
          }
        }
        if (needsUpdate) {
          updates.amenities = merged;
        }
      }

      if (needsUpdate) {
        updateOps.push({
          updateOne: {
            filter: { _id: existingTwin._id },
            update: { $set: updates }
          }
        });
      }

      toDeleteIds.push(legacyDoc._id);
      purgedCount++;
    } else {
      // Unique legacy record without twin -> Migrate externalId to namespaced prefix
      updateOps.push({
        updateOne: {
          filter: { _id: legacyDoc._id },
          update: { $set: { externalId: twinExternalId } }
        }
      });
      prefixedDocs.set(twinExternalId, legacyDoc);
      migratedCount++;
    }
  }

  if (updateOps.length > 0) {
    await Location.bulkWrite(updateOps);
    console.log(`   🔄 Executed bulk updates/migrations: ${updateOps.length}`);
  }

  if (toDeleteIds.length > 0) {
    const deleteResult = await Location.deleteMany({ _id: { $in: toDeleteIds } });
    console.log(`   🗑️  Purged redundant twin documents: ${deleteResult.deletedCount}`);
  }

  const finalLocations = await Location.find({ providerId: provider._id }).lean();
  console.log(`\n✅ DEDUPLICATION COMPLETE FOR ${provider.name}:`);
  console.log(`   • Before Cleanup: ${initialLocations.length}`);
  console.log(`   • Purged Twins:   ${purgedCount}`);
  console.log(`   • Migrated IDs:   ${migratedCount}`);
  console.log(`   • Final Count:    ${finalLocations.length}`);
  console.log(`========================================================\n`);

  return {
    initial: initialLocations.length,
    purged: purgedCount,
    migrated: migratedCount,
    final: finalLocations.length
  };
}

async function main() {
  await connectDatabase();
  const slug = process.argv[2] || 'allied';
  await deduplicateProvider(slug);
  await disconnectDatabase();
}

if (require.main === module) {
  main().catch(console.error);
}
