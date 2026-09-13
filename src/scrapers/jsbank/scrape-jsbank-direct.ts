import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { connectDatabase, disconnectDatabase } from '../../config/database';
import { City, Location, Provider } from '../../models';
import { cleanAndNormalizeCity } from '../shared/cities';
import { createScraperContext, createStats, recordUpsert, resolveCityId } from '../shared/upsert';

const LIVE_API_URL = 'https://jsbl.com/wp-admin/admin-ajax.php?action=asl_load_stores';

interface JsBankRawLocation {
  id: string | number;
  title?: string;
  name?: string;
  street?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  lat: string | number;
  lng: string | number;
  phone?: string;
  description_2?: string;
  open_hours?: string | Record<string, unknown>;
  days_str?: string;
  categories?: string;
  slug?: string;
  [key: string]: unknown;
}

function parseCoordinate(val: unknown): number {
  if (typeof val === 'number') return Number.isFinite(val) ? val : NaN;
  if (!val || typeof val !== 'string') return NaN;
  const str = val.trim();
  if (!str) return NaN;

  // 1. Check for DMS formats like: 25°23'40", 25'23'40', 25 23 40
  const dmsMatch = str.match(/(\d+)[\s°'’]+(\d+)[\s'’]+(\d+(?:\.\d+)?)[\s"’']*/);
  if (dmsMatch) {
    const deg = parseFloat(dmsMatch[1]);
    const min = parseFloat(dmsMatch[2]);
    const sec = parseFloat(dmsMatch[3]);
    const decimal = deg + min / 60 + sec / 3600;
    if (decimal >= -180 && decimal <= 180) {
      return decimal;
    }
  }

  // 2. Standard decimal
  const num = parseFloat(str);
  if (Number.isFinite(num) && num >= -180 && num <= 180) {
    return num;
  }

  return NaN;
}

function parseTitle(item: JsBankRawLocation): string {
  if (item.title && item.title.trim()) return item.title.trim();
  if (item.name && item.name.trim()) return item.name.trim();
  if (item.slug && item.slug.trim()) {
    return item.slug
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  return 'JS Bank Branch';
}

async function loadJsBankData(): Promise<JsBankRawLocation[]> {
  const possibleFiles = [
    'test-js.json',
    'branch.json',
    'branch_jsbank.json',
    'jsbank.json',
    'branch_jsbank',
    'branch_jsbank.txt',
  ];

  for (const fileName of possibleFiles) {
    const filePath = path.resolve(process.cwd(), fileName);
    if (fs.existsSync(filePath)) {
      console.log(`Reading JS Bank data from local file ${fileName}...`);
      let content = fs.readFileSync(filePath, 'utf-8').trim();
      if (!content.startsWith('[')) content = '[' + content;
      if (!content.endsWith(']')) content = content + ']';
      const parsed = JSON.parse(content);
      const list = Array.isArray(parsed) ? parsed : (parsed.data || parsed.result || []);
      if (list.length > 0 && (list[0].id || list[0].street)) {
        return list as JsBankRawLocation[];
      }
    }
  }

  console.log(`Fetching live JS Bank stores from ${LIVE_API_URL}...`);
  try {
    const { data } = await axios.get(LIVE_API_URL, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',
        'X-Requested-With': 'XMLHttpRequest',
      },
      timeout: 30_000,
    });
    return Array.isArray(data) ? (data as JsBankRawLocation[]) : [];
  } catch (err) {
    console.warn(`Direct live fetch failed (${(err as Error).message}).`);
  }

  return [];
}

export async function scrapeJsBankDirect(): Promise<void> {
  console.log('--- Starting JS Bank Direct Ingestion ---');
  await connectDatabase();

  const ctx = await createScraperContext();
  const provider = await Provider.findOne({ slug: 'jsbank' });
  if (!provider) {
    throw new Error('JS Bank provider not found in DB! Please run seed first.');
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

  const rawList = await loadJsBankData();
  console.log(`Loaded ${rawList.length} JS Bank records.`);

  const seenIds = new Set<string>();
  const bulkOps: any[] = [];
  let skipped = 0;

  for (const item of rawList) {
    let lat = parseCoordinate(item.lat);
    let lng = parseCoordinate(item.lng);

    const externalId = `jsbank_${item.id}`;
    if (seenIds.has(externalId)) continue;
    seenIds.add(externalId);

    const name = parseTitle(item);
    const address = item.street || item.address || name;

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
        skipped++;
        continue;
      }
    }

    const categoriesStr = String(item.categories || '');
    const categoriesList = categoriesStr.split(',').map((c) => c.trim());

    const hasAtm =
      categoriesList.includes('20') ||
      name.toLowerCase().includes('atm') ||
      address.toLowerCase().includes('atm');
    const hasLocker = categoriesList.includes('21');
    const isSaturdayOpen =
      categoriesList.includes('19') ||
      String(item.days_str || '').toLowerCase().includes('sat');
    const isPwdFriendly = categoriesList.includes('25');
    const isIslamic =
      name.toLowerCase().includes('islamic') ||
      name.toLowerCase().includes('zameen') ||
      address.toLowerCase().includes('islamic');

    const locationTypeCode = isIslamic ? 'isl' : hasAtm && name.toLowerCase().includes('atm') ? 'atm' : 'brnch';
    const locationTypeId = ctx.locationTypes.get(locationTypeCode);

    // Parse operating hours if available
    let timings: Record<string, unknown> | undefined;
    if (typeof item.open_hours === 'string' && item.open_hours.startsWith('{')) {
      try {
        timings = JSON.parse(item.open_hours);
      } catch {
        // quiet
      }
    } else if (typeof item.open_hours === 'object') {
      timings = item.open_hours as Record<string, unknown>;
    }

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
      phone: item.phone && item.phone !== '-' ? item.phone.trim() : undefined,
      amenities: {
        atm: hasAtm,
        locker: hasLocker,
        saturdayOpen: isSaturdayOpen,
        wheelchairAccessible: isPwdFriendly,
        islamic: isIslamic,
        biometric: true,
      },
      isActive: true,
      isVerified: true,
      rawData: {
        ...item,
        parsedTimings: timings,
        description2: item.description_2,
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

  const finalCount = await Location.countDocuments({ providerId: provider._id });

  console.log('======================================================');
  console.log('✅ JS Bank Ingestion Complete:');
  console.log(`- Total Records in DB:    ${finalCount}`);
  console.log(`- Upserted (New):         ${totalUpserted}`);
  console.log(`- Modified (Updated):     ${totalModified}`);
  console.log(`- Skipped:                ${skipped}`);
  console.log('======================================================');

  await disconnectDatabase();
}

if (require.main === module) {
  scrapeJsBankDirect().catch((err) => {
    console.error('JS Bank ingestion failed:', err);
    process.exit(1);
  });
}
