import axios from 'axios';
import { connectDatabase, disconnectDatabase } from '../../config/database';
import { env } from '../../config/env';
import { Location, Provider } from '../../models';
import { cleanAndNormalizeCity } from '../shared/cities';
import { createScraperContext, createStats, recordUpsert, resolveCityId } from '../shared/upsert';

const UBL_OWNER_KEY = env.UBL_OWNER_KEY || '7db159dc932ec461c1a6b9c1778bb2b0';
const CITIES_API_URL = 'https://secure-sdk.peekaboo.guru/klaoshcjanaij2mcdoiaodmnsasjd5';
const BRANCHES_API_URL = 'https://secure-sdk.peekaboo.guru/kbprosamdmnioblcruahnhdcjhs_ahajlhljlgjhaskjgl5';

interface PeekabooCityResponse {
  cities?: Array<{ name: string; totalBranches?: number }>;
  data?: Array<{ name: string; totalBranches?: number }>;
}

interface RawBranch {
  id: number;
  name: string;
  city: string;
  country: string;
  address: string;
  latitude: number;
  longitude: number;
  everyDayTimngs?: Record<string, string>;
  amenities?: Record<string, { value?: string }>;
  contactNumber?: string;
  branchOpenNow?: string;
  isVerified?: number;
  [key: string]: unknown;
}

interface PeekabooBranchResponse {
  totalBranches?: number;
  branches?: RawBranch[];
}

const HEADERS = {
  accept: 'application/json, text/plain, */*',
  'content-type': 'application/json',
  medium: 'IFRAME',
  origin: 'https://ubl-web.peekaboo.guru',
  referer: 'https://ubl-web.peekaboo.guru/',
  ownerkey: UBL_OWNER_KEY,
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',
};

async function fetchCities(): Promise<string[]> {
  try {
    const { data } = await axios.post<PeekabooCityResponse>(
      CITIES_API_URL,
      { mstoaw: 'en', mnakls: '500', opmsta: '0', n4ja3s: 'Pakistan', klaosw: false },
      { headers: HEADERS, timeout: 30_000 }
    );

    const list = data.cities || data.data || [];
    const cityNames = list.map((c) => c.name).filter(Boolean);

    if (cityNames.length > 0) {
      console.log(`Fetched ${cityNames.length} dynamic cities from UBL Peekaboo endpoint.`);
      return cityNames;
    }
  } catch (err) {
    console.warn('Could not fetch dynamic city list, falling back to core cities:', (err as Error).message);
  }

  return ['Karachi', 'Lahore', 'Islamabad', 'Rawalpindi', 'Faisalabad', 'Multan', 'Peshawar', 'Quetta', 'Sialkot', 'Gujranwala', 'Hyderabad'];
}

async function fetchBranchesForCity(city: string, categoryFilter: number[]): Promise<RawBranch[]> {
  const branches: RawBranch[] = [];
  let offset = 0;
  let total = Infinity;
  const pageSize = 250;

  while (offset < total) {
    const payload = {
      fksyd: city,
      n4ja3s: 'Pakistan',
      js6nwf: '0',
      pan3ba: '0',
      mstoaw: 'en',
      kisu87: 'me',
      matsw: 'United Bank Limited (UBL)',
      mnakls: String(pageSize),
      opmsta: String(offset),
      makthya: 'alphabetical',
      '9msh': 'asc',
      klaosw: false,
      '7WdpTO': categoryFilter,
    };

    const { data } = await axios.post<PeekabooBranchResponse>(BRANCHES_API_URL, payload, {
      headers: HEADERS,
      timeout: 30_000,
    });

    const page = data.branches || [];
    total = data.totalBranches ?? page.length;
    branches.push(...page);
    offset += pageSize;

    if (page.length === 0) break;
  }

  return branches;
}

export async function scrapeUblFull(): Promise<void> {
  console.log('--- Starting Complete UBL Enrichment Scraper ---');
  await connectDatabase();

  const ctx = await createScraperContext();
  const provider = await Provider.findOne({ slug: 'ubl' });
  if (!provider) {
    throw new Error('UBL provider not found in database! Please run seed first.');
  }

  const cities = await fetchCities();
  const stats = createStats();
  const seenExternalIds = new Set<string>();

  const CATEGORIES = [
    { code: 98, type: 'atm' as const, label: 'ATMs' },
    { code: 168, type: 'brnch' as const, label: 'Branches' },
  ];

  for (let i = 0; i < cities.length; i++) {
    const city = cities[i];
    console.log(`[${i + 1}/${cities.length}] Scraping UBL for ${city}...`);

    for (const cat of CATEGORIES) {
      try {
        const rawList = await fetchBranchesForCity(city, [cat.code]);

        for (const item of rawList) {
          const externalId = `ubl_${item.id}`;
          if (seenExternalIds.has(externalId)) continue;
          seenExternalIds.add(externalId);

          const lat = typeof item.latitude === 'string' ? parseFloat(item.latitude) : item.latitude;
          const lng = typeof item.longitude === 'string' ? parseFloat(item.longitude) : item.longitude;

          if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
            stats.skipped += 1;
            continue;
          }

          const canonicalCity = cleanAndNormalizeCity(item.city || city);
          const cityId = await resolveCityId(ctx, canonicalCity);

          const amenitiesObj = item.amenities || {};
          const isAtm = amenitiesObj.atm?.value?.toLowerCase() === 'yes' || cat.type === 'atm';
          const isIslamic = amenitiesObj.islamic?.value?.toLowerCase() === 'yes' || item.name.toLowerCase().includes('ameen');
          const isCdm = amenitiesObj.cdm?.value?.toLowerCase() === 'yes';
          const isLocker = amenitiesObj.locker?.value?.toLowerCase() === 'yes';
          const isBiometric = amenitiesObj.biometric?.value?.toLowerCase() === 'yes';

          const locationTypeCode = isIslamic ? 'isl' : cat.type === 'atm' ? 'atm' : 'brnch';
          const locationTypeId = ctx.locationTypes.get(locationTypeCode);

          const updateDoc = {
            providerId: provider._id,
            cityId,
            locationTypeId,
            externalId,
            name: item.name.trim(),
            address: item.address.trim(),
            lat,
            lng,
            location: { type: 'Point', coordinates: [lng, lat] },
            phone: item.contactNumber?.trim() || undefined,
            amenities: {
              atm: isAtm,
              cdm: isCdm,
              islamic: isIslamic,
              locker: isLocker,
              biometric: isBiometric,
            },
            isActive: true,
            isVerified: item.isVerified === 1,
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
      } catch (err) {
        console.error(`  Failed category ${cat.label} for ${city}:`, (err as Error).message);
      }
    }

    await new Promise((r) => setTimeout(r, 200));
  }

  const finalCount = await Location.countDocuments({ providerId: provider._id });

  console.log('======================================================');
  console.log('✅ UBL Full Scrape Complete:');
  console.log(`- Total unique records processed: ${seenExternalIds.size}`);
  console.log(`- Inserted: ${stats.inserted}`);
  console.log(`- Updated:  ${stats.updated}`);
  console.log(`- Skipped:  ${stats.skipped}`);
  console.log(`- Total UBL locations in DB now: ${finalCount}`);
  console.log('======================================================');

  await disconnectDatabase();
}

if (require.main === module) {
  scrapeUblFull().catch((err) => {
    console.error('UBL scrape failed:', err);
    process.exit(1);
  });
}
