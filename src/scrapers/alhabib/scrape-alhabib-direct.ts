import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { connectDatabase, disconnectDatabase } from '../../config/database';
import { Location, LocationType, Provider } from '../../models';
import { cleanAndNormalizeCity } from '../shared/cities';
import { createScraperContext, createStats, recordUpsert, resolveCityId } from '../shared/upsert';

const API_URL = 'https://www.bankalhabib.com/get-branches';

interface AlHabibRawBranch {
  id: number | string;
  branch_code?: string;
  title: string;
  address: string;
  phone_number?: string;
  saturday_active?: number | string;
  saturday_active_hours?: string;
  friday_active_hours?: string;
  monday_to_thursday_active_hours?: string;
  lat: number | string;
  lng: number | string;
  islamic_window?: number | string;
  pwd?: number | string;
  is_cdm?: number | string;
  branch_type?: string | number;
  country?: string;
  [key: string]: unknown;
}

async function fetchAlHabibBranches(): Promise<AlHabibRawBranch[]> {
  const possibleFiles = [
    'branch.json',
    'alhabib_branches.json',
    'branch_alhabib',
    'alhabib.json',
    'branch_alhabib.json',
    'branch_alhabib.txt',
  ];

  for (const fileName of possibleFiles) {
    const filePath = path.resolve(process.cwd(), fileName);
    if (fs.existsSync(filePath)) {
      console.log(`Reading Bank AL Habib data from local file ${fileName}...`);
      let content = fs.readFileSync(filePath, 'utf-8').trim();
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed)) return parsed;
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.result)) {
          return parsed.result;
        }
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.data)) {
          return parsed.data;
        }
      } catch {
        if (!content.startsWith('[')) content = '[' + content;
        if (!content.endsWith(']')) content = content + ']';
        const parsed = JSON.parse(content);
        return Array.isArray(parsed) ? parsed : (parsed.result || parsed.data || []);
      }
    }
  }

  console.log(`Fetching live branches from ${API_URL}...`);
  const headers = {
    Accept: 'application/json, text/javascript, */*; q=0.01',
    'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',
    'X-Requested-With': 'XMLHttpRequest',
    Referer: 'https://www.bankalhabib.com/branch-locator',
  };

  try {
    const response = await axios.get(API_URL, { headers, timeout: 45_000 });
    const data = response.data;
    if (Array.isArray(data)) return data as AlHabibRawBranch[];
    if (data && typeof data === 'object' && Array.isArray((data as { data?: unknown[] }).data)) {
      return (data as { data: AlHabibRawBranch[] }).data;
    }
    console.warn('Bank AL Habib response was blocked by WAF/Cloudflare. Please save the API JSON response to alhabib_branches.json');
  } catch (err) {
    console.warn(`Direct fetch blocked by F5 WAF (${(err as Error).message}).`);
  }

  return [];
}

export async function scrapeAlHabibDirect(): Promise<void> {
  console.log('--- Starting Official Bank AL Habib Direct Ingestion ---');
  await connectDatabase();

  const ctx = await createScraperContext();
  const provider = await Provider.findOne({ slug: 'alhabib' });
  if (!provider) {
    throw new Error('Bank AL Habib provider not found in DB! Please run seed first.');
  }

  const islTypeId = ctx.locationTypes.get('isl');
  const brnchTypeId = ctx.locationTypes.get('brnch');

  const branches = await fetchAlHabibBranches();
  console.log(`Fetched ${branches.length} Bank AL Habib records.`);

  const stats = createStats();

  for (const item of branches) {
    const lat = typeof item.lat === 'string' ? parseFloat(item.lat) : item.lat;
    const lng = typeof item.lng === 'string' ? parseFloat(item.lng) : item.lng;

    if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
      stats.skipped += 1;
      continue;
    }

    const cityName = cleanAndNormalizeCity(item.address) || cleanAndNormalizeCity(item.title);
    const cityId = await resolveCityId(ctx, cityName);

    const isIslamic = item.islamic_window === 1 || item.islamic_window === '1';
    const isCdm = item.is_cdm === 1 || item.is_cdm === '1';
    const isSaturdayActive = item.saturday_active === 1 || item.saturday_active === '1';
    const isPwd = item.pwd === 1 || item.pwd === '1';

    const locationTypeId = isIslamic ? islTypeId : brnchTypeId;
    const externalId = `alhabib_${item.id}`;

    const updateDoc = {
      providerId: provider._id,
      cityId,
      locationTypeId,
      externalId,
      name: item.title ? item.title.trim() : 'Bank AL Habib Branch',
      address: item.address ? item.address.trim() : 'Pakistan',
      lat,
      lng,
      location: { type: 'Point', coordinates: [lng, lat] },
      phone: item.phone_number && item.phone_number !== 'null' ? item.phone_number.trim() : undefined,
      amenities: {
        atm: true,
        cdm: isCdm,
        islamic: isIslamic,
        saturdayOpen: isSaturdayActive,
        wheelchairAccessible: isPwd,
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
  console.log('✅ Bank AL Habib Ingestion Complete:');
  console.log(`- Inserted: ${stats.inserted}`);
  console.log(`- Updated:  ${stats.updated}`);
  console.log(`- Skipped:  ${stats.skipped}`);
  console.log(`- Total Bank AL Habib locations in DB now: ${finalCount}`);
  console.log('======================================================');

  await disconnectDatabase();
}

if (require.main === module) {
  scrapeAlHabibDirect().catch((err) => {
    console.error('Bank AL Habib scrape failed:', err);
    process.exit(1);
  });
}
