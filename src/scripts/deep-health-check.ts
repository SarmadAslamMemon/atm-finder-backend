import { connectDatabase, disconnectDatabase } from '../config/database';
import { Location, Provider, City, LocationType } from '../models';

// Fast approximate distance in meters (equirectangular approximation for small distances)
function fastDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const x = (lon2 - lon1) * Math.cos(((lat1 + lat2) / 2) * (Math.PI / 180));
  const y = lat2 - lat1;
  return Math.sqrt(x * x + y * y) * 111320;
}

function normalizeText(text: string): string {
  return (text || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractBranchCode(name: string): string | null {
  const match = name.match(/\b(\d{4})\b/);
  return match ? match[1] : null;
}

async function runDeepAudit() {
  await connectDatabase();
  console.log('========================================================================================');
  console.log('                         DEEP DATABASE HEALTH & SANITY AUDIT                            ');
  console.log('========================================================================================\n');

  const providers = await Provider.find({ isActive: true }).sort({ name: 1 }).lean();
  const validCityIds = new Set((await City.find({}, { _id: 1 }).lean()).map(c => c._id.toString()));
  const validLocTypeIds = new Set((await LocationType.find({}, { _id: 1 }).lean()).map(t => t._id.toString()));

  const report = {
    totalLocations: 0,
    outOfBoundsCoords: [] as any[],
    swappedCoords: [] as any[],
    dummyCenterClustering: [] as any[],
    orphanCityIds: [] as any[],
    orphanLocationTypeIds: [] as any[],
    missingOrEmptyFields: [] as any[],
    sameBankDuplicateBranchCodes: [] as any[],
    nearProximityDuplicates: [] as any[],
  };

  const PAK_LAT_MIN = 23.0;
  const PAK_LAT_MAX = 37.5;
  const PAK_LNG_MIN = 60.0;
  const PAK_LNG_MAX = 78.0;

  for (const provider of providers) {
    const locs = await Location.find({ providerId: provider._id }).lean();
    report.totalLocations += locs.length;

    // 1. Coordinate & ForeignKey Sanity
    for (const loc of locs) {
      const lat = loc.lat;
      const lng = loc.lng;

      if (!lat || !lng || isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) {
        report.outOfBoundsCoords.push({
          provider: provider.slug,
          id: loc.externalId,
          name: loc.name,
          lat,
          lng,
          reason: 'Zero / NaN'
        });
        continue;
      }

      // Check swapped lat/lng
      if (lat >= PAK_LNG_MIN && lat <= PAK_LNG_MAX && lng >= PAK_LAT_MIN && lng <= PAK_LAT_MAX) {
        report.swappedCoords.push({
          provider: provider.slug,
          id: loc.externalId,
          name: loc.name,
          lat,
          lng,
          suggestedLat: lng,
          suggestedLng: lat
        });
        continue;
      }

      // Check bounds
      if (lat < PAK_LAT_MIN || lat > PAK_LAT_MAX || lng < PAK_LNG_MIN || lng > PAK_LNG_MAX) {
        report.outOfBoundsCoords.push({
          provider: provider.slug,
          id: loc.externalId,
          name: loc.name,
          lat,
          lng,
          reason: 'Outside Pakistan'
        });
      }

      // FK checks
      if (!loc.cityId || !validCityIds.has(loc.cityId.toString())) {
        report.orphanCityIds.push({
          provider: provider.slug,
          id: loc.externalId,
          name: loc.name,
        });
      }

      if (!loc.locationTypeId || !validLocTypeIds.has(loc.locationTypeId.toString())) {
        report.orphanLocationTypeIds.push({
          provider: provider.slug,
          id: loc.externalId,
          name: loc.name,
        });
      }

      // Missing critical content
      const normName = normalizeText(loc.name);
      const normAddr = normalizeText(loc.address);
      if (!normName || normName.length < 3 || !normAddr || normAddr === 'pakistan' || normAddr === 'undefined') {
        report.missingOrEmptyFields.push({
          provider: provider.slug,
          id: loc.externalId,
          name: loc.name,
          address: loc.address
        });
      }
    }

    // 2. Dummy Center Clustered Geocoding (10+ locations sharing exact coord)
    const coordMap = new Map<string, any[]>();
    for (const loc of locs) {
      const key = `${loc.lat.toFixed(4)},${loc.lng.toFixed(4)}`;
      if (!coordMap.has(key)) coordMap.set(key, []);
      coordMap.get(key)!.push(loc);
    }

    for (const [coord, list] of coordMap.entries()) {
      if (list.length >= 8) {
        report.dummyCenterClustering.push({
          provider: provider.slug,
          coord,
          count: list.length,
          sampleNames: list.slice(0, 3).map(x => x.name)
        });
      }
    }

    // 3. Duplicate Branch Codes
    const codeMap = new Map<string, any[]>();
    for (const loc of locs) {
      const code = extractBranchCode(loc.name);
      if (code) {
        if (!codeMap.has(code)) codeMap.set(code, []);
        codeMap.get(code)!.push(loc);
      }
    }

    for (const [code, list] of codeMap.entries()) {
      if (list.length > 1) {
        report.sameBankDuplicateBranchCodes.push({
          provider: provider.slug,
          branchCode: code,
          count: list.length,
          items: list.map(x => ({
            id: x.externalId,
            name: x.name,
            address: x.address
          }))
        });
      }
    }

    // 4. Spatial Grid Bucketing for Fast Proximity Matching (< 25m)
    // Grid cell size ~ 0.01 deg (~1.1 km)
    const grid = new Map<string, any[]>();
    for (const loc of locs) {
      const gx = Math.floor(loc.lat * 100);
      const gy = Math.floor(loc.lng * 100);
      const gkey = `${gx},${gy}`;
      if (!grid.has(gkey)) grid.set(gkey, []);
      grid.get(gkey)!.push(loc);
    }

    for (const [_, cellLocs] of grid.entries()) {
      if (cellLocs.length < 2) continue;
      for (let i = 0; i < cellLocs.length; i++) {
        for (let j = i + 1; j < cellLocs.length; j++) {
          const l1 = cellLocs[i];
          const l2 = cellLocs[j];
          const dist = fastDistanceMeters(l1.lat, l1.lng, l2.lat, l2.lng);

          if (dist <= 25) {
            const n1 = normalizeText(l1.name);
            const n2 = normalizeText(l2.name);

            if (n1 === n2 || (n1.length > 5 && n2.includes(n1)) || (n2.length > 5 && n1.includes(n2))) {
              report.nearProximityDuplicates.push({
                provider: provider.slug,
                distanceMeters: Math.round(dist * 10) / 10,
                doc1: { id: l1.externalId, name: l1.name, address: l1.address },
                doc2: { id: l2.externalId, name: l2.name, address: l2.address },
              });
            }
          }
        }
      }
    }
  }

  console.log('📊 AUDIT SUMMARY REPORT:');
  console.log(`   • Total Database Locations Analyzed: ${report.totalLocations}`);
  console.log(`   • Out of Bounds / Invalid GPS:       ${report.outOfBoundsCoords.length} ${report.outOfBoundsCoords.length === 0 ? '✅' : '⚠️'}`);
  console.log(`   • Swapped Lat/Lng Coordinates:       ${report.swappedCoords.length} ${report.swappedCoords.length === 0 ? '✅' : '⚠️'}`);
  console.log(`   • Orphan Foreign Keys (City/Type):   ${report.orphanCityIds.length + report.orphanLocationTypeIds.length} ${report.orphanCityIds.length === 0 ? '✅' : '⚠️'}`);
  console.log(`   • Incomplete / Generic Address:      ${report.missingOrEmptyFields.length} ${report.missingOrEmptyFields.length === 0 ? '✅' : '⚠️'}`);
  console.log(`   • Dummy Center Clustered (8+ at 1 pt): ${report.dummyCenterClustering.length} ${report.dummyCenterClustering.length === 0 ? '✅' : '⚠️'}`);
  console.log(`   • Duplicate 4-Digit Branch Codes:    ${report.sameBankDuplicateBranchCodes.length} ${report.sameBankDuplicateBranchCodes.length === 0 ? '✅' : '⚠️'}`);
  console.log(`   • Near-Proximity (<25m) Same Name:   ${report.nearProximityDuplicates.length} ${report.nearProximityDuplicates.length === 0 ? '✅' : '⚠️'}`);
  console.log('----------------------------------------------------------------------------------------\n');

  if (report.swappedCoords.length > 0) {
    console.log('🔄 SWAPPED LAT/LNG DETECTED:');
    console.log(JSON.stringify(report.swappedCoords.slice(0, 5), null, 2));
    console.log('\n');
  }

  if (report.outOfBoundsCoords.length > 0) {
    console.log('⚠️ OUT OF BOUNDS COORDINATES:');
    console.log(JSON.stringify(report.outOfBoundsCoords.slice(0, 5), null, 2));
    console.log('\n');
  }

  if (report.dummyCenterClustering.length > 0) {
    console.log('📍 DUMMY / CITY-CENTER CLUSTERING (8+ locations sharing exact point):');
    console.log(JSON.stringify(report.dummyCenterClustering, null, 2));
    console.log('\n');
  }

  if (report.nearProximityDuplicates.length > 0) {
    console.log('🔍 NEAR-PROXIMITY (<25m) SAME-NAME DUPLICATES (Sample):');
    console.log(JSON.stringify(report.nearProximityDuplicates.slice(0, 8), null, 2));
    console.log('\n');
  }

  if (report.sameBankDuplicateBranchCodes.length > 0) {
    console.log('🏢 SAME BANK BRANCH CODE OVERLAPS (Sample):');
    console.log(JSON.stringify(report.sameBankDuplicateBranchCodes.slice(0, 5), null, 2));
    console.log('\n');
  }

  await disconnectDatabase();
}

runDeepAudit().catch(console.error);
