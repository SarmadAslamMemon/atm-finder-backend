import 'dotenv/config';
import { connectDatabase, disconnectDatabase } from '../config/database';
import { Location, City } from '../models';

interface GeocodeResult {
  lat: number;
  lng: number;
  name?: string;
}

const PAK_LAT_MIN = 23.5;
const PAK_LAT_MAX = 37.5;
const PAK_LNG_MIN = 60.0;
const PAK_LNG_MAX = 78.0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isOutOfBounds(lat: number, lng: number): boolean {
  if (!lat || !lng || isNaN(lat) || isNaN(lng)) return true;
  return lat < PAK_LAT_MIN || lat > PAK_LAT_MAX || lng < PAK_LNG_MIN || lng > PAK_LNG_MAX;
}

function cleanQueryText(text: string): string {
  if (!text) return '';
  return text
    .replace(/function\s+tdmouse[^}]+}/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\b(?:ATM|Offsite|Onsite|Branch|IB|PK|Pakistan)\b/gi, ' ')
    .replace(/[-_#,/\\()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchGeocode(query: string): Promise<GeocodeResult | null> {
  try {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'AtmFinderBackend/1.0' },
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    if (data.features && data.features.length > 0) {
      const [lng, lat] = data.features[0].geometry.coordinates;
      if (!isOutOfBounds(lat, lng)) {
        return { lat, lng, name: data.features[0].properties?.name };
      }
    }
  } catch (err) {
    // ignore
  }
  return null;
}

async function forwardGeocode(branchName: string, rawAddress: string, cityName: string): Promise<GeocodeResult | null> {
  const cleanName = cleanQueryText(branchName);
  const cleanAddr = cleanQueryText(rawAddress);

  if (cleanName && cleanName.length > 3) {
    const q1 = `${cleanName}, ${cityName}, Pakistan`;
    const r1 = await fetchGeocode(q1);
    if (r1) return r1;
  }

  if (cleanAddr && cleanAddr.length > 4 && cleanAddr !== cleanName) {
    const q2 = `${cleanAddr}, ${cityName}, Pakistan`;
    const r2 = await fetchGeocode(q2);
    if (r2) return r2;
  }

  if (cleanAddr) {
    const parts = cleanAddr.split(' ').filter((p) => p.length > 3);
    if (parts.length >= 2) {
      const q3 = `${parts.slice(0, 3).join(' ')}, ${cityName}, Pakistan`;
      const r3 = await fetchGeocode(q3);
      if (r3) return r3;
    }
  }

  return null;
}

async function runAutoRepair() {
  await connectDatabase();

  console.log('========================================================================================');
  console.log('                 AUTO-REPAIR & GEOCODE DATABASE ACCURACY ENGINE                         ');
  console.log('========================================================================================\n');

  const cityMap = new Map<string, string>();
  const allCities = await City.find({}).lean();
  for (const c of allCities) {
    cityMap.set(c._id.toString(), c.name);
  }

  let repairedCount = 0;
  let skippedOverseasCount = 0;
  let failedGeocodeCount = 0;

  console.log('🔍 Step 1: Scanning and Repairing Out-of-Bounds Locations...');
  const allLocations = await Location.find({}).lean();
  const outOfBoundsList = allLocations.filter((loc) => isOutOfBounds(loc.lat, loc.lng));

  console.log(`Found ${outOfBoundsList.length} out-of-bounds locations.`);

  for (const loc of outOfBoundsList) {
    const cityName = cityMap.get(loc.cityId?.toString() || '') || 'Pakistan';
    const rawAddress = loc.address || '';
    const name = loc.name || '';

    if (/bahrain|dubai|london|afghanistan/i.test(name) || /bahrain|dubai|london|afghanistan/i.test(rawAddress)) {
      console.log(`  ✈️ Marking overseas branch inactive: ${loc._id} (${name})`);
      await Location.updateOne({ _id: loc._id }, { $set: { isActive: false, status: 'closed' } });
      skippedOverseasCount++;
      continue;
    }

    console.log(`  ⚡ Geocoding Outlier: ${loc._id} | "${name}" in ${cityName} (Old: ${loc.lat}, ${loc.lng})`);
    const geo = await forwardGeocode(name, rawAddress, cityName);

    if (geo) {
      console.log(`    ✅ Fixed -> New Coordinates: (${geo.lat}, ${geo.lng}) [Matched: ${geo.name || 'OK'}]`);
      await Location.updateOne(
        { _id: loc._id },
        {
          $set: {
            lat: geo.lat,
            lng: geo.lng,
            isVerified: true,
            isActive: true,
          },
        }
      );
      repairedCount++;
    } else {
      console.log(`    ❌ Could not resolve precise coordinates for: "${name}" (${rawAddress})`);
      failedGeocodeCount++;
    }
    await sleep(200);
  }

  console.log('\n🔍 Step 2: Detecting & Unclustering Dummy Coordinate Clusters...');
  const clusters = await Location.aggregate([
    {
      $group: {
        _id: { lat: '$lat', lng: '$lng', providerId: '$providerId' },
        count: { $sum: 1 },
        ids: { $push: '$_id' },
        names: { $push: '$name' },
        addresses: { $push: '$address' },
        cityIds: { $push: '$cityId' },
      },
    },
    { $match: { count: { $gte: 8 } } },
  ]);

  console.log(`Found ${clusters.length} dummy coordinate clusters to uncluster.`);

  for (const cluster of clusters) {
    const { lat, lng } = cluster._id;
    console.log(`\n  📍 Unclustering group of ${cluster.count} branches stacked at (${lat}, ${lng}):`);

    for (let i = 0; i < cluster.ids.length; i++) {
      const locId = cluster.ids[i];
      const name = cluster.names[i];
      const rawAddress = cluster.addresses[i];
      const cityId = cluster.cityIds[i];
      const cityName = cityMap.get(cityId?.toString() || '') || 'Pakistan';

      const geo = await forwardGeocode(name, rawAddress, cityName);
      if (geo && (Math.abs(geo.lat - lat) > 0.001 || Math.abs(geo.lng - lng) > 0.001)) {
        console.log(`    ✅ Separated "${name}" -> (${geo.lat}, ${geo.lng})`);
        await Location.updateOne(
          { _id: locId },
          {
            $set: {
              lat: geo.lat,
              lng: geo.lng,
              isVerified: true,
            },
          }
        );
        repairedCount++;
      } else {
        const jitterLat = lat + (Math.random() - 0.5) * 0.003;
        const jitterLng = lng + (Math.random() - 0.5) * 0.003;
        await Location.updateOne(
          { _id: locId },
          {
            $set: {
              lat: parseFloat(jitterLat.toFixed(6)),
              lng: parseFloat(jitterLng.toFixed(6)),
            },
          }
        );
      }
      await sleep(150);
    }
  }

  console.log('\n========================================================================================');
  console.log('                          AUTO-REPAIR SUMMARY                                           ');
  console.log('========================================================================================');
  console.log(` • Successfully Repaired / Re-geocoded:  ${repairedCount}`);
  console.log(` • Marked Inactive (Overseas branches):  ${skippedOverseasCount}`);
  console.log(` • Unresolved (Kept as-is):              ${failedGeocodeCount}`);
  console.log('========================================================================================\n');

  await disconnectDatabase();
}

runAutoRepair().catch((err) => {
  console.error('Fatal Auto-Repair Error:', err);
  process.exit(1);
});
