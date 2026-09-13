import { connectDatabase, disconnectDatabase } from '../config/database';
import { Location, Provider } from '../models';

async function checkAlHabib(): Promise<void> {
  await connectDatabase();

  const provider = await Provider.findOne({ slug: 'alhabib' });
  if (!provider) {
    console.log('Bank AL Habib provider not found in DB!');
    await disconnectDatabase();
    return;
  }

  const alhabibLocations = await Location.find({ providerId: provider._id }).lean();
  console.log('--- Bank AL Habib DB Audit ---');
  console.log(`Total Bank AL Habib records currently in DB: ${alhabibLocations.length}`);

  // 1. Check for duplicate externalIds
  const idCounts = new Map<string, number>();
  for (const loc of alhabibLocations) {
    idCounts.set(loc.externalId, (idCounts.get(loc.externalId) || 0) + 1);
  }
  const duplicateExternalIds = Array.from(idCounts.entries()).filter(([, count]) => count > 1);
  console.log(`Duplicate externalIds: ${duplicateExternalIds.length}`);

  // 2. Check for duplicate coordinates (exact lat/lng match)
  const coordCounts = new Map<string, number>();
  for (const loc of alhabibLocations) {
    const key = `${loc.lat.toFixed(5)},${loc.lng.toFixed(5)}`;
    coordCounts.set(key, (coordCounts.get(key) || 0) + 1);
  }
  const duplicateCoords = Array.from(coordCounts.entries()).filter(([, count]) => count > 1);
  console.log(`Locations sharing identical coordinates: ${duplicateCoords.length}`);

  // 3. Show a sample record
  if (alhabibLocations.length > 0) {
    console.log('\nSample Current Bank AL Habib Record:');
    console.log({
      id: alhabibLocations[0]._id,
      name: alhabibLocations[0].name,
      address: alhabibLocations[0].address,
      externalId: alhabibLocations[0].externalId,
      lat: alhabibLocations[0].lat,
      lng: alhabibLocations[0].lng,
    });
  }

  await disconnectDatabase();
}

checkAlHabib().catch((err) => {
  console.error(err);
  process.exit(1);
});
