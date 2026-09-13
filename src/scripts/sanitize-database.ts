import { connectDatabase, disconnectDatabase } from '../config/database';
import { Location, Provider, City, LocationType } from '../models';

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

async function sanitizeDatabase() {
  await connectDatabase();
  console.log('========================================================================================');
  console.log('                       DATABASE SANITIZATION & CONSOLIDATION PASS                       ');
  console.log('========================================================================================\n');

  const locTypes = await LocationType.find().lean();
  const typeMap = new Map<string, string>(); // _id -> code ('brnch', 'atm', 'isl', 'agri')
  for (const t of locTypes) {
    typeMap.set(t._id.toString(), t.code);
  }

  // --------------------------------------------------------------------------
  // STEP 1: FIX SWAPPED LAT/LNG COORDINATES
  // --------------------------------------------------------------------------
  console.log('📍 STEP 1: Correcting Swapped Lat/Lng Coordinates...');
  const allLocations = await Location.find().lean();
  const swappedUpdates: any[] = [];

  for (const loc of allLocations) {
    const lat = loc.lat;
    const lng = loc.lng;

    // In Pakistan: Lat is ~23-38, Lng is ~60-78.
    // If lat is in [60, 78] and lng is in [23, 38], they are inverted.
    if (lat >= 60.0 && lat <= 78.0 && lng >= 23.0 && lng <= 38.0) {
      const correctLat = lng;
      const correctLng = lat;

      swappedUpdates.push({
        updateOne: {
          filter: { _id: loc._id },
          update: {
            $set: {
              lat: correctLat,
              lng: correctLng,
              location: {
                type: 'Point',
                coordinates: [correctLng, correctLat]
              }
            }
          }
        }
      });
      console.log(`   🔄 Inverted [${loc.externalId}] "${loc.name}": (${lat}, ${lng}) -> (${correctLat}, ${correctLng})`);
    }
  }

  if (swappedUpdates.length > 0) {
    await Location.bulkWrite(swappedUpdates);
    console.log(`   ✅ Successfully corrected ${swappedUpdates.length} inverted coordinate locations.\n`);
  } else {
    console.log('   ✅ No inverted coordinates found.\n');
  }

  // --------------------------------------------------------------------------
  // STEP 2: CLEAN UNPARSED JAVASCRIPT / HTML SNIPPETS IN NAMES & ADDRESSES
  // --------------------------------------------------------------------------
  console.log('🧹 STEP 2: Cleaning Garbage / JavaScript / HTML Snippets in Names...');
  const nameUpdates: any[] = [];
  const jsRegex = /(?:function\s+tdmouseover|font-family|<script|<\/script|<style|<\/style|el\.style)/i;

  const nbpProvider = await Provider.findOne({ slug: 'nbp' }).lean();
  const dirtyLocations = await Location.find({
    name: { $regex: jsRegex }
  }).populate('cityId').lean();

  for (const loc of dirtyLocations) {
    const cityName = (loc.cityId as any)?.name || 'Pakistan';
    let cleanName = `NBP ATM - ${cityName}`;
    if (loc.address && loc.address.length > 5 && !loc.address.match(jsRegex)) {
      const addrSnippet = loc.address.split(',')[0].trim();
      cleanName = `NBP ATM - ${addrSnippet}`;
    }

    nameUpdates.push({
      updateOne: {
        filter: { _id: loc._id },
        update: { $set: { name: cleanName } }
      }
    });
    console.log(`   ✨ Cleaned [${loc.externalId}]: "${cleanName}"`);
  }

  if (nameUpdates.length > 0) {
    await Location.bulkWrite(nameUpdates);
    console.log(`   ✅ Successfully cleaned ${nameUpdates.length} garbage text locations.\n`);
  } else {
    console.log('   ✅ No garbage text locations found.\n');
  }

  // --------------------------------------------------------------------------
  // STEP 3: CONSOLIDATE MULTI-FEED SPATIAL REDUNDANCY (Askari, Meezan, NBP, etc.)
  // --------------------------------------------------------------------------
  console.log('🏢 STEP 3: Consolidating Multi-Feed Spatial Redundancy (Branches & On-Site ATMs)...');
  const providers = await Provider.find({ isActive: true }).sort({ name: 1 }).lean();

  let totalMergedCount = 0;
  let totalPurgedDuplicates = 0;

  for (const provider of providers) {
    const locs = await Location.find({ providerId: provider._id }).lean();
    if (locs.length < 2) continue;

    // Spatial grid indexing
    const grid = new Map<string, any[]>();
    for (const loc of locs) {
      const gx = Math.floor(loc.lat * 100);
      const gy = Math.floor(loc.lng * 100);
      const gkey = `${gx},${gy}`;
      if (!grid.has(gkey)) grid.set(gkey, []);
      grid.get(gkey)!.push(loc);
    }

    const deletedIds = new Set<string>();
    const masterUpdates = new Map<string, any>();

    for (const [_, cellLocs] of grid.entries()) {
      if (cellLocs.length < 2) continue;

      for (let i = 0; i < cellLocs.length; i++) {
        const l1 = cellLocs[i];
        if (deletedIds.has(l1._id.toString())) continue;

        for (let j = i + 1; j < cellLocs.length; j++) {
          const l2 = cellLocs[j];
          if (deletedIds.has(l2._id.toString())) continue;

          const dist = fastDistanceMeters(l1.lat, l1.lng, l2.lat, l2.lng);
          if (dist > 25) continue;

          const n1 = normalizeText(l1.name);
          const n2 = normalizeText(l2.name);
          const a1 = normalizeText(l1.address);
          const a2 = normalizeText(l2.address);

          // Matching criteria: Identical names, or subset names, or identical street addresses
          const namesMatch = n1 === n2 || (n1.length > 5 && n2.includes(n1)) || (n2.length > 5 && n1.includes(n2));
          const addressMatch = (a1.length > 8 && a2.length > 8 && (a1.includes(a2) || a2.includes(a1)));

          if (namesMatch || (dist <= 5 && addressMatch)) {
            // Determine Master vs Duplicate Secondary
            const type1 = typeMap.get(l1.locationTypeId?.toString()) || 'atm';
            const type2 = typeMap.get(l2.locationTypeId?.toString()) || 'atm';

            let master = l1;
            let secondary = l2;

            // Prioritize Branch over ATM
            if (type1 === 'atm' && (type2 === 'brnch' || type2 === 'isl')) {
              master = l2;
              secondary = l1;
            } else if (type2 === 'atm' && (type1 === 'brnch' || type1 === 'isl')) {
              master = l1;
              secondary = l2;
            } else {
              // If both same type, pick the one with richer address
              if ((secondary.address || '').length > (master.address || '').length) {
                master = l2;
                secondary = l1;
              }
            }

            const masterIdStr = master._id.toString();
            const secIdStr = secondary._id.toString();

            // Merge amenities & contact
            const currentUpdates = masterUpdates.get(masterIdStr) || {};
            const existingAmenities = { ...(master.amenities || {}), ...(currentUpdates.amenities || {}) };

            const secAmenities = secondary.amenities || {};
            for (const [k, v] of Object.entries(secAmenities)) {
              if (v) existingAmenities[k] = true;
            }
            // Ensure on-site ATM flag is true
            existingAmenities.atm = true;
            currentUpdates.amenities = existingAmenities;

            // If master address is just a city name while secondary has full address, upgrade address
            if ((master.address || '').length < 12 && (secondary.address || '').length > 15) {
              currentUpdates.address = secondary.address;
            }

            if (!master.phone && secondary.phone) {
              currentUpdates.phone = secondary.phone;
            }

            masterUpdates.set(masterIdStr, currentUpdates);
            deletedIds.add(secIdStr);
            totalPurgedDuplicates++;
          }
        }
      }
    }

    // Apply updates for this provider
    const bulkOps: any[] = [];
    for (const [idStr, upd] of masterUpdates.entries()) {
      bulkOps.push({
        updateOne: {
          filter: { _id: idStr },
          update: { $set: upd }
        }
      });
    }

    if (bulkOps.length > 0) {
      await Location.bulkWrite(bulkOps);
      totalMergedCount += bulkOps.length;
    }

    if (deletedIds.size > 0) {
      await Location.deleteMany({ _id: { $in: Array.from(deletedIds) } });
    }

    if (deletedIds.size > 0) {
      console.log(`   🏦 ${provider.name.padEnd(28)}: Merged ${bulkOps.length} masters, purged ${deletedIds.size} duplicate co-locations`);
    }
  }

  console.log(`\n✅ SPATIAL CONSOLIDATION COMPLETE:`);
  console.log(`   • Enhanced & Merged Master Locations: ${totalMergedCount}`);
  console.log(`   • Redundant Duplicate Child Records Purged: ${totalPurgedDuplicates}`);

  const remainingTotal = await Location.countDocuments();
  console.log(`\n🎉 FINAL VERIFIED DATABASE LOCATIONS: ${remainingTotal}`);
  console.log('========================================================================================\n');

  await disconnectDatabase();
}

sanitizeDatabase().catch(console.error);
