import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { connectDatabase, disconnectDatabase } from '../../config/database';
import { Provider } from '../../models';
import { Location } from '../../models';
import { cleanAndNormalizeCity } from '../shared/cities';
import { createScraperContext, createStats, recordUpsert, resolveCityId } from '../shared/upsert';

const API_URL = 'https://www.hbl.com/branch-locator/get_locations_by_city';
const CSRF_TOKEN = '060cfa86af5fc787f68d63182e2552293d8a10bd';

const COOKIES =
  'exp_csrf_token=060cfa86af5fc787f68d63182e2552293d8a10bd; visid_incap_664729=tyC3eM6zRF2JU2UUTsmTulUNm2oAAAAAQUIPAAAAAABgMVSXEimv9O4BcRW6W2f0; nlbi_664729=AOXxcTU/AXw0yEB63cXB6gAAAADgNxR6ioGuz9gzVk0mdUfz; incap_ses_796_664729=zjgwSgf4oxbz1jeP5PULC1YNm2oAAAAAxZgm3dJEkoMmB6w0+Faz2Q==; _gcl_au=1.1.1654882219.1788546396; _gid=GA1.2.798266611.1788546406; _fbp=fb.1.1788546411120.557517032159014450; _tt_enable_cookie=1; _ttp=01M1PTRV376JFZNPXN3RVPY9Z0_.tt.1.1788546411624; exp_preferences=dark; infw=1494; reese84=3:ye8eqn5DrDNW1ssdMvmDlw==:mnMWR38aiFZiqZHf9p0/LTwB8EKskYFGEIkN50nzhIqGhURKElRShkLCVA5mjSxGZLW5UN3KVdbX0a9zYoRztzr4mVkJqBcxKHRASZtCw5Km8xCskjyTO1GZBmdsv7yGLiYbENM4/ew+SPKje0bamqE+AA/uKs1ptSZzFiuJKm8=:if7uXJoVv38PKPZCmCoGoie+Do904ZJHLOlN/Q3j0LE=:8oHboQ5q2/aqOpOcUM5qNRbkX51MAvSWoyL2Umd4FTX2y1uNuzzoZYHmKWKDQlPlOxjrLGodULLsnA+m85aBqIXmJ8rICxbpbiX9OYG+D4rEnFW9K7RQoXGHc29mccCBtWXHLi0Fn8Tuzbeb2Rdt2IvBxeHgxAK5LTWYR16/AYRn5xdQPmEY12cbns2Dk0jxxOu857VamwxtHsqYd/5ImIknPbOLaV9RA27UgHmnI7fXCZE9BgTHw8SRyiRNOTqOhyQ65Fn9a7vRKC8WVLNK8mkNyqsil4d6AXMBR5x+VxwH6dq8FY15u3kJDlR/huG03G3rD5LH9GqJEeJnZIFm9plpvU3dnUc7+N28gp0xEhk=:; _ga=GA1.2.827611500.1788546398; _gat_UA-71833572-1=1; _ga_7E2SCEF6TZ=GS2.1.s1788546397$o1$g1$t1788547303$j57$l0$h0; nlbi_664729_2147483392=fj65Ckri/mABsH5a3cXB6gAAAABU2fV83optg+gahwbfRtzq; exp_tracker=%7B%220%22%3A%22404%22%2C%221%22%3A%22assets%2Ftheme_js%2Fbootstrap.bundle.min.js.map%22%2C%222%22%3A%22branch-locator%2Fajax_load_locations%22%2C%223%22%3A%22404%22%2C%224%22%3A%22assets%2Ftheme_css%2Fstarter.css.map%22%2C%22token%22%3A%223d049c7909b7698691f9cebaa49d5ad934fae6c449815f55697a1b3b344e56c343203210da763d38f1fa7b3f9df72365%22%7D; ttcsid_CC1LM2RC77U9MSBJHOUG=1788546411650::__I2KigtsyUazEY-h1Il.1.1788547349702.1; ttcsid=1788546411651::-XhL3GwtAIBkQflo_x5M.1.1788547349702.0::1.887394.892073::938065.41.730.554::774517.81.341';

const REGIONS = [
  'AJK (Muzaffarabad)',
  'Bahawalpur',
  'Balochistan',
  'Faisalabad & Sargodha',
  'Gujranwala',
  'Gujrat',
  'Hyderabad & Sukkur',
  'Islamabad-Rawalpindi',
  'Karachi',
  'Lahore',
  'Mardan',
  'Multan',
  'Peshawar',
  'Sahiwal',
] as const;

const TYPES = ['brnch', 'atm', 'isl', 'agri'] as const;

interface HblRawRow {
  id?: number | string;
  code?: string;
  name?: string;
  address?: string;
  lat?: number | string;
  lng?: number | string;
  latitude?: number | string;
  longitude?: number | string;
  phone?: string;
  contact?: string;
  type?: string;
  [key: string]: unknown;
}

export async function scrapeHblDirect(): Promise<void> {
  console.log('--- Starting Direct HBL Scraper & Ingestion ---');
  await connectDatabase();

  const ctx = await createScraperContext();
  const provider = await Provider.findOne({ slug: 'hbl' });
  if (!provider) {
    throw new Error('HBL provider not found in database! Please run seed first.');
  }

  const stats = createStats();
  const seenIds = new Set<string>();

  const headers = {
    accept: '*/*',
    'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
    'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
    cookie: COOKIES,
    origin: 'https://www.hbl.com',
    referer: 'https://www.hbl.com/branch-locator',
    'user-agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36',
    'x-requested-with': 'XMLHttpRequest',
  };

  for (const region of REGIONS) {
    for (const type of TYPES) {
      try {
        console.log(`Fetching HBL [${type}] in [${region}]...`);
        const body = new URLSearchParams({
          XID: CSRF_TOKEN,
          city: region,
          type,
        });

        const { data } = await axios.post(API_URL, body.toString(), {
          headers,
          timeout: 20_000,
        });

        const list: HblRawRow[] = Array.isArray(data)
          ? data
          : data && typeof data === 'object' && Array.isArray((data as { regions?: unknown[] }).regions)
          ? ((data as { regions: HblRawRow[] }).regions)
          : data && typeof data === 'object' && Array.isArray((data as { data?: unknown[] }).data)
          ? ((data as { data: HblRawRow[] }).data)
          : [];

        console.log(`  Found ${list.length} records`);

        for (const item of list) {
          const rawLat = item.latitude ?? item.lat;
          const rawLng = item.longitude ?? item.lng;
          if (rawLat === '#N/A' || rawLng === '#N/A' || !rawLat || !rawLng) {
            stats.skipped += 1;
            continue;
          }

          const lat = typeof rawLat === 'string' ? parseFloat(rawLat) : Number(rawLat);
          const lng = typeof rawLng === 'string' ? parseFloat(rawLng) : Number(rawLng);

          if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) {
            stats.skipped += 1;
            continue;
          }

          const name = item.branch_name || item.name || `HBL ${type.toUpperCase()}`;
          const address = item.branch_comp_address || item.address || `${region}, Pakistan`;
          const rawCode = item.branch_code || item.code || item.id || `${lat.toFixed(4)}_${lng.toFixed(4)}`;
          const externalId = `hbl_${type}_${rawCode}`;

          if (seenIds.has(externalId)) continue;
          seenIds.add(externalId);

          const cityName = cleanAndNormalizeCity(String(address || '')) || cleanAndNormalizeCity(String(item.region || region || ''));
          const cityId = await resolveCityId(ctx, cityName);

          const hasAtm = item.atm === 'Yes' || type === 'atm';
          const isIslamic = item.isl_bank_hub === 'Yes' || item.isl_bank_window === 'Yes' || type === 'isl' || String(name).toLowerCase().includes('islamic') || String(name).toLowerCase().includes('ibb');
          const isAgri = type === 'agri';
          const hasCdm = item.cdm === 'Yes';
          const hasLocker = item.locker === 'Yes';

          const locationTypeCode = isIslamic ? 'isl' : isAgri ? 'agri' : hasAtm && type === 'atm' ? 'atm' : 'brnch';
          const locationTypeId = ctx.locationTypes.get(locationTypeCode);

          const updateDoc = {
            providerId: provider._id,
            cityId,
            locationTypeId,
            externalId,
            name: String(name).trim(),
            address: String(address).trim(),
            lat,
            lng,
            location: { type: 'Point', coordinates: [lng, lat] },
            phone: item.phone || item.contact ? String(item.phone || item.contact).trim() : undefined,
            amenities: {
              atm: hasAtm,
              cdm: hasCdm,
              islamic: isIslamic,
              locker: hasLocker,
              biometric: true,
            },
            isActive: true,
            isVerified: true,
            rawData: item as Record<string, unknown>,
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
        console.error(`  Failed HBL [${type}] in [${region}]:`, (err as Error).message);
      }

      await new Promise((r) => setTimeout(r, 200));
    }
  }

  const finalCount = await Location.countDocuments({ providerId: provider._id });

  console.log('======================================================');
  console.log('✅ HBL Direct Scrape Complete:');
  console.log(`- Inserted: ${stats.inserted}`);
  console.log(`- Updated:  ${stats.updated}`);
  console.log(`- Skipped:  ${stats.skipped}`);
  console.log(`- Total HBL records in DB now: ${finalCount}`);
  console.log('======================================================');

  await disconnectDatabase();
}

if (require.main === module) {
  scrapeHblDirect().catch((err) => {
    console.error('HBL scrape failed:', err);
    process.exit(1);
  });
}
