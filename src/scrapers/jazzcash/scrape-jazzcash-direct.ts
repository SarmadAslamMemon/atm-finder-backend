import axios, { AxiosInstance } from 'axios';
import fs from 'fs';
import path from 'path';
import { Types } from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../../config/database';
import { City, Location, LocationType, Provider } from '../../models';
import { cleanAndNormalizeCity } from '../shared/cities';

interface RawJazzCashAgent {
  name: string;
  msisdn: string;
  lat: number;
  lng: number;
  cityName?: string;
  category?: string;
}

const PRIMARY_CITIES = [
  'Karachi',
  'Lahore',
  'Islamabad',
  'Rawalpindi',
  'Faisalabad',
  'Multan',
  'Peshawar',
  'Quetta',
  'Gujranwala',
  'Sialkot',
  'Hyderabad',
  'Sukkur',
  'Bahawalpur',
  'Sargodha',
  'Abbottabad',
  'Mardan',
  'Gujrat',
  'Sahiwal',
  'Rahim Yar Khan',
  'Jhang',
  'Dera Ghazi Khan',
  'Sheikhupura',
  'Kasur',
  'Okara',
  'Chiniot',
  'Larkana',
  'Nawabshah',
  'Mirpur Khas',
  'Muzaffarabad',
  'Mirpur AJK',
  'Gilgit',
  'Skardu',
  'Gwadar',
  'Turbat',
  'Bannu',
  'Kohat',
  'Dera Ismail Khan',
  'Swat',
  'Mingora',
  'Wah Cantt',
  'Attock',
  'Mansehra',
  'Chakwal',
  'Jhelum',
  'Jacobabad',
  'Shikarpur',
  'Khairpur',
  'Thatta',
  'Badin',
  'Hafizabad',
  'Mandi Bahauddin',
  'Pakpattan',
  'Vehari',
  'Khanewal',
  'Muzaffargarh',
  'Layyah',
  'Bhakkar',
  'Mianwali',
  'Khushab',
  'Toba Tek Singh',
  'Gojra',
  'Bahawalnagar',
  'Chishtian',
  'Kot Addu',
  'Nowshera',
  'Charsadda',
  'Swabi',
  'Haripur',
  'Batkhela',
  'Timergara',
  'Chitral',
  'Hub',
  'Khuzdar',
  'Sibi',
  'Zhob',
  'Chaman',
  'Kotli',
  'Rawalakot',
  'Bhimber',
];

function cleanShopName(rawName: string): string {
  if (!rawName) return 'JazzCash Agent';
  let cleaned = rawName.trim();

  // Strip category prefixes commonly returned by JazzCash
  cleaned = cleaned.replace(
    /^(?:Educational institutes?|Food|Retailer|Retailers|Groceries|Grocery|Telecom|Pharmacy|Stationery|Electronics|Services|General Store)\s+/i,
    ''
  );

  return cleaned.trim() || 'JazzCash Agent';
}

class FastCityResolver {
  private cityMap = new Map<string, Types.ObjectId>();
  private defaultCityId!: Types.ObjectId;

  async init(): Promise<void> {
    const allCities = await City.find({ country: 'Pakistan' }).select('_id name').lean();
    for (const c of allCities) {
      this.cityMap.set(c.name.trim().toLowerCase(), c._id as Types.ObjectId);
      if (c.name.toLowerCase() === 'karachi') {
        this.defaultCityId = c._id as Types.ObjectId;
      }
    }
    if (!this.defaultCityId && allCities.length > 0) {
      this.defaultCityId = allCities[0]._id as Types.ObjectId;
    }
  }

  async resolve(rawName: string): Promise<Types.ObjectId> {
    const normalized = cleanAndNormalizeCity(rawName);
    const key = normalized.trim().toLowerCase();

    if (this.cityMap.has(key)) {
      return this.cityMap.get(key)!;
    }

    let cityDoc = await City.findOne({ name: normalized, country: 'Pakistan' });
    if (!cityDoc) {
      try {
        cityDoc = await City.create({ name: normalized, country: 'Pakistan' });
      } catch {
        cityDoc = await City.findOne({ name: normalized, country: 'Pakistan' });
      }
    }

    const id = (cityDoc ? cityDoc._id : this.defaultCityId) as Types.ObjectId;
    this.cityMap.set(key, id);
    return id;
  }
}

class JazzCashApiClient {
  private session: AxiosInstance;
  private cookieHeader = '';

  constructor() {
    this.session = axios.create({
      baseURL: 'https://www.jazzcash.com.pk',
      timeout: 15000,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
  }

  async initSession(): Promise<void> {
    try {
      const res = await this.session.get('/agent-locator');
      const cookies = res.headers['set-cookie'] || [];
      this.cookieHeader = cookies.map((c) => c.split(';')[0]).join('; ');
    } catch (e: any) {
      console.warn('Could not initialize session cookies:', e.message);
    }
  }

  async searchAgents(
    searchTerm: string,
    offset = 0,
    limit = 50
  ): Promise<{ agents: RawJazzCashAgent[]; hasMore: boolean }> {
    try {
      const res = await this.session.get('/agent-locator/agent-locator-search', {
        params: {
          offset,
          limit,
          search: searchTerm,
        },
        headers: {
          Accept: 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          Referer: 'https://www.jazzcash.com.pk/agent-locator',
          Cookie: this.cookieHeader,
        },
      });

      let rawText = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      // Strip ExpressionEngine template tag: {!-- ra:... --}
      rawText = rawText.replace(/^{!--[\s\S]*?--}/, '').trim();

      const parsed = JSON.parse(rawText);
      const agents = Array.isArray(parsed.agents) ? parsed.agents : [];
      const hasMore = Boolean(parsed.hasMore);

      return { agents, hasMore };
    } catch (err: any) {
      // Re-init session if invalid request
      if (err.response?.status === 403 || err.message?.includes('invalid_request')) {
        await this.initSession();
      }
      return { agents: [], hasMore: false };
    }
  }
}

export async function scrapeJazzCashDirect(): Promise<void> {
  console.log('======================================================');
  console.log('  🔴  Starting JazzCash Agent & ATM Ingestion');
  console.log('======================================================\n');

  await connectDatabase();

  // 1. Ensure Provider exists
  let provider = await Provider.findOne({ slug: 'jazzcash' });
  if (!provider) {
    console.log('Creating JazzCash provider record...');
    provider = await Provider.create({
      name: 'JazzCash',
      slug: 'jazzcash',
    });
  }

  // 2. Ensure LocationType exists
  let atmLocationType = await LocationType.findOne({ code: 'atm' });
  if (!atmLocationType) {
    atmLocationType = await LocationType.create({ code: 'atm', label: 'ATM' });
  }

  const cityResolver = new FastCityResolver();
  await cityResolver.init();

  // 3. Load DB cities to combine with PRIMARY_CITIES for maximum coverage
  const dbCities = await City.find({ country: 'Pakistan' }).select('name').lean();
  const allSearchTerms = Array.from(
    new Set([...PRIMARY_CITIES, ...dbCities.map((c) => c.name.trim())])
  ).filter((s) => s.length > 2);

  console.log(`Targeting ${allSearchTerms.length} search cities/zones across Pakistan.`);

  const dumpFile = path.resolve(process.cwd(), 'jazzcash_agents.json');
  let allScrapedAgents: RawJazzCashAgent[] = [];

  if (fs.existsSync(dumpFile)) {
    console.log(`Loading cached JazzCash dump from ${dumpFile}...`);
    try {
      allScrapedAgents = JSON.parse(fs.readFileSync(dumpFile, 'utf-8'));
      console.log(`Loaded ${allScrapedAgents.length} agents from local cache.`);
    } catch (e) {
      console.warn('Could not load cached dump file, fetching live...');
    }
  }

  if (allScrapedAgents.length === 0) {
    const client = new JazzCashApiClient();
    await client.initSession();

    const seenMsisdn = new Set<string>();

    for (let i = 0; i < allSearchTerms.length; i++) {
      const city = allSearchTerms[i];
      let offset = 0;
      const limit = 50;
      let cityCount = 0;
      let hasMore = true;

      while (hasMore && offset < 500) {
        const result = await client.searchAgents(city, offset, limit);
        if (result.agents.length === 0) break;

        for (const a of result.agents) {
          const key = a.msisdn ? a.msisdn.trim() : `${a.lat}_${a.lng}`;
          if (!seenMsisdn.has(key) && a.lat && a.lng) {
            seenMsisdn.add(key);
            allScrapedAgents.push({
              ...a,
              cityName: city,
            });
            cityCount++;
          }
        }

        hasMore = result.hasMore && result.agents.length === limit;
        offset += limit;
        await new Promise((r) => setTimeout(r, 120));
      }

      if (cityCount > 0 || (i + 1) % 10 === 0) {
        console.log(
          `[${i + 1}/${allSearchTerms.length}] ${city}: +${cityCount} agents | Running Total: ${allScrapedAgents.length}`
        );
      }
    }

    try {
      fs.writeFileSync(dumpFile, JSON.stringify(allScrapedAgents, null, 2), 'utf-8');
      console.log(`\n💾 Saved ${allScrapedAgents.length} agents to ${dumpFile}`);
    } catch (e) {
      console.warn('Could not save dump file:', e);
    }
  }

  console.log(`\n--- Ingesting ${allScrapedAgents.length} JazzCash Agents into MongoDB ---`);

  const bulkOps: unknown[] = [];
  const seenIds = new Set<string>();

  for (let idx = 0; idx < allScrapedAgents.length; idx++) {
    const agent = allScrapedAgents[idx];
    const lat = Number(agent.lat);
    const lng = Number(agent.lng);

    // Validate coordinates within Pakistan bounding box
    if (isNaN(lat) || isNaN(lng) || lat < 23.0 || lat > 38.0 || lng < 60.0 || lng > 78.0) {
      continue;
    }

    const cleanName = cleanShopName(agent.name);
    const msisdn = agent.msisdn ? agent.msisdn.trim() : '';
    const externalId = msisdn ? `jazzcash_${msisdn}` : `jazzcash_agent_${idx + 1}`;

    if (seenIds.has(externalId)) continue;
    seenIds.add(externalId);

    const canonicalCity = cleanAndNormalizeCity(agent.cityName || 'Pakistan');
    const cityId = await cityResolver.resolve(canonicalCity);

    const doc = {
      providerId: provider._id,
      cityId,
      locationTypeId: atmLocationType._id,
      externalId,
      name: `JazzCash - ${cleanName}`,
      address: `${cleanName}, ${canonicalCity}, Pakistan`,
      lat,
      lng,
      location: { type: 'Point', coordinates: [lng, lat] },
      phone: msisdn || '051-111-124-444',
      amenities: {
        atm: true,
        cdm: true,
        biometric: true,
        saturdayOpen: true,
      },
      isActive: true,
      isVerified: true,
      rawData: {
        rawName: agent.name,
        msisdn,
        city: canonicalCity,
        source: 'JazzCashAgentLocator',
      },
    };

    bulkOps.push({
      updateOne: {
        filter: { providerId: provider._id, externalId },
        update: { $set: doc },
        upsert: true,
      },
    });
  }

  console.log(`Writing ${bulkOps.length} JazzCash locations in batches of 500...`);
  for (let i = 0; i < bulkOps.length; i += 500) {
    const chunk = bulkOps.slice(i, i + 500);
    await Location.bulkWrite(chunk as any, { ordered: false });
  }

  const finalCount = await Location.countDocuments({ providerId: provider._id });
  console.log('======================================================');
  console.log('🎉 JazzCash Ingestion Complete!');
  console.log(`- Ingested Agents & ATMs: ${bulkOps.length}`);
  console.log(`- Total JazzCash Records in DB Now: ${finalCount}`);
  console.log('======================================================\n');

  await disconnectDatabase();
}

if (require.main === module) {
  scrapeJazzCashDirect().catch((err) => {
    console.error('JazzCash Ingestion failed:', err);
    process.exit(1);
  });
}
