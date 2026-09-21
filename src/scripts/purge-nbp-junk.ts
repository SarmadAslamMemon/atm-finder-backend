import { connectDatabase, disconnectDatabase } from '../config/database';
import { Location, Provider } from '../models';

async function purgeNbpJunk() {
  await connectDatabase();

  console.log('🧹 Purging corrupt / JavaScript table-header entries from NBP in MongoDB...\n');

  const jsRegex = /(?:function\s+tdmouseover|font-family|<script|<\/script|<style|<\/style|el\.style|tdmouseout|ATM LocationBranch)/i;

  // 1. Find all locations with corrupt JS or table header names / addresses
  const junkLocations = await Location.find({
    $or: [
      { name: { $regex: jsRegex } },
      { address: { $regex: jsRegex } },
      { 'rawData.name': { $regex: jsRegex } },
      { externalId: { $regex: /^nbp_atm__\d+$/ } }, // Empty branch code artifacts
    ]
  }).lean();

  console.log(`Found ${junkLocations.length} corrupt / fake table-header entries to remove.`);

  if (junkLocations.length > 0) {
    const idsToDelete = junkLocations.map(l => l._id);
    const deleteResult = await Location.deleteMany({ _id: { $in: idsToDelete } });
    console.log(`✅ Deleted ${deleteResult.deletedCount} corrupt entries.`);
  }

  // 2. Also check if any other NBP location has generic name like "NBP ATM - Karachi" that needs proper name
  const nbpProvider = await Provider.findOne({ slug: 'nbp' }).lean();
  if (nbpProvider) {
    const remainingNbpCount = await Location.countDocuments({ providerId: nbpProvider._id });
    console.log(`\n📊 Valid NBP locations remaining in DB: ${remainingNbpCount}`);
  }

  await disconnectDatabase();
}

purgeNbpJunk().catch(err => {
  console.error('Error purging junk:', err);
  process.exit(1);
});
