import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';
import { chromium } from 'playwright';
import { connectDatabase, disconnectDatabase } from '../../config/database';
import { City, Location, LocationType, Provider } from '../../models';
import { cleanAndNormalizeCity } from '../shared/cities';
import { createScraperContext, resolveCityId } from '../shared/upsert';

const BASE_URL = 'https://www.faysalbank.com';
const LOCATOR_URL = `${BASE_URL}/branch-locator/`;
const GET_LAT_LONG_URL = `${BASE_URL}/get_lat_long.php`;

interface FaysalRawBranch {
  frId: string;
  name: string;
  phone?: string;
  rawLat: string;
  rawLng: string;
  city: string;
  address: string;
}

interface CategoryIndex {
  ids: Set<string>;
  phones: Set<string>;
  nameKeys: Set<string>;
}

interface FaysalDataset {
  allHtml: string;
  atmIndex: CategoryIndex;
  pwdIndex: CategoryIndex;
  cdmIndex: CategoryIndex;
  satIndex: CategoryIndex;
  priorityIndex: CategoryIndex;
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

  // 2. Check condensed numbers without decimal (e.g. 341230 -> 34.1230, 73160 -> 73.160)
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

function parseCategoryIndex(html: string): CategoryIndex {
  const ids = new Set<string>();
  const phones = new Set<string>();
  const nameKeys = new Set<string>();
  if (!html) return { ids, phones, nameKeys };

  const idMatches = html.matchAll(/id="lblfr_ID\d+"[^>]*value="([^"]+)"/g);
  for (const m of idMatches) if (m[1].trim()) ids.add(m[1].trim());

  const nameMatches = html.matchAll(/id="lblbranch_name\d+"[^>]*value="([^"]+)"/g);
  for (const m of nameMatches) if (m[1].trim()) nameKeys.add(m[1].trim().toLowerCase().replace(/[^a-z0-9]/g, ''));

  const phoneMatches = html.matchAll(/id="lblcall_center_number\d+"[^>]*value="([^"]+)"/g);
  for (const m of phoneMatches) {
    const cleanPhone = m[1].trim().replace(/[^0-9]/g, '');
    if (cleanPhone && cleanPhone !== '-') phones.add(cleanPhone);
  }

  return { ids, phones, nameKeys };
}

function matchesCategory(item: FaysalRawBranch, index: CategoryIndex): boolean {
  if (index.ids.has(item.frId)) return true;
  const cleanPhone = (item.phone || '').replace(/[^0-9]/g, '');
  if (cleanPhone && index.phones.has(cleanPhone)) return true;
  const nameKey = item.name.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (index.nameKeys.has(nameKey)) return true;
  return false;
}

function parseBranchesFromHtml(html: string): FaysalRawBranch[] {
  const values = new Map<string, string>();
  const inputRegex = /<input\s+id="([^"]+)"[^>]*value="([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = inputRegex.exec(html)) !== null) {
    values.set(match[1], match[2]);
  }

  const total = parseInt(values.get('totallog') || '0', 10);
  const branches: FaysalRawBranch[] = [];

  for (let i = 1; i <= total; i++) {
    const frId = (values.get(`lblfr_ID${i}`) || '').trim();
    const name = (values.get(`lblbranch_name${i}`) || '').trim();
    const phone = (values.get(`lblcall_center_number${i}`) || '').trim();
    const rawLat = (values.get(`lbllat${i}`) || '').trim();
    const rawLng = (values.get(`lbllog${i}`) || '').trim();
    const city = (values.get(`lblcity${i}`) || '').trim();
    const address = (values.get(`lbladdress${i}`) || '').trim();

    if (frId || name) {
      branches.push({
        frId: frId || String(i),
        name: name || 'Faysal Bank Islamic Branch',
        phone: phone && phone !== '-' ? phone : undefined,
        rawLat,
        rawLng,
        city,
        address: address || name,
      });
    }
  }

  return branches;
}

async function fetchFaysalLive(): Promise<FaysalDataset> {
  console.log('Launching browser session to fetch live Faysal Bank branch data...');
  const browser = await chromium.launch({
    headless: true,
    channel: 'chrome',
    args: ['--disable-blink-features=AutomationControlled'],
  });

  try {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });

    const page = await context.newPage();
    await page.goto(LOCATOR_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 45_000,
    });

    const csrf = await page.evaluate(() => {
      const scripts = Array.from((globalThis as any).document.querySelectorAll('script'));
      for (const s of scripts as any[]) {
        const match = (s.textContent || '').match(/XID:\s*'([a-f0-9]+)'/);
        if (match) return match[1];
      }
      return '';
    });

    if (!csrf) {
      throw new Error('Unable to extract CSRF token (XID) from Faysal Bank branch locator page.');
    }

    const fetchStatusHtml = async (status: string) => {
      return page.evaluate(
        async ({ url, status, csrfToken }) => {
          const formData = new URLSearchParams();
          formData.append('status', status);
          formData.append('tabId', status);
          formData.append('XID', csrfToken);

          const r = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
              'X-Requested-With': 'XMLHttpRequest',
            },
            body: formData.toString(),
          });
          return r.text();
        },
        { url: GET_LAT_LONG_URL, status, csrfToken: csrf }
      );
    };

    console.log('Fetching main branch dataset...');
    const allHtml = await fetchStatusHtml('All');

    console.log('Fetching amenity categories...');
    const [atmHtml, pwdHtml, cdmHtml, satHtml, priHtml, priDeskHtml] = await Promise.all([
      fetchStatusHtml('AtmBranches'),
      fetchStatusHtml('PWDBranches'),
      fetchStatusHtml('CDMBranches'),
      fetchStatusHtml('SaturdayOpenBranches'),
      fetchStatusHtml('PriorityBranches'),
      fetchStatusHtml('PriorityDeskCenter'),
    ]);

    const atmIndex = parseCategoryIndex(atmHtml);
    const pwdIndex = parseCategoryIndex(pwdHtml);
    const cdmIndex = parseCategoryIndex(cdmHtml);
    const satIndex = parseCategoryIndex(satHtml);
    const priIndex1 = parseCategoryIndex(priHtml);
    const priIndex2 = parseCategoryIndex(priDeskHtml);

    const priorityIndex: CategoryIndex = {
      ids: new Set([...priIndex1.ids, ...priIndex2.ids]),
      phones: new Set([...priIndex1.phones, ...priIndex2.phones]),
      nameKeys: new Set([...priIndex1.nameKeys, ...priIndex2.nameKeys]),
    };

    return { allHtml, atmIndex, pwdIndex, cdmIndex, satIndex, priorityIndex };
  } finally {
    await browser.close();
  }
}

async function loadFaysalDataset(): Promise<FaysalDataset> {
  const allFiles = ['faysal_status_All.html', 'latlong_status_All.html', 'faysal_latlong_ALL.html'];
  const atmFiles = ['faysal_status_AtmBranches.html'];
  const pwdFiles = ['faysal_status_PWDBranches.html'];
  const cdmFiles = ['faysal_status_CDMBranches.html'];
  const satFiles = ['faysal_status_SaturdayOpenBranches.html'];
  const priFiles = ['faysal_status_PriorityBranches.html', 'faysal_status_PriorityDeskCenter.html'];

  let allHtml = '';
  for (const f of allFiles) {
    const p = path.resolve(process.cwd(), f);
    if (fs.existsSync(p)) {
      allHtml = fs.readFileSync(p, 'utf-8');
      break;
    }
  }

  if (allHtml && allHtml.includes('lblfr_ID')) {
    console.log('Using local Faysal Bank cached datasets...');
    const mergeIndices = (files: string[]) => {
      const ids = new Set<string>();
      const phones = new Set<string>();
      const nameKeys = new Set<string>();
      for (const f of files) {
        const p = path.resolve(process.cwd(), f);
        if (fs.existsSync(p)) {
          const sHtml = fs.readFileSync(p, 'utf-8');
          const idx = parseCategoryIndex(sHtml);
          for (const id of idx.ids) ids.add(id);
          for (const ph of idx.phones) phones.add(ph);
          for (const nk of idx.nameKeys) nameKeys.add(nk);
        }
      }
      return { ids, phones, nameKeys };
    };

    return {
      allHtml,
      atmIndex: mergeIndices(atmFiles),
      pwdIndex: mergeIndices(pwdFiles),
      cdmIndex: mergeIndices(cdmFiles),
      satIndex: mergeIndices(satFiles),
      priorityIndex: mergeIndices(priFiles),
    };
  }

  return fetchFaysalLive();
}

export async function scrapeFaysalDirect(): Promise<void> {
  console.log('======================================================');
  console.log('--- Starting Faysal Bank (FBL) Direct Ingestion ---');
  console.log('======================================================');
  await connectDatabase();

  const ctx = await createScraperContext();
  const provider = await Provider.findOne({ slug: 'faysal' });
  if (!provider) {
    throw new Error('Faysal Bank provider not found in DB! Please run seed first.');
  }

  // Pre-load all canonical cities into cache for high performance
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

  const dataset = await loadFaysalDataset();
  const rawBranches = parseBranchesFromHtml(dataset.allHtml);
  console.log(`Loaded ${rawBranches.length} Faysal Bank branches from official portal.`);

  const seenExternalIds = new Set<string>();
  const bulkOps: any[] = [];
  let resolvedFallbackCoords = 0;

  for (const item of rawBranches) {
    const externalId = `faysal_branch_${item.frId}`;
    if (seenExternalIds.has(externalId)) continue;
    seenExternalIds.add(externalId);

    let lat = parseCoordinate(item.rawLat);
    let lng = parseCoordinate(item.rawLng);

    const normCity = cleanAndNormalizeCity(item.city || item.address || item.name);
    const cityId = await resolveCityId(ctx, normCity);

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
        lat = 30.3753;
        lng = 69.3451;
      }
      resolvedFallbackCoords++;
    }

    const hasAtm =
      matchesCategory(item, dataset.atmIndex) ||
      item.name.toLowerCase().includes('atm') ||
      item.address.toLowerCase().includes('atm');
    const hasPwd = matchesCategory(item, dataset.pwdIndex);
    const hasCdm = matchesCategory(item, dataset.cdmIndex);
    const isSatOpen = matchesCategory(item, dataset.satIndex);
    const isPriority = matchesCategory(item, dataset.priorityIndex);

    // Faysal Bank is a full Islamic bank (all branches operate as Islamic Banking Branches)
    const isIslamic = true;

    const locationTypeId = islTypeId || branchTypeId;

    const doc = {
      providerId: provider._id,
      cityId,
      locationTypeId,
      externalId,
      name: item.name,
      address: item.address,
      lat,
      lng,
      location: {
        type: 'Point',
        coordinates: [lng, lat],
      },
      phone: item.phone,
      amenities: {
        atm: hasAtm,
        cdm: hasCdm,
        saturdayOpen: isSatOpen,
        wheelchairAccessible: hasPwd,
        priorityBanking: isPriority,
        islamic: isIslamic,
        biometric: true,
      },
      isActive: true,
      isVerified: true,
      rawData: {
        frId: item.frId,
        rawCity: item.city,
        rawLat: item.rawLat,
        rawLng: item.rawLng,
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

  console.log(`Executing ${bulkOps.length} atomic bulkWrite upserts in batches of 500...`);
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

  // Remove any obsolete dummy records from old partial peekaboo scraper
  const cleanedOld = await Location.deleteMany({
    providerId: provider._id,
    externalId: { $not: /^faysal_branch_/ },
  });
  if (cleanedOld.deletedCount > 0) {
    console.log(`🧹 Cleaned up ${cleanedOld.deletedCount} old dummy/unlinked Faysal records.`);
  }

  const finalCount = await Location.countDocuments({ providerId: provider._id });
  const atmCount = await Location.countDocuments({
    providerId: provider._id,
    'amenities.atm': true,
  });
  const cdmCount = await Location.countDocuments({
    providerId: provider._id,
    'amenities.cdm': true,
  });
  const pwdCount = await Location.countDocuments({
    providerId: provider._id,
    'amenities.wheelchairAccessible': true,
  });
  const satCount = await Location.countDocuments({
    providerId: provider._id,
    'amenities.saturdayOpen': true,
  });

  console.log('======================================================');
  console.log('✅ Faysal Bank (FBL) Ingestion Complete:');
  console.log(`- Total Records in DB:    ${finalCount}`);
  console.log(`- Upserted (New):         ${totalUpserted}`);
  console.log(`- Modified (Updated):     ${totalModified}`);
  console.log(`- Resolved Fallback Geo:  ${resolvedFallbackCoords}`);
  console.log(`- Branches with ATM:      ${atmCount}`);
  console.log(`- Branches with CDM:      ${cdmCount}`);
  console.log(`- Wheelchair / PWD:       ${pwdCount}`);
  console.log(`- Saturday Open:          ${satCount}`);
  console.log('======================================================');

  await disconnectDatabase();
}

if (require.main === module) {
  scrapeFaysalDirect().catch((err) => {
    console.error('Faysal Bank ingestion failed:', err);
    process.exit(1);
  });
}
