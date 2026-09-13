import { connectDatabase, disconnectDatabase } from '../../config/database';
import { Location, Provider, City, LocationType } from '../../models';

async function inspectNbpData() {
  await connectDatabase();
  const provider = await Provider.findOne({ slug: 'nbp' });
  if (!provider) {
    console.log('NBP provider not found');
    return;
  }

  const total = await Location.countDocuments({ providerId: provider._id });
  console.log(`=== Total NBP Records in DB: ${total} ===\n`);

  // Sample 5 Branches
  console.log('--- Sample 5 Branches ---');
  const branches = await Location.find({ providerId: provider._id, externalId: /^nbp_br_/ })
    .populate('cityId')
    .populate('locationTypeId')
    .limit(5)
    .lean();

  for (const b of branches) {
    console.log(JSON.stringify({
      id: b.externalId,
      name: b.name,
      address: b.address,
      cityName: (b.cityId as any)?.name,
      type: (b.locationTypeId as any)?.code,
      coordinates: [b.lat, b.lng],
      amenities: b.amenities,
      rawData: b.rawData
    }, null, 2));
  }

  // Sample 5 ATMs
  console.log('\n--- Sample 5 ATMs ---');
  const atms = await Location.find({ providerId: provider._id, externalId: /^nbp_atm_/ })
    .populate('cityId')
    .populate('locationTypeId')
    .limit(5)
    .lean();

  for (const a of atms) {
    console.log(JSON.stringify({
      id: a.externalId,
      name: a.name,
      address: a.address,
      cityName: (a.cityId as any)?.name,
      type: (a.locationTypeId as any)?.code,
      coordinates: [a.lat, a.lng],
      amenities: a.amenities,
      rawData: a.rawData
    }, null, 2));
  }

  // Check if NBP portal has detailed street addresses, manager phone numbers or if those exist on DomesticBrLocator
  await disconnectDatabase();
}

inspectNbpData().catch(console.error);
