import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { connectDatabase, disconnectDatabase } from '../../config/database';
import { City, Location, LocationType, Provider } from '../../models';
import { cleanAndNormalizeCity } from '../shared/cities';
import { createScraperContext, resolveCityId } from '../shared/upsert';

const SINDH_BANK_API_URL = 'https://www.sindhbank.com.pk/wp-admin/admin-ajax.php?action=search_branches&term=';

interface SindhBankRawBranch {
  id: string | number;
  code?: string;
  name: string;
  address?: string;
  city?: string;
  phone_no?: string;
  latitude?: string | number;
  longitude?: string | number;
  lat?: string | number;
  lng?: string | number;
  branch_type?: string;
  is_islamic?: string | boolean | number;
  has_atm?: string | boolean | number;
  [key: string]: unknown;
}

function parseCoordinate(val: unknown): number {
  if (typeof val === 'number') return Number.isFinite(val) ? val : NaN;
  if (!val || typeof val !== 'string') return NaN;
  const str = val.replace(/[^\d.\-°'’" ]/g, '').trim();
  if (!str) return NaN;

  // 1. Check DMS
  const dmsMatch = str.match(/(\d+)[\s°'’]+(\d+)[\s'’]+(\d+(?:\.\d+)?)[\s"’']*/);
  if (dmsMatch) {
    const deg = parseFloat(dmsMatch[1]);
    const min = parseFloat(dmsMatch[2]);
    const sec = parseFloat(dmsMatch[3]);
    const decimal = deg + min / 60 + sec / 3600;
    if (decimal >= -180 && decimal <= 180) return decimal;
  }

  // 2. Standard decimal
  const num = parseFloat(str);
  if (Number.isFinite(num)) {
    if (num > 180 || num < -180) {
      if (str.length >= 4) {
        const adjusted = parseFloat(str.slice(0, 2) + '.' + str.slice(2));
        if (Number.isFinite(adjusted) && adjusted >= -180 && adjusted <= 180) {
          return adjusted;
        }
      }
    } else {
      return num;
    }
  }

  return NaN;
}

async function loadSindhBankData(): Promise<SindhBankRawBranch[]> {
  const possibleFiles = ['sindhbank.json', 'sindh_bank.json', 'branch_sindh.json'];
  for (const fileName of possibleFiles) {
    const filePath = path.resolve(process.cwd(), fileName);
    if (fs.existsSync(filePath)) {
      console.log(`Reading Sindh Bank data from local file ${fileName}...`);
      const content = fs.readFileSync(filePath, 'utf-8').trim();
      try {
        const parsed = JSON.parse(content);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {
        // quiet
      }
    }
  }

  console.log(`Fetching live Sindh Bank branches from ${SINDH_BANK_API_URL}...`);
  try {
    const { data } = await axios.get(SINDH_BANK_API_URL, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.sindhbank.com.pk/branch-locator/',
        'X-Requested-With': 'XMLHttpRequest',
      },
      timeout: 30_000,
    });

    if (Array.isArray(data)) {
      return data as SindhBankRawBranch[];
    }
  } catch (err: any) {
    console.warn(`Direct live fetch failed (${err.message}).`);
  }

  return [];
}

export async function scrapeSindhBankDirect(): Promise<void> {
  console.log('======================================================');
  console.log('--- Starting Sindh Bank Direct Ingestion ---');
  console.log('======================================================');
  await connectDatabase();

  const ctx = await createScraperContext();
  const provider = await Provider.findOne({ slug: 'sindhbank' });
  if (!provider) {
    throw new Error('Sindh Bank provider not found in DB! Please run seed first.');
  }

  // Pre-load all canonical cities into cache
  const allCityDocs = await City.find().select('_id name center');
  const cityCenterMap = new Map<string, [number, number]>();
  for (const c of allCityDocs) {
    ctx.cityCache.set(c.name.trim().toLowerCase(), c._id);
    const center = (c as any).center;
    if (center?.coordinates && center.coordinates.length === 2) {
      cityCenterMap.set(c._id.toString(), [center.coordinates[0], center.coordinates[1]]);
    }
  }

  const islTypeId = ctx.locationTypes.get('isl') || (await LocationType.findOne({ code: 'isl' }))?._id;
  const branchTypeId = ctx.locationTypes.get('brnch') || (await LocationType.findOne({ code: 'brnch' }))?._id;
  const atmTypeId = ctx.locationTypes.get('atm') || (await LocationType.findOne({ code: 'atm' }))?._id;

  const rawList = await loadSindhBankData();
  console.log(`Loaded ${rawList.length} Sindh Bank records.`);

  const seenIds = new Set<string>();
  const bulkOps: any[] = [];
  let resolvedFallbackCoords = 0;

  for (const item of rawList) {
    const rawId = item.id || item.code || item.name;
    const externalId = `sindhbank_${rawId}`;
    if (seenIds.has(externalId)) continue;
    seenIds.add(externalId);

    let lat = parseCoordinate(item.latitude ?? item.lat);
    let lng = parseCoordinate(item.longitude ?? item.lng);

    const name = item.name ? item.name.trim() : 'Sindh Bank Branch';
    const address = (item.address && item.address.trim()) ? item.address.trim() : name;

    const rawCity = item.city && item.city.trim() ? item.city.trim() : address;
    const canonicalCity = cleanAndNormalizeCity(rawCity);
    const cityId = await resolveCityId(ctx, canonicalCity);

    const isValidCoord =
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= 23 &&
      lat <= 38 &&
      lng >= 60 &&
      lng <= 78;

    if (!isValidCoord) {
      const centerCoords = cityCenterMap.get(cityId.toString());
      if (centerCoords) {
        lng = centerCoords[0];
        lat = centerCoords[1];
      } else {
        lat = 25.8943;
        lng = 68.5247;
      }
      resolvedFallbackCoords++;
    }

    const isIslamic =
      name.toLowerCase().includes('islamic') ||
      name.toLowerCase().includes('saadat') ||
      address.toLowerCase().includes('islamic');

    const isAtmStandalone =
      name.toLowerCase().includes('atm') &&
      !name.toLowerCase().includes('branch');

    const hasAtm =
      isAtmStandalone ||
      name.toLowerCase().includes('atm') ||
      address.toLowerCase().includes('atm') ||
      true; // Sindh Bank branches feature on-site 1LINK ATMs

    const locationTypeId = isIslamic
      ? islTypeId
      : isAtmStandalone
      ? atmTypeId
      : branchTypeId;

    const phone = item.phone_no && item.phone_no.trim() !== '-' ? item.phone_no.trim() : undefined;

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
        atm: hasAtm,
        islamic: isIslamic,
        biometric: true,
      },
      isActive: true,
      isVerified: true,
      rawData: {
        ...item,
      },
    };

    bulkOps.push({
      updateOne: {
        filter: { providerId: provider._id, externalId },
        update: { $set: updateDoc },
        upsert: true,
      },
    });
  }

  console.log(`Executing ${bulkOps.length} atomic bulkWrite upserts...`);
  const BATCH_SIZE = 500;
  let totalInserted = 0;
  let totalModified = 0;
  let totalUpserted = 0;

  for (let i = 0; i < bulkOps.length; i += BATCH_SIZE) {
    const batch = bulkOps.slice(i, i + BATCH_SIZE);
    const result = await Location.bulkWrite(batch, { ordered: false });
    totalInserted += result.insertedCount || 0;
    totalModified += result.modifiedCount || 0;
    totalUpserted += result.upsertedCount || 0;
  }

  // Remove old partial records from old peekaboo scraper
  const cleanedOld = await Location.deleteMany({
    providerId: provider._id,
    externalId: { $not: /^sindhbank_/ },
  });
  if (cleanedOld.deletedCount > 0) {
    console.log(`🧹 Cleaned up ${cleanedOld.deletedCount} old dummy Sindh Bank records.`);
  }

  const finalCount = await Location.countDocuments({ providerId: provider._id });
  const islamicCount = await Location.countDocuments({
    providerId: provider._id,
    'amenities.islamic': true,
  });

  console.log('======================================================');
  console.log('✅ Sindh Bank Ingestion Complete:');
  console.log(`- Total Records in DB:    ${finalCount}`);
  console.log(`- Upserted (New):         ${totalUpserted}`);
  console.log(`- Modified (Updated):     ${totalModified}`);
  console.log(`- Islamic Branches:       ${islamicCount}`);
  console.log(`- Resolved Fallback Geo:  ${resolvedFallbackCoords}`);
  console.log('======================================================');

  await disconnectDatabase();
}

if (require.main === module) {
  scrapeSindhBankDirect().catch((err) => {
    console.error('Sindh Bank ingestion failed:', err);
    process.exit(1);
  });
}
