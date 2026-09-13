import { LocationUpsertInput } from '../shared/upsert';
import { cleanAndNormalizeCity } from '../shared/cities';

export interface ZtblRawLocation {
  id: number;
  name: string;
  lat: number;
  lng: number;
  address: string;
  phone?: string;
  code: number;
  zone?: number;
  atm?: number;
  [key: string]: unknown;
}

const ARRAY_START = 'var branches = [';

export function parseZtblLocations(html: string): ZtblRawLocation[] {
  const start = html.indexOf(ARRAY_START);
  if (start === -1) return [];

  const arrayStart = start + ARRAY_START.length - 1; // include the leading '['
  let depth = 0;
  let end = -1;

  for (let i = arrayStart; i < html.length; i += 1) {
    const char = html[i];
    if (char === '[') depth += 1;
    else if (char === ']') {
      depth -= 1;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }

  if (end === -1) return [];

  try {
    return JSON.parse(html.slice(arrayStart, end)) as ZtblRawLocation[];
  } catch {
    return [];
  }
}

export function normalizeZtblLocation(raw: ZtblRawLocation): LocationUpsertInput | null {
  const name = raw.name?.trim();
  const address = raw.address?.trim();

  if (!name || !address || !raw.code) return null;

  return {
    providerSlug: 'ztbl',
    cityName: cleanAndNormalizeCity(address) || cleanAndNormalizeCity(name),
    locationTypeCode: 'agri',
    externalId: String(raw.code),
    name,
    address,
    lat: raw.lat,
    lng: raw.lng,
    phone: raw.phone?.trim() || undefined,
    amenities: { atm: raw.atm === 1 },
    isVerified: true,
    rawData: raw as unknown as Record<string, unknown>,
  };
}
