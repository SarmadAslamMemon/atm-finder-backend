export const PAKISTAN_CITIES = [
  { name: 'AJK (Muzaffarabad)', region: 'AJK', centerLat: 33.94508, centerLng: 73.63799 },
  { name: 'Balochistan', region: 'Balochistan', centerLat: 30.164013, centerLng: 66.992725 },
  { name: 'Faisalabad', region: 'Punjab', centerLat: 31.484618, centerLng: 73.073129 },
  { name: 'Gujranwala', region: 'Punjab', centerLat: 32.072238, centerLng: 73.70412 },
  { name: 'Gujrat', region: 'Punjab', centerLat: 32.931184, centerLng: 72.817052 },
  { name: 'Hyderabad', region: 'Sindh', centerLat: 25.123655, centerLng: 68.539284 },
  { name: 'Islamabad', region: 'ICT', centerLat: 33.33715, centerLng: 73.44989 },
  { name: 'Karachi', region: 'Sindh', centerLat: 24.812217, centerLng: 67.018803 },
  { name: 'Lahore', region: 'Punjab', centerLat: 31.457445, centerLng: 74.307215 },
  { name: 'Mardan', region: 'KPK', centerLat: 36.271126, centerLng: 72.257914 },
  { name: 'Multan', region: 'Punjab', centerLat: 29.612961, centerLng: 73.137268 },
  { name: 'Peshawar', region: 'KPK', centerLat: 32.940039, centerLng: 70.342162 },
  { name: 'Sahiwal', region: 'Punjab', centerLat: 29.792346, centerLng: 72.849015 },
  { name: 'Sialkot', region: 'Punjab', centerLat: 32.520953, centerLng: 74.501594 },
] as const;

export const HBL_LOCATION_TYPES = ['atm', 'brnch', 'isl', 'agri'] as const;
export type HblLocationType = (typeof HBL_LOCATION_TYPES)[number];

export {
  PEEKABOO_CITIES_FULL,
  PEEKABOO_POPULAR_CITIES,
  PEEKABOO_OTHER_CITIES,
} from './peekaboo-cities';

import { PEEKABOO_CITIES_FULL, PEEKABOO_POPULAR_CITIES } from './peekaboo-cities';

/** Core cities for quick scrapes */
export const PEEKABOO_CITIES = [
  ...PEEKABOO_POPULAR_CITIES,
  'Multan',
  'Hyderabad',
  'Gujranwala',
  'Gujrat',
  'Sukkur',
  'Abbottabad',
  'Bahawalpur',
  'Sargodha',
  'Mardan',
  'Muzaffarabad',
  'Kotli',
  'Bhimber',
  'Larkana',
  'Jhelum',
  'Kasur',
  'Sheikhupura',
  'Sahiwal',
  'Okara',
  'Dera Ghazi Khan',
  'Wah Cantt',
  'Chakwal',
  'Attock',
  'Haripur',
  'Swat',
  'Bannu',
  'Mingora',
  'Nawabshah',
  'Rahimyar Khan',
] as const;

/** @deprecated use PEEKABOO_CITIES_FULL */
export const UBL_CITIES = PEEKABOO_CITIES_FULL;

const CANONICAL_CITIES_DICT: Record<string, string> = {
  karachi: 'Karachi',
  lahore: 'Lahore',
  islamabad: 'Islamabad',
  rawalpindi: 'Rawalpindi',
  faisalabad: 'Faisalabad',
  multan: 'Multan',
  peshawar: 'Peshawar',
  quetta: 'Quetta',
  sialkot: 'Sialkot',
  gujranwala: 'Gujranwala',
  gujrat: 'Gujrat',
  hyderabad: 'Hyderabad',
  sukkur: 'Sukkur',
  abbottabad: 'Abbottabad',
  bahawalpur: 'Bahawalpur',
  sargodha: 'Sargodha',
  mardan: 'Mardan',
  muzaffarabad: 'Muzaffarabad',
  larkana: 'Larkana',
  jhelum: 'Jhelum',
  kasur: 'Kasur',
  sheikhupura: 'Sheikhupura',
  sahiwal: 'Sahiwal',
  okara: 'Okara',
  'dera ghazi khan': 'Dera Ghazi Khan',
  'dera ismail khan': 'Dera Ismail Khan',
  'wah cantt': 'Wah Cantt',
  chakwal: 'Chakwal',
  attock: 'Attock',
  haripur: 'Haripur',
  swat: 'Swat',
  bannu: 'Bannu',
  mingora: 'Mingora',
  nawabshah: 'Nawabshah',
  'rahim yar khan': 'Rahim Yar Khan',
  'rahimyar khan': 'Rahim Yar Khan',
  mirpur: 'Mirpur',
  kotli: 'Kotli',
  bhimber: 'Bhimber',
  rawalakot: 'Rawalakot',
  gwadar: 'Gwadar',
  turbat: 'Turbat',
  khuzdar: 'Khuzdar',
  kohat: 'Kohat',
  mansehra: 'Mansehra',
  charsadda: 'Charsadda',
  nowshera: 'Nowshera',
  swabi: 'Swabi',
  jacobabad: 'Jacobabad',
  shikarpur: 'Shikarpur',
  badin: 'Badin',
  thatta: 'Thatta',
  mirpurkhas: 'Mirpur Khas',
  'mirpur khas': 'Mirpur Khas',
  kamoke: 'Kamoke',
  hafizabad: 'Hafizabad',
  wazirabad: 'Wazirabad',
  daska: 'Daska',
  'mandi bahauddin': 'Mandi Bahauddin',
  kharian: 'Kharian',
  chiniot: 'Chiniot',
  jhang: 'Jhang',
  'toba tek singh': 'Toba Tek Singh',
  gojra: 'Gojra',
  samundri: 'Samundri',
  jaranwala: 'Jaranwala',
  khanewal: 'Khanewal',
  vehari: 'Vehari',
  burewala: 'Burewala',
  pakpattan: 'Pakpattan',
  arifwala: 'Arifwala',
  lodhran: 'Lodhran',
  bahawalnagar: 'Bahawalnagar',
  chishtian: 'Chishtian',
  muzaffargarh: 'Muzaffargarh',
  layyah: 'Layyah',
  'kot addu': 'Kot Addu',
  bhakkar: 'Bhakkar',
  mianwali: 'Mianwali',
  khushab: 'Khushab',
  jauharabad: 'Jauharabad',
  bhalwal: 'Bhalwal',
};

export function cleanAndNormalizeCity(rawName: string): string {
  if (!rawName) return 'Unknown';

  const cleaned = rawName
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[,\-_()]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const lower = cleaned.toLowerCase();

  if (CANONICAL_CITIES_DICT[lower]) {
    return CANONICAL_CITIES_DICT[lower];
  }

  for (const [key, canonical] of Object.entries(CANONICAL_CITIES_DICT)) {
    const regex = new RegExp(`\\b${key}\\b`, 'i');
    if (regex.test(cleaned)) {
      return canonical;
    }
  }

  return cleaned
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}