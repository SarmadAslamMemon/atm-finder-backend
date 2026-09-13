import { connectDatabase, disconnectDatabase } from '../config/database';
import { City, Location } from '../models';

async function checkCityTable(): Promise<void> {
  await connectDatabase();

  const totalCities = await City.countDocuments();
  const totalLocations = await Location.countDocuments();

  console.log('--- City Table Diagnostic ---');
  console.log(`Total Cities in DB: ${totalCities}`);
  console.log(`Total Locations in DB: ${totalLocations}`);

  // 1. Check for any duplicate city names (case-insensitive)
  const duplicates = await City.aggregate([
    {
      $group: {
        _id: { $toLower: '$name' },
        count: { $sum: 1 },
        names: { $addToSet: '$name' },
        ids: { $push: '$_id' },
      },
    },
    { $match: { count: { $gt: 1 } } },
  ]);

  if (duplicates.length === 0) {
    console.log('✅ ZERO Duplicate City Names found!');
  } else {
    console.log(`⚠️ Found ${duplicates.length} duplicate city names:`);
    for (const d of duplicates) {
      console.log(`- ${d._id} (${d.count} records): ${JSON.stringify(d.names)}`);
    }
  }

  // 2. Check Top 10 Cities by Location count
  const topCities = await Location.aggregate([
    { $group: { _id: '$cityId', count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 10 },
    {
      $lookup: {
        from: 'cities',
        localField: '_id',
        foreignField: '_id',
        as: 'city',
      },
    },
    { $unwind: { path: '$city', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        cityName: '$city.name',
        region: '$city.region',
        count: 1,
      },
    },
  ]);

  console.log('\nTop 10 Cities by Location Count:');
  topCities.forEach((c, idx) => {
    console.log(`${idx + 1}. ${c.cityName || 'Unknown/Unlinked'} (${c.region || 'N/A'}): ${c.count} locations`);
  });

  // 3. Check for any unlinked locations (missing or invalid cityId)
  const unlinked = await Location.countDocuments({
    $or: [{ cityId: { $exists: false } }, { cityId: null }],
  });
  console.log(`\nUnlinked Locations (missing cityId): ${unlinked}`);

  await disconnectDatabase();
}

checkCityTable().catch((err) => {
  console.error('Check failed:', err);
  process.exit(1);
});
