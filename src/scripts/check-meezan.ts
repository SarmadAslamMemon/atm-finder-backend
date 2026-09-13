import { connectDatabase, disconnectDatabase } from '../config/database';
import { Location, Provider } from '../models';

async function checkMeezan(): Promise<void> {
  await connectDatabase();

  const provider = await Provider.findOne({ slug: 'meezan' });
  if (!provider) {
    console.log('Meezan Bank provider not found in DB!');
    await disconnectDatabase();
    return;
  }

  const meezanLocations = await Location.find({ providerId: provider._id }).lean();
  console.log('--- Meezan Bank DB Audit ---');
  console.log(`Total Meezan records currently in DB: ${meezanLocations.length}`);

  // 1. Check for duplicate externalIds
  const idCounts = new Map<string, number>();
  for (const loc of meezanLocations) {
    idCounts.set(loc.externalId, (idCounts.get(loc.externalId) || 0) + 1);
  }
  const duplicateExternalIds = Array.from(idCounts.entries()).filter(([, count]) => count > 1);
  console.log(`Duplicate externalIds: ${duplicateExternalIds.length}`);

  // 2. Check for duplicate coordinates (exact lat/lng match)
  const coordCounts = new Map<string, number>();
  for (const loc of meezanLocations) {
    const key = `${loc.lat.toFixed(5)},${loc.lng.toFixed(5)}`;
    coordCounts.set(key, (coordCounts.get(key) || 0) + 1);
  }
  const duplicateCoords = Array.from(coordCounts.entries()).filter(([, count]) => count > 1);
  console.log(`Locations sharing identical coordinates: ${duplicateCoords.length}`);

  // 3. Show a sample record
  if (meezanLocations.length > 0) {
    console.log('\nSample Current Meezan Record:');
    console.log({
      id: meezanLocations[0]._id,
      name: meezanLocations[0].name,
      address: meezanLocations[0].address,
      externalId: meezanLocations[0].externalId,
      lat: meezanLocations[0].lat,
      lng: meezanLocations[0].lng,
    });
  }

  await disconnectDatabase();
}

checkMeezan().catch((err) => {
  console.error(err);
  process.exit(1);
});
