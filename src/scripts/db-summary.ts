import { connectDatabase, disconnectDatabase } from '../config/database';
import { City, Location, Provider } from '../models';

async function getDbSummary(): Promise<void> {
  await connectDatabase();

  const totalLocations = await Location.countDocuments();
  const totalCities = await City.countDocuments();

  const providerBreakdown = await Location.aggregate([
    {
      $group: {
        _id: '$providerId',
        count: { $sum: 1 },
        atms: { $sum: { $cond: ['$amenities.atm', 1, 0] } },
        cdms: { $sum: { $cond: ['$amenities.cdm', 1, 0] } },
        islamic: { $sum: { $cond: ['$amenities.islamic', 1, 0] } },
      },
    },
    {
      $lookup: {
        from: 'providers',
        localField: '_id',
        foreignField: '_id',
        as: 'provider',
      },
    },
    { $unwind: '$provider' },
    { $sort: { count: -1 } },
  ]);

  console.log('======================================================');
  console.log(`🚀 TOTAL LOCATIONS IN DB: ${totalLocations}`);
  console.log(`🏙️  TOTAL CITIES LINKED:  ${totalCities}`);
  console.log('======================================================');
  console.log('Provider Breakdown:');
  providerBreakdown.forEach((p, idx) => {
    console.log(
      `${idx + 1}. ${p.provider.name.padEnd(28)} | Total: ${String(p.count).padStart(5)} | ATMs: ${String(p.atms).padStart(5)} | CDMs: ${String(p.cdms).padStart(4)} | Islamic: ${String(p.islamic).padStart(4)}`
    );
  });
  console.log('======================================================');

  await disconnectDatabase();
}

getDbSummary().catch((err) => {
  console.error(err);
  process.exit(1);
});
