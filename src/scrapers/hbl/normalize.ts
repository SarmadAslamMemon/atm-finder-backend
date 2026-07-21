import { LocationTypeCode } from '../../constants';
import { HblLocationType } from '../shared/cities';
import { LocationUpsertInput } from '../shared/upsert';

const HBL_TYPE_MAP: Record<HblLocationType, LocationTypeCode> = {
  atm: 'atm',
  brnch: 'brnch',
  isl: 'isl',
  agri: 'agri',
};

export interface HblRawLocation {
  id?: string | number;
  branch_id?: string | number;
  branch_code?: string | number;
  code?: string | number;
  name?: string;
  branch_name?: string;
  title?: string;
  address?: string;
  branch_address?: string;
  lat?: string | number;
  latitude?: string | number;
  lng?: string | number;
  lon?: string | number;
  longitude?: string | number;
  phone?: string;
  contact?: string;
  city?: string;
  [key: string]: unknown;
}

export function extractHblLocations(payload: unknown): HblRawLocation[] {
  if (Array.isArray(payload)) return payload as HblRawLocation[];
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    for (const key of ['data', 'locations', 'branches', 'results']) {
      if (Array.isArray(obj[key])) return obj[key] as HblRawLocation[];
    }
  }
  return [];
}

function pickString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return '';
}

function pickNumber(...values: unknown[]): number {
  for (const value of values) {
    const num = typeof value === 'string' ? Number.parseFloat(value) : Number(value);
    if (Number.isFinite(num)) return num;
  }
  return NaN;
}

export function normalizeHblLocation(
  raw: HblRawLocation,
  cityName: string,
  hblType: HblLocationType
): LocationUpsertInput | null {
  const lat = pickNumber(raw.lat, raw.latitude);
  const lng = pickNumber(raw.lng, raw.lon, raw.longitude);
  const name = pickString(raw.name, raw.branch_name, raw.title);
  const address = pickString(raw.address, raw.branch_address);
  const externalId = pickString(raw.id, raw.branch_id, raw.branch_code, raw.code, name, address);

  if (!name || !address || !externalId) return null;

  return {
    providerSlug: 'hbl',
    cityName: pickString(raw.city, cityName),
    locationTypeCode: HBL_TYPE_MAP[hblType],
    externalId,
    name,
    address,
    lat,
    lng,
    phone: pickString(raw.phone, raw.contact) || undefined,
    isVerified: true,
    rawData: raw,
  };
}
