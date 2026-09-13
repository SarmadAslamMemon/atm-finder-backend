import fs from 'fs';
import path from 'path';
import { connectDatabase, disconnectDatabase } from '../config/database';
import { Location, LocationType, Provider } from '../models';
import { resolveCityId, createScraperContext, createStats, recordUpsert } from '../scrapers/shared/upsert';

interface MeezanRawBranch {
  branch_id: string;
  branch_name: string;
  branch_address: string;
  branch_code?: string;
  branch_phone?: string;
  branch_fax?: string | null;
  branch_email?: string | null;
  branch_manager?: string | null;
  branch_latitude: string | number;
  branch_longitude: string | number;
  branch_map?: string | null;
  offsite_atm?: string | number;
  onsite_atm?: string | number;
  saturday_on?: string | number;
  premium_banking_center?: string | number;
  city_id?: string | number;
  fx_branches?: string | number;
  cash_deposit?: string | number;
  digital_branch?: string | number;
  city_name: string;
}

export async function ingestMeezanDump(): Promise<void> {
  console.log('--- Ingesting Official Meezan Bank Branch Network Dump ---');
  await connectDatabase();

  const ctx = await createScraperContext();
  const provider = await Provider.findOne({ slug: 'meezan' });
  if (!provider) {
    throw new Error('Meezan Bank provider not found in database! Please run npm run seed first.');
  }

  const islType = await LocationType.findOne({ code: 'isl' });
  const branchType = await LocationType.findOne({ code: 'brnch' });
  const typeId = islType?._id || branchType?._id;

  const dumpPath = path.resolve(process.cwd(), 'branch');
  if (!fs.existsSync(dumpPath)) {
    throw new Error(`Dump file not found at ${dumpPath}`);
  }

  let rawContent = fs.readFileSync(dumpPath, 'utf-8').trim();
  if (!rawContent.startsWith('[')) {
    rawContent = '[' + rawContent;
  }
  if (!rawContent.endsWith(']')) {
    rawContent = rawContent + ']';
  }

  const branches: MeezanRawBranch[] = JSON.parse(rawContent);
  console.log(`Parsed ${branches.length} Meezan Bank records from dump file.`);

  const stats = createStats();

  for (const item of branches) {
    const lat = typeof item.branch_latitude === 'string' ? parseFloat(item.branch_latitude) : item.branch_latitude;
    const lng = typeof item.branch_longitude === 'string' ? parseFloat(item.branch_longitude) : item.branch_longitude;

    if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
      stats.skipped += 1;
      continue;
    }

    const cityName = item.city_name || 'Pakistan';
    const cityId = await resolveCityId(ctx, cityName);

    const hasAtm = item.onsite_atm === '1' || item.onsite_atm === 1 || item.offsite_atm === '1' || item.offsite_atm === 1;
    const hasCdm = item.cash_deposit === '1' || item.cash_deposit === 1;
    const isSaturdayOpen = item.saturday_on === '1' || item.saturday_on === 1;

    const externalId = `meezan_${item.branch_id}`;

    const updateDoc = {
      providerId: provider._id,
      cityId,
      locationTypeId: typeId,
      externalId,
      name: item.branch_name.trim(),
      address: item.branch_address.trim(),
      lat,
      lng,
      location: { type: 'Point', coordinates: [lng, lat] },
      phone: item.branch_phone && item.branch_phone !== 'null' ? item.branch_phone.trim() : undefined,
      amenities: {
        atm: hasAtm,
        cdm: hasCdm,
        islamic: true,
        saturdayOpen: isSaturdayOpen,
        biometric: true,
      },
      isActive: true,
      isVerified: true,
      rawData: item as unknown as Record<string, unknown>,
    };

    const existing = await Location.findOne({ providerId: provider._id, externalId }).select('_id');

    await Location.findOneAndUpdate(
      { providerId: provider._id, externalId },
      { $set: updateDoc },
      { upsert: true, returnDocument: 'after' }
    );

    recordUpsert(stats, existing ? 'updated' : 'inserted');
  }

  const finalCount = await Location.countDocuments({ providerId: provider._id });

  console.log('======================================================');
  console.log('✅ Meezan Bank Ingestion Summary:');
  console.log(`- Inserted: ${stats.inserted}`);
  console.log(`- Updated:  ${stats.updated}`);
  console.log(`- Skipped:  ${stats.skipped}`);
  console.log(`- Total Meezan records in DB now: ${finalCount}`);
  console.log('======================================================');

  await disconnectDatabase();
}

if (require.main === module) {
  ingestMeezanDump().catch((err) => {
    console.error('Ingestion failed:', err);
    process.exit(1);
  });
}
