import { connectDatabase, disconnectDatabase } from '../config/database';
import { Location, Provider } from '../models';

async function audit() {
  await connectDatabase();
  const providers = await Provider.find({ isActive: true }).sort({ name: 1 });
  console.log('Provider'.padEnd(16) + ' | ' + 'Total'.padStart(6) + ' | ' + 'Prefixed'.padStart(8) + ' | ' + 'Unprefixed'.padStart(10) + ' | ' + 'Twins'.padStart(8) + ' | ' + 'GPS Overlaps'.padStart(12));
  console.log('-'.repeat(75));
  for (const p of providers) {
    const locs = await Location.find({ providerId: p._id });
    const pfx = p.slug + '_';
    const pfxSet = new Set<string>();
    let unpfx = 0, twins = 0, pfxCount = 0;
    for (const l of locs) {
      const ext = String(l.externalId || '');
      if (ext.startsWith(pfx)) {
        pfxCount++;
        pfxSet.add(ext);
      } else {
        unpfx++;
      }
    }
    for (const l of locs) {
      const ext = String(l.externalId || '');
      if (!ext.startsWith(pfx) && pfxSet.has(pfx + ext)) {
        twins++;
      }
    }
    const coords = new Set<string>();
    let overlaps = 0;
    for (const l of locs) {
      const k = `${l.lat.toFixed(4)},${l.lng.toFixed(4)}`;
      if (coords.has(k)) overlaps++;
      else coords.add(k);
    }
    console.log(
      p.slug.padEnd(16) + ' | ' +
      String(locs.length).padStart(6) + ' | ' +
      String(pfxCount).padStart(8) + ' | ' +
      String(unpfx).padStart(10) + ' | ' +
      String(twins).padStart(8) + ' | ' +
      String(overlaps).padStart(12)
    );
  }
  await disconnectDatabase();
}

audit().catch(console.error);
