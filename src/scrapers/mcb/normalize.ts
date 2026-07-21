import { LocationUpsertInput } from '../shared/upsert';

export interface McbRawLocation {
  atmbranch_id?: number | string;
  branch_id?: string | number;
  branch_code?: string | number;
  city_id?: string | number;
  branch_name?: string;
  branch_address?: string;
  phone?: string;
  fax?: string;
  email?: string;
  latitude?: string | number;
  longitude?: string | number;
  city?: string;
  [key: string]: unknown;
}

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\r?\n/g, ' ').trim() : '';
}

function cleanNumber(value: unknown): number {
  const num = typeof value === 'string' ? Number.parseFloat(value) : Number(value);
  return Number.isFinite(num) ? num : NaN;
}

export function normalizeMcbLocation(raw: McbRawLocation): LocationUpsertInput | null {
  const name = cleanString(raw.branch_name);
  const address = cleanString(raw.branch_address);
  const cityName = cleanString(raw.city);
  const lat = cleanNumber(raw.latitude);
  const lng = cleanNumber(raw.longitude);
  const externalId = cleanString(raw.atmbranch_id) || cleanString(raw.branch_code);

  if (!name || !address || !cityName || !externalId) return null;

  return {
    providerSlug: 'mcb',
    cityName,
    locationTypeCode: 'brnch',
    externalId,
    name,
    address,
    lat,
    lng,
    phone: cleanString(raw.phone) || undefined,
    isVerified: true,
    rawData: raw,
  };
}
