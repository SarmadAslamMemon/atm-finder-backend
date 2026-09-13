import fs from 'fs';
import path from 'path';
import { connectDatabase, disconnectDatabase } from '../../config/database';
import { Location, Provider } from '../../models';
import { cleanAndNormalizeCity } from '../shared/cities';
import { createScraperContext, createStats, resolveCityId } from '../shared/upsert';

interface AskariRawBranch {
  id: number | string;
  name: string;
  category?: string;
  city?: string;
  lat: string | number;
  lng: string | number;
  address?: string;
  branch_code?: string | number;
  branch_email?: string;
  branch_fax?: string;
  branch_manager?: string;
  branch_pabx_1?: string;
  manager_operations?: string;
  status?: number;
  [key: string]: unknown;
}

function sanitizeCoordinates(rawLat: unknown, rawLng: unknown): { lat: number; lng: number } | null {
  let lat = typeof rawLat === 'string' ? parseFloat(rawLat) : Number(rawLat);
  let lng = typeof rawLng === 'string' ? parseFloat(rawLng) : Number(rawLng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
    return null;
  }

  // Fix typos where decimal dot was misplaced (e.g. 674.585 -> 67.4585 or 248.61 -> 24.861)
  if (lng >= 600 && lng <= 800) lng = lng / 10;
  if (lat >= 230 && lat <= 390) lat = lat / 10;

  // Strict GeoJSON boundary validation
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return null;
  }

  return { lat, lng };
}

async function loadAskariData(): Promise<AskariRawBranch[]> {
  const possibleFiles = [
    'askri.json',
    'askari.json',
    'branch_askari.json',
    'askri.html',
    'askari.html',
  ];

  for (const fileName of possibleFiles) {
    const filePath = path.resolve(process.cwd(), fileName);
    if (fs.existsSync(filePath)) {
      console.log(`Reading Askari Bank data from local file ${fileName}...`);
      const content = fs.readFileSync(filePath, 'utf-8').trim();
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) return parsed as AskariRawBranch[];
        if (parsed && typeof parsed === 'object') {
          if (Array.isArray(parsed.branches)) return parsed.branches as AskariRawBranch[];
          if (Array.isArray(parsed.data)) return parsed.data as AskariRawBranch[];
          if (Array.isArray(parsed.result)) return parsed.result as AskariRawBranch[];
        }
      } catch (err) {
        console.warn(`JSON parse error on ${fileName}:`, (err as Error).message);
      }
    }
  }

  return [];
}

export async function scrapeAskariDirect(): Promise<void> {
  console.log('--- Starting Lightning-Fast Askari Bank Ingestion ---');
  await connectDatabase();

  const ctx = await createScraperContext();
  const provider = await Provider.findOne({ slug: 'askari' });
  if (!provider) {
    throw new Error('Askari Bank provider not found in DB! Please run seed first.');
  }

  const rawList = await loadAskariData();
  console.log(`Loaded ${rawList.length} Askari Bank records.`);

  const seenIds = new Set<string>();
  const bulkOps: unknown[] = [];
  let skipped = 0;

  for (const item of rawList) {
    const coords = sanitizeCoordinates(item.lat, item.lng);
    if (!coords) {
      skipped++;
      continue;
    }

    const { lat, lng } = coords;

    const externalId = `askari_${item.id}`;
    if (seenIds.has(externalId)) continue;
    seenIds.add(externalId);

    const name = item.name ? item.name.trim() : 'Askari Bank Branch';
    const address = item.address ? item.address.trim() : name;
    const category = String(item.category || '');

    const rawCity = item.city && item.city.trim() ? item.city.trim() : address;
    const canonicalCity = cleanAndNormalizeCity(rawCity);
    const cityId = await resolveCityId(ctx, canonicalCity);

    const isIslamic =
      category.toLowerCase().includes('islamic') ||
      name.toLowerCase().includes('islamic') ||
      address.toLowerCase().includes('islamic');
    const isAgri = category.toLowerCase().includes('agri') || category.toLowerCase().includes('agriculture');
    const isAtm = category.toLowerCase().includes('atm') || name.toLowerCase().includes('atm');

    const locationTypeCode = isIslamic ? 'isl' : isAgri ? 'agri' : isAtm ? 'atm' : 'brnch';
    const locationTypeId = ctx.locationTypes.get(locationTypeCode);

    const phoneCandidates = [
      item.branch_pabx_1,
      item.branch_manager,
      item.manager_operations,
    ].filter((p) => p && p !== '0' && p.trim().length > 3);

    const phone = phoneCandidates.length > 0 ? phoneCandidates[0]!.trim() : undefined;

    const updateDoc = {
      providerId: provider._id,
      cityId,
      locationTypeId,
      externalId,
      name,
      address,
      lat,
      lng,
      location: { type: 'Point', coordinates: [lng, lat] },
      phone,
      amenities: {
        atm: true,
        islamic: isIslamic,
        biometric: true,
      },
      isActive: item.status !== 0,
      isVerified: true,
      rawData: item as unknown as Record<string, unknown>,
    };

    bulkOps.push({
      updateOne: {
        filter: { providerId: provider._id, externalId },
        update: { $set: updateDoc },
        upsert: true,
      },
    });
  }

  console.log(`Executing bulkWrite of ${bulkOps.length} records...`);

  // Execute in batches of 500 for optimal memory & network performance
  const batchSize = 500;
  for (let i = 0; i < bulkOps.length; i += batchSize) {
    const chunk = bulkOps.slice(i, i + batchSize);
    await Location.bulkWrite(chunk as any, { ordered: false });
  }

  const finalCount = await Location.countDocuments({ providerId: provider._id });

  console.log('======================================================');
  console.log('✅ Askari Bank Ingestion Complete:');
  console.log(`- Processed: ${bulkOps.length}`);
  console.log(`- Skipped:   ${skipped}`);
  console.log(`- Total Askari Bank records in DB now: ${finalCount}`);
  console.log('======================================================');

  await disconnectDatabase();
}

if (require.main === module) {
  scrapeAskariDirect().catch((err) => {
    console.error('Askari Bank ingestion failed:', err);
    process.exit(1);
  });
}
