import axios from 'axios';
import { connectDatabase, disconnectDatabase } from '../../config/database';
import { Location, Provider } from '../../models';
import { cleanAndNormalizeCity } from '../shared/cities';
import { createScraperContext, createStats, recordUpsert, resolveCityId } from '../shared/upsert';
import { ALFALAH_CITIES } from '../alfalah/scrape-alfalah-full';

const API_URL = 'https://secure-sdk.peekaboo.guru/kbprosamdmnioblcruahnhdcjhs_ahajlhljlgjhaskjgl5';
const OWNER_KEY = 'de579fa6950f741c1cb383414a590095';

interface RawAlliedBranch {
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

interface PeekabooApiResponse {
  totalBranches?: number;
  branches?: RawAlliedBranch[];
}

export async function scrapeAlliedFull(): Promise<void> {
  console.log(`--- Starting Allied Bank (ABL) Enrichment Scraper (${ALFALAH_CITIES.length} cities) ---`);
  await connectDatabase();

  const ctx = await createScraperContext();
  const provider = await Provider.findOne({ slug: 'allied' });
  if (!provider) {
    throw new Error('Allied Bank provider not found in DB! Please run seed first.');
  }

  const stats = createStats();
  const seenIds = new Set<string>();

  const headers = {
    accept: 'application/json, text/plain, */*',
    'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
    'content-type': 'application/json',
    medium: 'IFRAME',
    origin: 'https://allied-web.peekaboo.guru',
    referer: 'https://allied-web.peekaboo.guru/',
    ownerkey: OWNER_KEY,
    'user-agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',
  };

  const CATEGORIES = [
    { code: 168, type: 'brnch' as const, label: 'Branches' },
    { code: 98, type: 'atm' as const, label: 'ATMs' },
    { code: 39, type: 'brnch' as const, label: 'CDMs' },
  ];

  for (let i = 0; i < ALFALAH_CITIES.length; i++) {
    const item = ALFALAH_CITIES[i];

    for (const cat of CATEGORIES) {
      try {
        const payload = {
          kisu87: 'me',
          mstoaw: 'en',
          js6nwf: String(item.latitude || 0),
          pan3ba: String(item.longitude || 0),
          fksyd: item.city,
          n4ja3s: 'Pakistan',
          opmsta: '0',
          mnakls: '1000',
          matsw: 'Allied Bank',
          '9msh': 'asc',
          makthya: 'alphabetical',
          '7WdpTO': [cat.code],
          klaosw: false,
        };

        const { data } = await axios.post<PeekabooApiResponse>(API_URL, payload, {
          headers,
          timeout: 25_000,
        });

        const branches = data.branches || [];
        if (branches.length > 0 && cat.code === 168) {
          console.log(`[${i + 1}/${ALFALAH_CITIES.length}] ${item.city}: Found ${branches.length} branches`);
        }

        for (const branch of branches) {
          const externalId = `allied_${branch.id}`;
          if (seenIds.has(externalId)) continue;
          seenIds.add(externalId);

          const lat = typeof branch.latitude === 'string' ? parseFloat(branch.latitude) : branch.latitude;
          const lng = typeof branch.longitude === 'string' ? parseFloat(branch.longitude) : branch.longitude;

          if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
            stats.skipped += 1;
            continue;
          }

          const canonicalCity = cleanAndNormalizeCity(branch.city || item.city);
          const cityId = await resolveCityId(ctx, canonicalCity);

          const amenitiesObj = branch.amenities || {};
          const isAtm = amenitiesObj.ATM?.value?.toLowerCase() === 'yes' || cat.type === 'atm';
          const isCdm = amenitiesObj.CDM?.value?.toLowerCase() === 'yes' || cat.code === 39;
          const isSaturdayOpen = amenitiesObj['Saturday Open']?.value?.toLowerCase() === 'yes';
          const isWheelchair = amenitiesObj['Ramp Facility']?.value?.toLowerCase() === 'yes';
          const isLocker = amenitiesObj.Locker?.value?.toLowerCase() === 'yes';
          const isIslamic = branch.name.toLowerCase().includes('islamic') || branch.name.toLowerCase().includes('isl');

          const locationTypeCode = isIslamic ? 'isl' : cat.type === 'atm' ? 'atm' : 'brnch';
          const locationTypeId = ctx.locationTypes.get(locationTypeCode);

          const updateDoc = {
            providerId: provider._id,
            cityId,
            locationTypeId,
            externalId,
            name: branch.name.trim(),
            address: branch.address.trim(),
            lat,
            lng,
            location: { type: 'Point', coordinates: [lng, lat] },
            phone: branch.contactNumber?.trim() || undefined,
            amenities: {
              atm: isAtm,
              cdm: isCdm,
              islamic: isIslamic,
              locker: isLocker,
              saturdayOpen: isSaturdayOpen,
              wheelchairAccessible: isWheelchair,
              biometric: true,
            },
            isActive: true,
            isVerified: branch.isVerified === 1,
            rawData: branch as unknown as Record<string, unknown>,
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
        // quiet fallback for minor cities
      }
    }

    await new Promise((r) => setTimeout(r, 120));
  }

  const finalCount = await Location.countDocuments({ providerId: provider._id });

  console.log('======================================================');
  console.log('✅ Allied Bank (ABL) Enrichment Complete:');
  console.log(`- Unique locations processed: ${seenIds.size}`);
  console.log(`- Inserted: ${stats.inserted}`);
  console.log(`- Updated:  ${stats.updated}`);
  console.log(`- Skipped:  ${stats.skipped}`);
  console.log(`- Total Allied Bank records in DB now: ${finalCount}`);
  console.log('======================================================');

  await disconnectDatabase();
}

if (require.main === module) {
  scrapeAlliedFull().catch((err) => {
    console.error('Allied Bank scrape failed:', err);
    process.exit(1);
  });
}
