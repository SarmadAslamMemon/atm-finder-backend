import { LocationTypeCode } from '../../constants';
import { LocationUpsertInput } from '../shared/upsert';
import { FwblObject } from './types';

export function normalizeFwblLocation(raw: FwblObject): LocationUpsertInput | null {
  const name = raw.title?.trim();
  const address = raw.address?.trim() || raw.location.address?.formatted?.trim();
  const cityName = raw.city_text?.trim();

  if (!name || !address || !cityName || !raw.id) return null;

  const locationTypeCode: LocationTypeCode = raw.type === 'atm' ? 'atm' : 'brnch';

  return {
    providerSlug: 'fwbl',
    cityName,
    locationTypeCode,
    externalId: raw.id,
    name,
    address,
    lat: raw.location.geoPoint.lat,
    lng: raw.location.geoPoint.lng,
    phone: raw.phone && raw.phone !== '-' ? raw.phone.trim() : undefined,
    amenities: { atm: raw.type === 'atm' || raw.type === 'both' },
    isVerified: true,
    rawData: raw as unknown as Record<string, unknown>,
  };
}
