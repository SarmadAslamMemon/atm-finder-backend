import { connectDatabase, disconnectDatabase } from '../config/database';
import { Location, Provider } from '../models';

async function checkDetails() {
  await connectDatabase();
  const provider = await Provider.findOne({ slug: 'allied' });
  if (!provider) return;

  const allAllied = await Location.find({ providerId: provider._id });
  const prefixedSet = new Set(allAllied.filter(x => x.externalId.startsWith('allied_')).map(x => x.externalId));
  const nonTwins = allAllied.filter(x => !x.externalId.startsWith('allied_') && !prefixedSet.has('allied_' + x.externalId));

  console.log(`=== ALLIED 14 NON-TWIN UNPREFIXED RECORDS ===`);
  for (const doc of nonTwins) {
    console.log({
      id: doc.externalId,
      name: doc.name,
      address: doc.address,
      phone: doc.phone,
      amenities: doc.amenities,
      lat: doc.lat,
      lng: doc.lng
    });
  }

  await disconnectDatabase();
}

checkDetails().catch(console.error);
