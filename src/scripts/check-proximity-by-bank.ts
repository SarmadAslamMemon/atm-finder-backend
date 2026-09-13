import { connectDatabase, disconnectDatabase } from '../config/database';
import { Location, Provider } from '../models';

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

async function checkOverlapByBank() {
  await connectDatabase();
  const providers = await Provider.find({ isActive: true }).sort({ name: 1 }).lean();

  console.log('Provider'.padEnd(28) + ' | ' + 'Total Locs'.padStart(10) + ' | ' + 'Near-Dupes (<25m)'.padStart(18));
  console.log('-'.repeat(62));

  for (const p of providers) {
    const locs = await Location.find({ providerId: p._id }).lean();
    const grid = new Map<string, any[]>();
    for (const loc of locs) {
      const gx = Math.floor(loc.lat * 100);
      const gy = Math.floor(loc.lng * 100);
      const gkey = `${gx},${gy}`;
      if (!grid.has(gkey)) grid.set(gkey, []);
      grid.get(gkey)!.push(loc);
    }

    let dupes = 0;
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
              dupes++;
            }
          }
        }
      }
    }

    console.log(p.name.padEnd(28) + ' | ' + String(locs.length).padStart(10) + ' | ' + String(dupes).padStart(18));
  }

  await disconnectDatabase();
}

checkOverlapByBank().catch(console.error);
