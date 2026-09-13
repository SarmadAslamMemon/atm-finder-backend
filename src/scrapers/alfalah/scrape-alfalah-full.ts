import axios from 'axios';
import { connectDatabase, disconnectDatabase } from '../../config/database';
import { Location, Provider } from '../../models';
import { cleanAndNormalizeCity } from '../shared/cities';
import { createScraperContext, createStats, recordUpsert, resolveCityId } from '../shared/upsert';

const API_URL = 'https://secure-sdk.peekaboo.guru/kbprosamdmnioblcruahnhdcjhs_ahajlhljlgjhaskjgl5';
const OWNER_KEY = '2fbabf2c60b4cc81e9ac6470a5a12eb0';
const BEARER_TOKEN =
  'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpZCI6NzIsInJvbGUiOiJndWVzdCIsImlhdCI6MTU1MzcwMDgwNiwianRpIjoiUEpJMXFTb2ktQzRBZFJWcm9nb3RNV2UzV3VXcFdXTm0ifQ.2mb26xL4Qt7FfBQZ-XQvp-fhecMpaVUVXWp_GEST_6U';

export const ALFALAH_CITIES = [
  { city: 'Karachi', latitude: 24.861462, longitude: 67.009939 },
  { city: 'Lahore', latitude: 31.554606, longitude: 74.357158 },
  { city: 'Islamabad', latitude: 33.729388, longitude: 73.093146 },
  { city: 'Rawalpindi', latitude: 33.598394, longitude: 73.044135 },
  { city: 'Faisalabad', latitude: 31.418714, longitude: 73.079107 },
  { city: 'Peshawar', latitude: 34.014975, longitude: 71.58049 },
  { city: 'Quetta', latitude: 30.182971, longitude: 66.998734 },
  { city: 'Sialkot', latitude: 32.492477, longitude: 74.53104 },
  { city: 'Multan', latitude: 30.198381, longitude: 71.468703 },
  { city: 'Sukkur', latitude: 27.706604, longitude: 68.848197 },
  { city: 'Gujranwala', latitude: 32.154378, longitude: 74.184225 },
  { city: 'Hyderabad', latitude: 25.381751, longitude: 68.36939 },
  { city: 'Sargodha', latitude: 32.083741, longitude: 72.67186 },
  { city: 'Bahawalpur', latitude: 29.395722, longitude: 71.683333 },
  { city: 'Arifwala', latitude: 30.29786, longitude: 73.058237 },
  { city: 'Bahawalnagar', latitude: 29.999183, longitude: 73.258844 },
  { city: 'Burewala', latitude: 30.157711, longitude: 72.673968 },
  { city: 'Chakwal', latitude: 32.931099, longitude: 72.855086 },
  { city: 'Chiniot', latitude: 31.728587, longitude: 72.981488 },
  { city: 'Dadu', latitude: 26.734058, longitude: 67.779482 },
  { city: 'Dera Ismail Khan', latitude: 31.842362, longitude: 70.895234 },
  { city: 'Jhelum', latitude: 32.940548, longitude: 73.727629 },
  { city: 'Kabirwala', latitude: 30.465761, longitude: 71.809694 },
  { city: 'Kotli', latitude: 33.51451, longitude: 73.89931 },
  { city: 'Lodhran', latitude: 29.536342, longitude: 71.631736 },
  { city: 'Mailsi', latitude: 29.804225, longitude: 72.174041 },
  { city: 'Mardan', latitude: 34.200114, longitude: 72.050801 },
  { city: 'Mianwali', latitude: 32.578891, longitude: 71.560526 },
  { city: 'Sadiqabad', latitude: 28.308394, longitude: 70.133673 },
  { city: 'Sheikhupura', latitude: 31.716662, longitude: 73.985024 },
  { city: 'Sambrial', latitude: 32.4785886, longitude: 74.3419476 },
  { city: 'Chaman', latitude: 30.9163921, longitude: 66.4985787 },
  { city: 'Murree', latitude: 33.9062828, longitude: 73.4003405 },
  { city: 'Renala Khurd', latitude: 30.8832068, longitude: 73.6006342 },
  { city: 'Skardu', latitude: 35.3247102, longitude: 75.5509602 },
  { city: 'Mirpur Mathelo', latitude: 28.0259444, longitude: 69.5678329 },
  { city: 'Hunza', latitude: 36.3166652, longitude: 74.6412315 },
  { city: 'Mirpur khas', latitude: 25.529105, longitude: 69.013571 },
  { city: 'Timergara', latitude: 34.838832, longitude: 71.827485 },
  { city: 'Gujrat', latitude: 32.571144, longitude: 74.075005 },
  { city: 'Haripur', latitude: 33.995984, longitude: 72.936762 },
  { city: 'Hasilpur', latitude: 29.690255, longitude: 72.538229 },
  { city: 'Jaranwala', latitude: 31.332877, longitude: 73.417582 },
  { city: 'Kahuta', latitude: 33.589614, longitude: 73.388553 },
  { city: 'Kasur', latitude: 31.116477, longitude: 74.449374 },
  { city: 'Khanewal', latitude: 30.303934, longitude: 71.929879 },
  { city: 'Khushab', latitude: 32.305419, longitude: 72.348238 },
  { city: 'Kohat', latitude: 33.583401, longitude: 71.433219 },
  { city: 'Mansehra', latitude: 34.333882, longitude: 73.201062 },
  { city: 'Mian Channu', latitude: 30.436121, longitude: 72.348872 },
  { city: 'Mirpur Azad Kashmir', latitude: 33.1010754, longitude: 73.77132 },
  { city: 'Muzaffargarh', latitude: 30.073609, longitude: 71.180499 },
  { city: 'Nowshera', latitude: 34.015856, longitude: 71.975452 },
  { city: 'Okara', latitude: 30.80905, longitude: 73.450821 },
  { city: 'Pattoki', latitude: 31.024927, longitude: 73.847932 },
  { city: 'Phalia', latitude: 32.421714, longitude: 73.57708 },
  { city: 'Rahimyar Khan', latitude: 28.421157, longitude: 70.298874 },
  { city: 'Rajanpur', latitude: 29.101769, longitude: 70.324466 },
  { city: 'Sahiwal', latitude: 30.661181, longitude: 73.108576 },
  { city: 'Sanghar', latitude: 25.857677, longitude: 69.478454 },
  { city: 'Shahdadpur', latitude: 25.926808, longitude: 68.626069 },
  { city: 'Tando Adam', latitude: 25.76852, longitude: 68.662545 },
  { city: 'Toba Tek Singh', latitude: 30.972671, longitude: 72.484986 },
  { city: 'Wazirabad', latitude: 32.438625, longitude: 74.116991 },
  { city: 'Nankana Sahib', latitude: 31.4488605, longitude: 73.6882746 },
  { city: 'Kandhkot', latitude: 28.2437786, longitude: 69.1735474 },
  { city: 'Chitral', latitude: 35.8533762, longitude: 71.7146222 },
  { city: 'Bhakkar', latitude: 31.6082059, longitude: 71.0854325 },
  { city: 'Ghazi', latitude: 34.0207274, longitude: 72.6594646 },
  { city: 'Kallar Syedan', latitude: 33.4137361, longitude: 73.3767641 },
  { city: 'Turbat', latitude: 26.0080546, longitude: 63.0383059 },
  { city: 'Batkhela', latitude: 34.6137694, longitude: 71.9282781 },
  { city: 'Talagang', latitude: 32.917193, longitude: 72.4080605 },
  { city: 'Shahkot', latitude: 31.5757477, longitude: 73.4814918 },
  { city: 'Kot Abdul Malik', latitude: 31.62042, longitude: 74.2343811 },
  { city: 'Swat', latitude: 35.492033, longitude: 72.520483 },
  { city: 'Abbottabad', latitude: 34.16875, longitude: 73.221498 },
  { city: 'Attock', latitude: 33.768734, longitude: 72.362147 },
  { city: 'Bannu', latitude: 32.989724, longitude: 70.603833 },
  { city: 'Charsadda', latitude: 34.149433, longitude: 71.742781 },
  { city: 'Chichawatni', latitude: 30.539132, longitude: 72.691981 },
  { city: 'Chishtian', latitude: 29.727951, longitude: 72.946057 },
  { city: 'Daska', latitude: 32.334984, longitude: 74.352882 },
  { city: 'Dera Ghazi Khan', latitude: 30.032486, longitude: 70.640246 },
  { city: 'Dina', latitude: 33.028955, longitude: 73.600634 },
  { city: 'Ghotki', latitude: 28.00069, longitude: 69.31894 },
  { city: 'Gilgit', latitude: 35.920154, longitude: 74.308013 },
  { city: 'Gojra', latitude: 31.14679, longitude: 72.685221 },
  { city: 'Gujar Khan', latitude: 33.251299, longitude: 73.30602 },
  { city: 'Hafizabad', latitude: 32.071699, longitude: 73.685729 },
  { city: 'Haroonabad', latitude: 29.612972, longitude: 73.140861 },
  { city: 'Havelian', latitude: 34.046583, longitude: 73.143812 },
  { city: 'Jacobabad', latitude: 28.282935, longitude: 68.436488 },
  { city: 'Jhang', latitude: 31.260062, longitude: 72.319273 },
  { city: 'Khanpur', latitude: 28.649121, longitude: 70.651421 },
  { city: 'Kharian', latitude: 32.826982, longitude: 73.845985 },
  { city: 'Kot Addu', latitude: 30.461536, longitude: 70.96954 },
  { city: 'Larkana', latitude: 27.563994, longitude: 68.215131 },
  { city: 'Layyah', latitude: 30.96475, longitude: 70.939935 },
  { city: 'Mandi Bahauddin', latitude: 32.588169, longitude: 73.497343 },
  { city: 'Muzaffarabad', latitude: 34.359687, longitude: 73.471054 },
  { city: 'Narowal', latitude: 32.099476, longitude: 74.874735 },
  { city: 'Nawabshah', latitude: 26.244221, longitude: 68.410034 },
  { city: 'Pakpattan', latitude: 30.352457, longitude: 73.388553 },
  { city: 'Pishin', latitude: 30.584213, longitude: 66.995823 },
  { city: 'Swabi', latitude: 34.116416, longitude: 72.464278 },
  { city: 'Vehari', latitude: 30.045246, longitude: 72.348872 },
  { city: 'Muridke', latitude: 31.8024764, longitude: 74.2394684 },
  { city: 'Gwadar', latitude: 25.1726957, longitude: 62.2504733 },
  { city: 'Battagram', latitude: 34.6724201, longitude: 73.0242932 },
  { city: 'Loralai', latitude: 30.3805824, longitude: 68.5962593 },
  { city: 'Pindigheb', latitude: 33.2451991, longitude: 72.2659868 },
  { city: 'Sibi', latitude: 29.5532055, longitude: 67.8808243 },
  { city: 'Hangu', latitude: 33.5223287, longitude: 71.0616623 },
  { city: 'Badin', latitude: 24.6614457, longitude: 68.827586 },
  { city: 'Bhimber', latitude: 32.9753066, longitude: 74.0858207 },
  { city: 'Buner', latitude: 34.3943222, longitude: 72.6151169 },
  { city: 'Chilas', latitude: 35.4221765, longitude: 74.0946311 },
  { city: 'Dargai', latitude: 34.1798151, longitude: 71.8882611 },
  { city: 'Dera Bugti', latitude: 29.0278, longitude: 69.097 },
  { city: 'Dera Murad Jamali', latitude: 28.5388514, longitude: 68.1865162 },
  { city: 'Dir', latitude: 35.19799413, longitude: 71.8748264 },
  { city: 'Hub', latitude: 25.0057964, longitude: 66.8201092 },
  { city: 'Jamshoro', latitude: 25.4168681, longitude: 68.2743064 },
  { city: 'Kashmore', latitude: 28.4481593, longitude: 69.5857077 },
  { city: 'Zhob', latitude: 31.3497081, longitude: 69.4665363 },
  { city: 'Thatta', latitude: 24.7478623, longitude: 67.9047488 },
  { city: 'Umerkot', latitude: 25.361444, longitude: 69.743586 },
  { city: 'Khuzdar', latitude: 27.8164837, longitude: 66.6057378 },
  { city: 'Khairpur', latitude: 27.529952, longitude: 68.758142 },
  { city: 'Rawalakot', latitude: 33.8583729, longitude: 73.7654367 },
  { city: 'Pasrur', latitude: 32.2625241, longitude: 74.6576091 },
];

interface RawAlfalahBranch {
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
  branches?: RawAlfalahBranch[];
}

export async function scrapeAlfalahFull(): Promise<void> {
  console.log(`--- Starting Bank Alfalah Enrichment Scraper (${ALFALAH_CITIES.length} cities) ---`);
  await connectDatabase();

  const ctx = await createScraperContext();
  const provider = await Provider.findOne({ slug: 'alfalah' });
  if (!provider) {
    throw new Error('Bank Alfalah provider not found in DB! Please run seed first.');
  }

  const stats = createStats();
  const seenIds = new Set<string>();

  const headers = {
    accept: '*/*',
    'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
    authorization: `Bearer ${BEARER_TOKEN}`,
    'content-type': 'application/json',
    medium: 'IFRAME',
    origin: 'https://alfalah-web-locator.peekaboo.guru',
    referer: 'https://alfalah-web-locator.peekaboo.guru/',
    ownerkey: OWNER_KEY,
    'user-agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',
  };

  for (let i = 0; i < ALFALAH_CITIES.length; i++) {
    const item = ALFALAH_CITIES[i];
    try {
      const payload = {
        kisu87: 'me',
        mstoaw: 'en',
        js6nwf: String(item.latitude),
        pan3ba: String(item.longitude),
        fksyd: item.city,
        n4ja3s: 'Pakistan',
        opmsta: '0',
        mnakls: '1000',
        matsw: 'Bank Alfalah',
        '9msh': 'asc',
        makthya: 'alphabetical',
        '7WdpTO': [168],
        klaosw: false,
      };

      const { data } = await axios.post<PeekabooApiResponse>(API_URL, payload, {
        headers,
        timeout: 25_000,
      });

      const branches = data.branches || [];
      if (branches.length > 0) {
        console.log(`[${i + 1}/${ALFALAH_CITIES.length}] ${item.city}: Found ${branches.length} branches`);
      }

      for (const branch of branches) {
        const externalId = `alfalah_${branch.id}`;
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
        const isAtm = amenitiesObj.ATM?.value?.toLowerCase() === 'yes';
        const isCdm =
          amenitiesObj.CDM?.value?.toLowerCase() === 'yes' ||
          amenitiesObj.CCDM?.value?.toLowerCase() === 'yes';
        const isBiometric =
          amenitiesObj['Biometric Enabled']?.value?.toLowerCase() === 'yes' ||
          amenitiesObj.BVS?.value?.toLowerCase() === 'yes';
        const isIslamic =
          amenitiesObj['Islamic Banking']?.value?.toLowerCase() === 'yes' ||
          branch.name.toLowerCase().includes('islamic');
        const isWheelchair =
          amenitiesObj['Ramp Facility']?.value?.toLowerCase() === 'yes' ||
          amenitiesObj.Ramp?.value?.toLowerCase() === 'yes';
        const isLocker = amenitiesObj.Locker?.value?.toLowerCase() === 'yes';

        const locationTypeCode = isIslamic ? 'isl' : 'brnch';
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
            wheelchairAccessible: isWheelchair,
            biometric: isBiometric,
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
      console.error(`  Error scraping ${item.city}:`, (err as Error).message);
    }

    await new Promise((r) => setTimeout(r, 150));
  }

  const finalCount = await Location.countDocuments({ providerId: provider._id });

  console.log('======================================================');
  console.log('✅ Bank Alfalah Enrichment Complete:');
  console.log(`- Unique locations processed: ${seenIds.size}`);
  console.log(`- Inserted: ${stats.inserted}`);
  console.log(`- Updated:  ${stats.updated}`);
  console.log(`- Skipped:  ${stats.skipped}`);
  console.log(`- Total Bank Alfalah records in DB now: ${finalCount}`);
  console.log('======================================================');

  await disconnectDatabase();
}

if (require.main === module) {
  scrapeAlfalahFull().catch((err) => {
    console.error('Bank Alfalah scrape failed:', err);
    process.exit(1);
  });
}
