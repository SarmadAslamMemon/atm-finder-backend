import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
import { load } from 'cheerio';
import { Types } from 'mongoose';
import { connectDatabase, disconnectDatabase } from '../../config/database';
import { City, Location, Provider } from '../../models';
import { cleanAndNormalizeCity } from '../shared/cities';
import { createScraperContext } from '../shared/upsert';

interface NbpBranchRaw {
  branchCode: string;
  name: string;
  cityName: string;
  isIslamic: boolean;
}

interface NbpAtmRaw {
  name: string;
  branchCode: string;
  onSite: boolean;
  cityName: string;
}

// Generate deterministic micro-jitter so multiple branches in the same city don't overlap exactly
function computeCityCoordsWithOffset(
  baseLat: number,
  baseLng: number,
  seedStr: string
): { lat: number; lng: number } {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash << 5) - hash + seedStr.charCodeAt(i);
    hash |= 0;
  }
  const angle = Math.abs(hash % 360) * (Math.PI / 180);
  const radius = (Math.abs(hash % 2000) / 2000) * 0.035; // up to ~3.5km spread within city
  const lat = Number((baseLat + radius * Math.cos(angle)).toFixed(6));
  const lng = Number((baseLng + radius * Math.sin(angle)).toFixed(6));
  return { lat, lng };
}

// Ultra-fast in-memory city resolver
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

    // Try finding or creating in DB
    let cityDoc = await City.findOne({ name: normalized, country: 'Pakistan' });
    if (!cityDoc) {
      try {
        cityDoc = await City.create({ name: normalized, country: 'Pakistan' });
      } catch (e) {
        cityDoc = await City.findOne({ name: normalized, country: 'Pakistan' });
      }
    }

    const id = (cityDoc ? cityDoc._id : this.defaultCityId) as Types.ObjectId;
    this.cityMap.set(key, id);
    return id;
  }
}

// Build a cache of canonical coordinates for each canonical city from DB
async function buildCityCoordinateCache(): Promise<Map<string, { lat: number; lng: number }>> {
  const cache = new Map<string, { lat: number; lng: number }>();

  // 1. From City model
  const cities = await City.find({
    centerLat: { $exists: true, $ne: null },
    centerLng: { $exists: true, $ne: null }
  }).lean();

  for (const c of cities) {
    if (c.centerLat && c.centerLng) {
      cache.set(c._id.toString(), { lat: c.centerLat, lng: c.centerLng });
    }
  }

  // 2. Fallback: compute averages from existing locations in DB
  const agg = await Location.aggregate([
    {
      $match: {
        lat: { $gt: 23, $lt: 38 },
        lng: { $gt: 60, $lt: 78 }
      }
    },
    {
      $group: {
        _id: '$cityId',
        avgLat: { $avg: '$lat' },
        avgLng: { $avg: '$lng' }
      }
    }
  ]);

  for (const item of agg) {
    if (item._id && item.avgLat && item.avgLng) {
      const key = item._id.toString();
      if (!cache.has(key)) {
        cache.set(key, {
          lat: Number(item.avgLat.toFixed(6)),
          lng: Number(item.avgLng.toFixed(6))
        });
      }
    }
  }

  return cache;
}

export async function scrapeNbpDirect(): Promise<void> {
  console.log('======================================================');
  console.log('  🏛️  Starting National Bank of Pakistan (NBP) Ingestion');
  console.log('======================================================');

  await connectDatabase();

  const ctx = await createScraperContext();
  const provider = await Provider.findOne({ slug: 'nbp' });
  if (!provider) {
    throw new Error('NBP provider not found in DB! Please run seed first.');
  }

  const cityResolver = new FastCityResolver();
  await cityResolver.init();

  const cityCoordCache = await buildCityCoordinateCache();
  console.log(`Loaded coordinate cache for ${cityCoordCache.size} canonical cities.`);

  // -------------------------------------------------------------
  // PHASE 1: Load Authoritative Branch-to-City Mapping (1,513 branches)
  // -------------------------------------------------------------
  console.log('\n--- Phase 1: Ingesting NBP Domestic Branch Network ---');
  let branchCityMap: Record<string, { branchCode: string; name: string; city: string }> = {};
  const mapFile = path.resolve(process.cwd(), 'nbp_branch_cities.json');

  if (fs.existsSync(mapFile)) {
    console.log(`Loading branch-to-city mapping from ${mapFile}...`);
    branchCityMap = JSON.parse(fs.readFileSync(mapFile, 'utf-8'));
  }

  // Also read full branch list from DomesticBrLocator.aspx if available
  let branchHtml = '';
  const localBranchFiles = ['nbp.html', 'branch_nbp.html', 'nbp_branches.html'];
  for (const f of localBranchFiles) {
    const fullP = path.resolve(process.cwd(), f);
    if (fs.existsSync(fullP)) {
      branchHtml = fs.readFileSync(fullP, 'utf-8');
      break;
    }
  }

  if (!branchHtml && Object.keys(branchCityMap).length === 0) {
    console.log('Fetching live branches from https://nbp.com.pk/BRNTWRK/DomesticBrLocator.aspx...');
    const res = await fetch('https://nbp.com.pk/BRNTWRK/DomesticBrLocator.aspx', {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });
    branchHtml = await res.text();
  }

  const rawBranches: NbpBranchRaw[] = [];

  if (Object.keys(branchCityMap).length > 0) {
    for (const [code, item] of Object.entries(branchCityMap)) {
      const isIslamic =
        item.name.toLowerCase().includes('islamic') ||
        item.name.toLowerCase().includes('ibb') ||
        item.name.toLowerCase().includes('aitemaad');
      rawBranches.push({
        branchCode: code,
        name: item.name,
        cityName: item.city,
        isIslamic
      });
    }
  } else if (branchHtml) {
    const $br = load(branchHtml);
    $br('select#ctl00_ContentPlaceHolder1_BrNameList2 option').each((_, el) => {
      const text = $br(el).text().trim();
      const val = $br(el).attr('value') || '';
      if (!text || val === '0') return;

      const match = text.match(/^(\d{4})--(.+)$/);
      if (match) {
        const branchCode = match[1];
        const name = match[2].trim();
        const isIslamic =
          name.toLowerCase().includes('islamic') ||
          name.toLowerCase().includes('ibb') ||
          name.toLowerCase().includes('aitemaad');
        const cityName = cleanAndNormalizeCity(name);
        rawBranches.push({ branchCode, name, cityName, isIslamic });
      }
    });
  }

  console.log(`Parsed ${rawBranches.length} official NBP domestic branches.`);

  // Ingest branches
  const bulkBranchOps: unknown[] = [];
  const seenExternalIds = new Set<string>();

  for (const br of rawBranches) {
    const externalId = `nbp_br_${br.branchCode}`;
    if (seenExternalIds.has(externalId)) continue;
    seenExternalIds.add(externalId);

    const canonicalCity = cleanAndNormalizeCity(br.cityName);
    const cityId = await cityResolver.resolve(canonicalCity);
    const baseCoords = cityCoordCache.get(cityId.toString()) || { lat: 30.3753, lng: 69.3451 };
    const { lat, lng } = computeCityCoordsWithOffset(baseCoords.lat, baseCoords.lng, br.branchCode);

    const locationTypeCode = br.isIslamic ? 'isl' : 'brnch';
    const locationTypeId = ctx.locationTypes.get(locationTypeCode);

    const updateDoc = {
      providerId: provider._id,
      cityId,
      locationTypeId,
      externalId,
      name: br.name,
      address: `${br.name}, ${canonicalCity}, Pakistan`,
      lat,
      lng,
      location: { type: 'Point', coordinates: [lng, lat] },
      amenities: {
        atm: true,
        islamic: br.isIslamic,
        biometric: true,
        saturdayOpen: false,
      },
      isActive: true,
      isVerified: true,
      rawData: {
        branchCode: br.branchCode,
        name: br.name,
        city: canonicalCity,
        isIslamic: br.isIslamic,
        source: 'DomesticBrLocator'
      },
    };

    bulkBranchOps.push({
      updateOne: {
        filter: { providerId: provider._id, externalId },
        update: { $set: updateDoc },
        upsert: true,
      },
    });
  }

  console.log(`Writing ${bulkBranchOps.length} branches to MongoDB in batches...`);
  for (let i = 0; i < bulkBranchOps.length; i += 500) {
    const chunk = bulkBranchOps.slice(i, i + 500);
    await Location.bulkWrite(chunk as any, { ordered: false });
  }
  console.log(`✅ Ingested ${bulkBranchOps.length} NBP domestic branches.`);

  // -------------------------------------------------------------
  // PHASE 2: Scrape & Ingest ATM Network (~1,564 ATMs)
  // -------------------------------------------------------------
  console.log('\n--- Phase 2: Scraping NBP ATM Network across All Cities ---');
  let rawAtms: NbpAtmRaw[] = [];
  const atmDumpFile = path.resolve(process.cwd(), 'nbp_atms.json');

  if (fs.existsSync(atmDumpFile)) {
    console.log(`Loading cached ATM dump from ${atmDumpFile}...`);
    rawAtms = JSON.parse(fs.readFileSync(atmDumpFile, 'utf-8'));
    console.log(`Loaded ${rawAtms.length} ATMs from cache.`);
  } else {
    console.log('Launching headless Chrome to scrape live ATM network...');
    const browser = await chromium.launch({ headless: true, channel: 'chrome' });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    });

    const initPage = await context.newPage();
    await initPage.goto('https://nbp.com.pk/BRNTWRK/AtmFinder.aspx', { waitUntil: 'domcontentloaded' });
    const cityOptions = await initPage.$$eval('select#ctl00_ContentPlaceHolder1_AtmCityList option', opts =>
      opts.map(o => ({ val: o.getAttribute('value') || '', name: o.textContent?.trim() || '' })).filter(o => o.val && o.val !== '0')
    );
    await initPage.close();

    console.log(`Found ${cityOptions.length} ATM cities to scrape.`);

    for (let i = 0; i < cityOptions.length; i++) {
      const city = cityOptions[i];
      const ct0 = Date.now();
      const page = await context.newPage();
      try {
        await page.goto('https://nbp.com.pk/BRNTWRK/AtmFinder.aspx', { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.selectOption('select#ctl00_ContentPlaceHolder1_AtmCityList', city.val);
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }),
          page.click('input#ctl00_ContentPlaceHolder1_Button1')
        ]);

        const html = await page.content();
        const $ = load(html);
        let count = 0;

        $('table').each((_, t) => {
          const firstRow = $(t).find('tr').first().text();
          if (firstRow.includes('ATM Location') && firstRow.includes('Branch Code')) {
            $(t).find('tr').slice(1).each((_, tr) => {
              const cells = $(tr).find('td').map((_, td) => $(td).text().replace(/\s+/g, ' ').trim()).get();
              if (cells.length >= 3 && cells[0] && cells[0] !== 'Back') {
                const name = cells[0].trim();
                const branchCode = cells[1].trim();
                if (
                  branchCode.match(/^\d{3,5}$/) &&
                  !name.includes('function') &&
                  !name.includes('tdmouseover') &&
                  !name.includes('ATM Location') &&
                  !name.includes('font-family')
                ) {
                  rawAtms.push({
                    name,
                    branchCode,
                    onSite: cells[2] === 'Yes',
                    cityName: city.name
                  });
                  count++;
                }
              }
            });
          }
        });

        console.log(`[${i + 1}/${cityOptions.length}] ${city.name}: ${count} ATMs (${Date.now() - ct0}ms)`);
      } catch (err: any) {
        console.warn(`[${i + 1}/${cityOptions.length}] ${city.name} failed:`, err.message);
      } finally {
        await page.close();
      }
    }

    await browser.close();

    // Clean any junk from rawAtms before saving
    rawAtms = rawAtms.filter(a =>
      a.branchCode &&
      a.branchCode.match(/^\d{3,5}$/) &&
      !a.name.includes('function') &&
      !a.name.includes('tdmouseover') &&
      !a.name.includes('ATM Location')
    );

    try {
      fs.writeFileSync(atmDumpFile, JSON.stringify(rawAtms, null, 2), 'utf-8');
      console.log(`Saved ${rawAtms.length} scraped ATMs to ${atmDumpFile}`);
    } catch (e) {
      console.warn('Could not save atm dump file:', e);
    }
  }

  // Deduplicate ATMs and filter out any corrupt cached entries
  const uniqueAtms = Array.from(
    new Map(rawAtms.map(a => [`${a.cityName}_${a.branchCode}_${a.name}`, a])).values()
  ).filter(a =>
    a.branchCode &&
    a.branchCode.match(/^\d{3,5}$/) &&
    !a.name.includes('function') &&
    !a.name.includes('tdmouseover') &&
    !a.name.includes('ATM Location') &&
    !a.name.includes('font-family')
  );
  console.log(`\nTotal unique ATMs extracted: ${uniqueAtms.length}`);

  const bulkAtmOps: unknown[] = [];
  const atmLocationTypeId = ctx.locationTypes.get('atm');

  for (let idx = 0; idx < uniqueAtms.length; idx++) {
    const atm = uniqueAtms[idx];
    const externalId = `nbp_atm_${atm.branchCode}_${idx + 1}`;
    if (seenExternalIds.has(externalId)) continue;
    seenExternalIds.add(externalId);

    const canonicalCity = cleanAndNormalizeCity(atm.cityName || atm.name);
    const cityId = await cityResolver.resolve(canonicalCity);
    const baseCoords = cityCoordCache.get(cityId.toString()) || { lat: 30.3753, lng: 69.3451 };
    const { lat, lng } = computeCityCoordsWithOffset(baseCoords.lat, baseCoords.lng, `${atm.branchCode}_${atm.name}`);

    const updateDoc = {
      providerId: provider._id,
      cityId,
      locationTypeId: atmLocationTypeId,
      externalId,
      name: `NBP ATM - ${atm.name}`,
      address: `${atm.name}, ${canonicalCity}, Pakistan`,
      lat,
      lng,
      location: { type: 'Point', coordinates: [lng, lat] },
      amenities: {
        atm: true,
        biometric: true,
        onSite: atm.onSite,
      },
      isActive: true,
      isVerified: true,
      rawData: {
        ...atm,
        city: canonicalCity,
        source: 'AtmFinder'
      },
    };

    bulkAtmOps.push({
      updateOne: {
        filter: { providerId: provider._id, externalId },
        update: { $set: updateDoc },
        upsert: true,
      },
    });
  }

  console.log(`Writing ${bulkAtmOps.length} ATMs to MongoDB in batches...`);
  for (let i = 0; i < bulkAtmOps.length; i += 500) {
    const chunk = bulkAtmOps.slice(i, i + 500);
    await Location.bulkWrite(chunk as any, { ordered: false });
  }

  const finalTotal = await Location.countDocuments({ providerId: provider._id });

  console.log('======================================================');
  console.log('🎉 National Bank of Pakistan (NBP) Ingestion Complete!');
  console.log(`- Branches Ingested: ${bulkBranchOps.length}`);
  console.log(`- ATMs Ingested:     ${bulkAtmOps.length}`);
  console.log(`- Total NBP Records in DB Now: ${finalTotal}`);
  console.log('======================================================');

  await disconnectDatabase();
}

if (require.main === module) {
  scrapeNbpDirect().catch((err) => {
    console.error('NBP Ingestion failed:', err);
    process.exit(1);
  });
}
