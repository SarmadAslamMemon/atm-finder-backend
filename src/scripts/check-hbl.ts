import { connectDatabase, disconnectDatabase } from '../config/database';
import { Location, Provider } from '../models';

async function checkHbl(): Promise<void> {
  await connectDatabase();

  const provider = await Provider.findOne({ slug: 'hbl' });
  if (!provider) {
    console.log('HBL provider not found in DB!');
    await disconnectDatabase();
    return;
  }

  const hblLocations = await Location.find({ providerId: provider._id }).lean();
  console.log('--- HBL DB Audit ---');
  console.log(`Total HBL records currently in DB: ${hblLocations.length}`);

  // Breakdown by location type
  const typeCounts: Record<string, number> = {};
  for (const loc of hblLocations) {
    const typeId = String(loc.locationTypeId);
    typeCounts[typeId] = (typeCounts[typeId] || 0) + 1;
  }
  console.log('Type breakdown:', typeCounts);

  // Sample
  if (hblLocations.length > 0) {
    console.log('\nSample Current HBL Record:');
    console.log({
      id: hblLocations[0]._id,
      name: hblLocations[0].name,
      address: hblLocations[0].address,
      externalId: hblLocations[0].externalId,
      lat: hblLocations[0].lat,
      lng: hblLocations[0].lng,
    });
  }

  await disconnectDatabase();
}

checkHbl().catch((err) => {
  console.error(err);
  process.exit(1);
});
