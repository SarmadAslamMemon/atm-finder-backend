import { connectDatabase, disconnectDatabase } from '../config/database';
import { Location, Provider, LocationType } from '../models';

interface BankStats {
  providerName: string;
  slug: string;
  total: number;
  atmOnly: number;
  branchWithAtm: number;
  branchOnly: number;
  saturdayOpen: number;
  cdmCount: number;
  biometricCount: number;
  islamicCount: number;
  lockerCount: number;
}

async function analyzeAtmBranchData() {
  await connectDatabase();

  console.log('\n📊 Fetching and analyzing database locations...\n');

  const providers = await Provider.find().sort({ name: 1 }).lean();
  const locationTypes = await LocationType.find().lean();
  const typeMap = new Map<string, { code: string; label: string }>();
  locationTypes.forEach((t) => {
    typeMap.set(t._id.toString(), { code: t.code, label: t.label });
  });

  const allLocations = await Location.find({ isActive: true })
    .select('providerId locationTypeId name amenities')
    .lean();

  const bankStatsMap = new Map<string, BankStats>();

  providers.forEach((p) => {
    bankStatsMap.set(p._id.toString(), {
      providerName: p.name,
      slug: p.slug,
      total: 0,
      atmOnly: 0,
      branchWithAtm: 0,
      branchOnly: 0,
      saturdayOpen: 0,
      cdmCount: 0,
      biometricCount: 0,
      islamicCount: 0,
      lockerCount: 0,
    });
  });

  let grandTotal = 0;
  let grandAtmOnly = 0;
  let grandBranchWithAtm = 0;
  let grandBranchOnly = 0;
  let grandSaturday = 0;
  let grandCdm = 0;
  let grandBiometric = 0;

  for (const loc of allLocations) {
    const pId = loc.providerId?.toString();
    const stats = bankStatsMap.get(pId);
    if (!stats) continue;

    grandTotal++;
    stats.total++;

    const locType = typeMap.get(loc.locationTypeId?.toString())?.code || 'brnch';
    const amenities = loc.amenities || {};
    const nameLower = (loc.name || '').toLowerCase();

    const isAtmType = locType === 'atm' || (nameLower.includes('atm') && !nameLower.includes('branch'));
    const hasAtm = amenities.atm === true || isAtmType;

    if (isAtmType) {
      stats.atmOnly++;
      grandAtmOnly++;
    } else if (hasAtm) {
      stats.branchWithAtm++;
      grandBranchWithAtm++;
    } else {
      stats.branchOnly++;
      grandBranchOnly++;
    }

    if (amenities.saturdayOpen) {
      stats.saturdayOpen++;
      grandSaturday++;
    }
    if (amenities.cdm) {
      stats.cdmCount++;
      grandCdm++;
    }
    if (amenities.biometric) {
      stats.biometricCount++;
      grandBiometric++;
    }
    if (amenities.islamic) {
      stats.islamicCount++;
    }
    if (amenities.locker) {
      stats.lockerCount++;
    }
  }

  const sortedStats = Array.from(bankStatsMap.values()).filter((s) => s.total > 0).sort((a, b) => b.total - a.total);

  console.log('='.repeat(95));
  console.log('🏛️  PAKISTAN BANK LOCATIONS: ATM-ONLY vs BRANCH + ATM vs BRANCH-ONLY ANALYSIS');
  console.log('='.repeat(95));
  console.log(
    `${'Bank Name'.padEnd(26)} | ${'Total'.padStart(6)} | ${'ATM Only'.padStart(10)} | ${'Branch + ATM'.padStart(14)} | ${'Branch Only'.padStart(12)} | ${'Sat Open'.padStart(9)} | ${'CDM'.padStart(6)}`
  );
  console.log('-'.repeat(95));

  for (const s of sortedStats) {
    const atmOnlyPct = s.total > 0 ? ((s.atmOnly / s.total) * 100).toFixed(1) : '0.0';
    const brnchAtmPct = s.total > 0 ? ((s.branchWithAtm / s.total) * 100).toFixed(1) : '0.0';
    const brnchOnlyPct = s.total > 0 ? ((s.branchOnly / s.total) * 100).toFixed(1) : '0.0';

    console.log(
      `${s.providerName.padEnd(26)} | ${String(s.total).padStart(6)} | ${String(s.atmOnly).padStart(4)} (${atmOnlyPct.padStart(4)}%) | ${String(s.branchWithAtm).padStart(5)} (${brnchAtmPct.padStart(4)}%) | ${String(s.branchOnly).padStart(4)} (${brnchOnlyPct.padStart(4)}%) | ${String(s.saturdayOpen).padStart(9)} | ${String(s.cdmCount).padStart(6)}`
    );
  }

  console.log('='.repeat(95));
  console.log('📈 OVERALL TOTALS & DISTRIBUTION ACROSS ALL BANKS:');
  console.log('='.repeat(95));
  console.log(`🔹 Total Locations in DB:        ${grandTotal.toLocaleString()}`);
  console.log(`🔹 ATM Only (Standalone/Offsite): ${grandAtmOnly.toLocaleString()} (${((grandAtmOnly / grandTotal) * 100).toFixed(1)}%)`);
  console.log(`🔹 Branch + ATM (Branch with ATM): ${grandBranchWithAtm.toLocaleString()} (${((grandBranchWithAtm / grandTotal) * 100).toFixed(1)}%)`);
  console.log(`🔹 Branch Only (Counter without ATM): ${grandBranchOnly.toLocaleString()} (${((grandBranchOnly / grandTotal) * 100).toFixed(1)}%)`);
  console.log(`🔹 Saturday Open Branches:        ${grandSaturday.toLocaleString()} (${((grandSaturday / grandTotal) * 100).toFixed(1)}%)`);
  console.log(`🔹 Cash Deposit Machines (CDMs):  ${grandCdm.toLocaleString()} (${((grandCdm / grandTotal) * 100).toFixed(1)}%)`);
  console.log(`🔹 Biometric ATMs:                ${grandBiometric.toLocaleString()} (${((grandBiometric / grandTotal) * 100).toFixed(1)}%)`);
  console.log('='.repeat(95));

  await disconnectDatabase();
}

analyzeAtmBranchData().catch((err) => {
  console.error('Analysis error:', err);
  process.exit(1);
});
