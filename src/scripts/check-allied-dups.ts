import { connectDatabase, disconnectDatabase } from '../config/database';
import { Location, Provider } from '../models';

async function main() {
  await connectDatabase();
  const provider = await Provider.findOne({ slug: 'allied' });
  if (!provider) {
    console.log('Allied provider not found');
    await disconnectDatabase();
    return;
  }

  const allAllied = await Location.find({ providerId: provider._id });
  console.log('=== ALLIED BANK DUPLICATION AUDIT ===');
  console.log(`Total Allied Locations in DB: ${allAllied.length}`);

  let prefixedCount = 0;
  let unprefixedCount = 0;
  let otherCount = 0;

  const unprefixedList: any[] = [];
  const prefixedSet = new Set<string>();

  for (const loc of allAllied) {
    const ext = String(loc.externalId || '');
    if (ext.startsWith('allied_')) {
      prefixedCount++;
      prefixedSet.add(ext);
    } else if (/^\d+$/.test(ext)) {
      unprefixedCount++;
      unprefixedList.push(loc);
    } else {
      otherCount++;
    }
  }

  console.log(`- Prefixed (allied_*):       ${prefixedCount}`);
  console.log(`- Unprefixed numeric (1234): ${unprefixedCount}`);
  console.log(`- Other format:              ${otherCount}`);

  let exactTwinCount = 0;
  let nonTwinUnprefixed = 0;
  for (const loc of unprefixedList) {
    const twinKey = `allied_${loc.externalId}`;
    if (prefixedSet.has(twinKey)) {
      exactTwinCount++;
    } else {
      nonTwinUnprefixed++;
    }
  }

  console.log(`- Exact twin duplicates:     ${exactTwinCount} (these are 100% redundant duplicates)`);
  console.log(`- Unprefixed without twin:   ${nonTwinUnprefixed}`);

  // Now let's check spatial / proximity duplicates among prefixed records
  const prefixedDocs = allAllied.filter(x => String(x.externalId || '').startsWith('allied_'));
  const coordMap = new Map<string, any[]>();
  for (const loc of prefixedDocs) {
    const key = `${loc.lat.toFixed(5)},${loc.lng.toFixed(5)}`;
    if (!coordMap.has(key)) coordMap.set(key, []);
    coordMap.get(key)!.push(loc);
  }

  let spatialOverlapCount = 0;
  const spatialSamples: any[] = [];
  for (const [coord, list] of coordMap.entries()) {
    if (list.length > 1) {
      spatialOverlapCount += (list.length - 1);
      if (spatialSamples.length < 5) {
        spatialSamples.push({
          coord,
          count: list.length,
          items: list.map(x => ({
            id: x.externalId,
            name: x.name,
            address: x.address,
            phone: x.phone,
            amenities: x.amenities
          }))
        });
      }
    }
  }

  console.log(`- Spatial overlaps in clean prefixed set: ${spatialOverlapCount} locations`);
  if (spatialSamples.length > 0) {
    console.log('Sample spatial co-locations (e.g. Branch + ATM at same address):');
    console.log(JSON.stringify(spatialSamples, null, 2));
  }

  await disconnectDatabase();
}

main().catch(console.error);
